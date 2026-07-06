import { app, shell } from 'electron';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import extractZip from 'extract-zip';
import { suwolReleaseInfo } from '../../shared/release-info';
import type {
  LinuxUpdateManifest,
  UpdateCheckResult,
  UpdateDownloadResult,
  UpdateInstallResult
} from '../../shared/update/update-types';

const latestReleaseApiUrl = 'https://api.github.com/repos/suwol-suite/Suwol2DAnimator/releases/latest';
const updateManifestAssetName = 'suwol2d-linux-x64-update.json';
const userAgent = 'Suwol2DAnimator-Updater';

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubReleaseAsset[];
}

interface StagedUpdateState {
  filePath: string;
  stagedDir: string;
  manifest: LinuxUpdateManifest;
}

export class LinuxUpdateService {
  private stagedUpdate: StagedUpdateState | null = null;

  async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = suwolReleaseInfo.appVersion;
    const readiness = getLinuxUpdateReadiness();
    if (readiness) {
      return {
        available: false,
        currentVersion,
        reason: readiness
      };
    }

    try {
      const { manifest, release } = await fetchLatestLinuxManifest();
      if (release.prerelease) {
        return {
          available: false,
          currentVersion,
          latestVersion: manifest.version,
          releaseUrl: release.html_url,
          reason: 'prerelease'
        };
      }

      if (compareVersions(manifest.version, currentVersion) <= 0) {
        return {
          available: false,
          currentVersion,
          latestVersion: manifest.version,
          releaseUrl: manifest.releaseUrl,
          manifest,
          reason: 'noUpdate'
        };
      }

      return {
        available: true,
        currentVersion,
        latestVersion: manifest.version,
        releaseUrl: manifest.releaseUrl,
        manifest
      };
    } catch (error) {
      return {
        available: false,
        currentVersion,
        reason: `checkFailed:${getErrorMessage(error)}`
      };
    }
  }

  async downloadUpdate(): Promise<UpdateDownloadResult> {
    const readiness = getLinuxUpdateReadiness();
    if (readiness) {
      return {
        ok: false,
        errorCode: readiness,
        message: readiness
      };
    }

    try {
      const { manifest, zipAsset } = await fetchLatestLinuxManifest();
      if (compareVersions(manifest.version, suwolReleaseInfo.appVersion) <= 0) {
        return {
          ok: false,
          errorCode: 'noUpdate',
          message: 'No newer Linux ZIP release is available.',
          manifest
        };
      }

      const downloadsDir = getDownloadsDir();
      await mkdir(downloadsDir, { recursive: true });
      const finalPath = join(downloadsDir, manifest.fileName);
      const tempPath = `${finalPath}.part`;
      await rm(tempPath, { force: true });
      await downloadToFile(zipAsset.browser_download_url, tempPath);
      await rename(tempPath, finalPath);

      const actualSha256 = await sha256(finalPath);
      if (actualSha256 !== manifest.sha256.toLowerCase()) {
        await rm(finalPath, { force: true });
        return {
          ok: false,
          errorCode: 'checksumFailed',
          message: `Checksum mismatch for ${manifest.fileName}.`,
          manifest
        };
      }

      const stagedDir = getStagedUpdateDir(manifest.version);
      await rm(stagedDir, { recursive: true, force: true });
      await mkdir(stagedDir, { recursive: true });
      await extractZip(finalPath, { dir: stagedDir });

      this.stagedUpdate = {
        filePath: finalPath,
        stagedDir,
        manifest
      };
      await writeFile(
        getStagedStatePath(manifest.version),
        `${JSON.stringify(this.stagedUpdate, null, 2)}\n`,
        'utf8'
      );

      return {
        ok: true,
        filePath: finalPath,
        manifest
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: 'downloadFailed',
        message: getErrorMessage(error)
      };
    }
  }

  async installUpdateAndRestart(): Promise<UpdateInstallResult> {
    const readiness = getLinuxUpdateReadiness();
    if (readiness) {
      return {
        ok: false,
        mode: 'unsupported',
        errorCode: readiness,
        message: readiness
      };
    }

    const stagedUpdate = this.stagedUpdate ?? await readLatestStagedUpdate();
    if (!stagedUpdate) {
      return {
        ok: false,
        mode: 'download-only',
        errorCode: 'noStagedUpdate',
        message: 'Download and verify an update before installing.'
      };
    }

    const installDir = dirname(process.execPath);
    const writable = await isWritableDirectory(installDir);
    if (!writable) {
      return {
        ok: true,
        mode: 'download-only',
        message: `Install directory is not writable. Replace the app manually with ${stagedUpdate.filePath}.`
      };
    }

    try {
      const scriptPath = join(getUpdatesRoot(), 'apply-update.sh');
      await writeFile(scriptPath, createInstallScript({
        appPid: process.pid,
        installDir,
        stagedDir: stagedUpdate.stagedDir,
        execPath: process.execPath
      }), 'utf8');
      await chmod(scriptPath, 0o755);

      const child = spawn('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      app.quit();

      return {
        ok: true,
        mode: 'install-restart',
        message: `Installing ${stagedUpdate.manifest.version} and restarting.`
      };
    } catch (error) {
      return {
        ok: false,
        mode: 'download-only',
        errorCode: 'installFailed',
        message: getErrorMessage(error)
      };
    }
  }

  async openDownloadedUpdateFolder(): Promise<UpdateDownloadResult> {
    const downloadsDir = getDownloadsDir();
    await mkdir(downloadsDir, { recursive: true });
    const error = await shell.openPath(downloadsDir);
    return {
      ok: !error,
      filePath: downloadsDir,
      ...(error ? { errorCode: 'openFolderFailed', message: error } : {})
    };
  }
}

async function fetchLatestLinuxManifest(): Promise<{
  release: GitHubRelease;
  manifest: LinuxUpdateManifest;
  zipAsset: GitHubReleaseAsset;
}> {
  const release = await fetchJson<GitHubRelease>(latestReleaseApiUrl);
  const manifestAsset = release.assets.find((asset) => asset.name === updateManifestAssetName);
  if (!manifestAsset) {
    throw new Error(`Release is missing ${updateManifestAssetName}.`);
  }

  const manifest = normalizeLinuxManifest(await fetchJson<unknown>(manifestAsset.browser_download_url));
  const zipAsset = release.assets.find((asset) => asset.name === manifest.fileName);
  if (!zipAsset) {
    throw new Error(`Release is missing ${manifest.fileName}.`);
  }

  return { release, manifest, zipAsset };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function normalizeLinuxManifest(value: unknown): LinuxUpdateManifest {
  const manifest = value as Partial<LinuxUpdateManifest>;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Update manifest is not an object.');
  }

  const normalized: LinuxUpdateManifest = {
    version: requireString(manifest.version, 'version'),
    platform: requireString(manifest.platform, 'platform') as 'linux',
    arch: requireString(manifest.arch, 'arch') as 'x64',
    fileName: requireString(manifest.fileName, 'fileName'),
    sha256: requireString(manifest.sha256, 'sha256').toLowerCase(),
    size: requirePositiveInteger(manifest.size, 'size'),
    releaseTag: requireString(manifest.releaseTag, 'releaseTag'),
    releaseUrl: requireString(manifest.releaseUrl, 'releaseUrl'),
    publishedAt: requireString(manifest.publishedAt, 'publishedAt')
  };

  if (normalized.platform !== 'linux' || normalized.arch !== 'x64') {
    throw new Error('Update manifest platform must be linux x64.');
  }

  if (!/^[0-9a-f]{64}$/.test(normalized.sha256)) {
    throw new Error('Update manifest sha256 is invalid.');
  }

  if (!normalized.fileName.endsWith('-linux-x64.zip')) {
    throw new Error('Update manifest fileName must reference a Linux x64 ZIP.');
  }

  return normalized;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Update manifest ${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function requirePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Update manifest ${fieldName} must be a positive integer.`);
  }

  return value;
}

function getLinuxUpdateReadiness(): string {
  if (process.platform !== 'linux') {
    return 'unsupportedPlatform';
  }

  if (!app.isPackaged) {
    return 'notPackaged';
  }

  return '';
}

function getUpdatesRoot(): string {
  return join(app.getPath('userData'), 'updates');
}

function getDownloadsDir(): string {
  return join(getUpdatesRoot(), 'downloads');
}

function getStagedUpdateDir(version: string): string {
  return join(getUpdatesRoot(), 'staged', sanitizeVersion(version));
}

function getStagedStatePath(version: string): string {
  return join(getUpdatesRoot(), 'staged', `${sanitizeVersion(version)}.json`);
}

function sanitizeVersion(version: string): string {
  return version.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function readLatestStagedUpdate(): Promise<StagedUpdateState | null> {
  const stagedRoot = join(getUpdatesRoot(), 'staged');
  let versions: string[];
  try {
    versions = await readdir(stagedRoot);
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    versions
      .filter((version) => version.endsWith('.json'))
      .map(async (version) => {
        const statePath = join(stagedRoot, version);
        try {
          const fileStat = await stat(statePath);
          const parsed = JSON.parse(await readFile(statePath, 'utf8')) as StagedUpdateState;
          return { state: parsed, time: fileStat.mtimeMs };
        } catch {
          return null;
        }
      })
  );

  return candidates
    .filter((candidate): candidate is { state: StagedUpdateState; time: number } => candidate !== null)
    .sort((left, right) => right.time - left.time)[0]?.state ?? null;
}

async function isWritableDirectory(directory: string): Promise<boolean> {
  const probePath = join(directory, `.suwol-update-write-test-${process.pid}`);
  try {
    await writeFile(probePath, 'ok', 'utf8');
    await rm(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function createInstallScript(options: {
  appPid: number;
  installDir: string;
  stagedDir: string;
  execPath: string;
}): string {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `APP_PID=${options.appPid}`,
    `INSTALL_DIR=${toShellString(options.installDir)}`,
    `STAGED_DIR=${toShellString(options.stagedDir)}`,
    `EXEC_PATH=${toShellString(options.execPath)}`,
    'for _ in $(seq 1 60); do',
    '  if ! kill -0 "$APP_PID" 2>/dev/null; then',
    '    break',
    '  fi',
    '  sleep 1',
    'done',
    'mkdir -p "$INSTALL_DIR"',
    'cp -a "$STAGED_DIR"/. "$INSTALL_DIR"/',
    'chmod +x "$EXEC_PATH" || true',
    'nohup "$EXEC_PATH" >/dev/null 2>&1 &',
    ''
  ].join('\n');
}

function toShellString(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function downloadToFile(url: string, outputPath: string, redirectCount = 0): Promise<void> {
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects while downloading update.'));
  }

  return new Promise((resolvePromise, reject) => {
    const request = httpsGet(url, { headers: { 'User-Agent': userAgent } }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume();
        downloadToFile(new URL(location, url).toString(), outputPath, redirectCount + 1)
          .then(resolvePromise, reject);
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${status}.`));
        return;
      }

      pipeline(response, createWriteStream(outputPath)).then(resolvePromise, reject);
    });
    request.on('error', reject);
  });
}

function sha256(filePath: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolvePromise(hash.digest('hex')));
  });
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
