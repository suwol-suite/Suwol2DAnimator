import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const unityPackagePath = path.join(repoRoot, 'unity', 'com.suwol.suwol2d');
const useReleasePackage = process.argv.includes('--release');
let packageDependency = `file:${unityPackagePath.replace(/\\/g, '/')}`;
const smokeMethod = 'Suwol.Suwol2D.Editor.Tests.Suwol2DRuntimeSmokeTests.RunAll';

const unityExe = await findUnityExecutable();
if (!unityExe) {
  console.log('Unity smoke skipped: set UNITY_EXE or install Unity through Unity Hub to run verify:unity.');
  process.exit(0);
}

let tempRoot = '';
try {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'suwol2d-unity-smoke-v9-'));
  const projectPath = path.join(tempRoot, 'UnityProject');
  const createLog = path.join(tempRoot, 'create-project.log');
  const smokeLog = path.join(tempRoot, 'runtime-smoke.log');

  if (useReleasePackage) {
    packageDependency = await extractReleasePackageDependency(tempRoot);
  }

  console.log(`Unity smoke using: ${unityExe}`);
  console.log(`Unity smoke temp project: ${projectPath}`);
  await runUnity(
    unityExe,
    ['-batchmode', '-nographics', '-quit', '-createProject', projectPath, '-logFile', createLog],
    createLog,
    'create temporary Unity project'
  );

  await addLocalPackageDependency(projectPath);
  const logText = await runUnity(
    unityExe,
    [
      '-batchmode',
      '-nographics',
      '-quit',
      '-projectPath',
      projectPath,
      '-executeMethod',
      smokeMethod,
      '-logFile',
      smokeLog
    ],
    smokeLog,
    'run Suwol2D Runtime Stability v9 smoke tests'
  );

  if (
    !logText.includes('Suwol2D Runtime Stability v9 smoke tests passed.') &&
    !logText.includes('Suwol2D Runtime Stability v9 + Animation Mixing State Machine v10 smoke tests passed.') &&
    !logText.includes('Suwol2D Runtime Stability v9 + Animation Mixing State Machine v10 + Timeline Usability v11 smoke tests passed.')
  ) {
    throw new Error(`Unity smoke did not report success.\n${tail(logText)}`);
  }

  console.log('Unity smoke passed.');
} finally {
  if (tempRoot) {
    await removeTempRoot(tempRoot);
  }
}

async function extractReleasePackageDependency(tempRoot) {
  const releaseZip = path.join(repoRoot, 'release', 'com.suwol.suwol2d-0.12.0.zip');
  const packageRoot = path.join(tempRoot, 'ReleasePackage', 'com.suwol.suwol2d');
  await access(releaseZip, constants.F_OK);
  await mkdir(packageRoot, { recursive: true });
  await expandArchive(releaseZip, packageRoot);
  await access(path.join(packageRoot, 'package.json'), constants.F_OK);
  const dependency = `file:${packageRoot.replace(/\\/g, '/')}`;
  console.log(`Unity smoke release package dependency: ${dependency}`);
  return dependency;
}

function expandArchive(zipPath, destinationPath) {
  const command = [
    '$ErrorActionPreference = "Stop"',
    `$zip = ${toPowerShellString(zipPath)}`,
    `$destination = ${toPowerShellString(destinationPath)}`,
    'Expand-Archive -Path $zip -DestinationPath $destination -Force'
  ].join('; ');

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Expand-Archive failed with exit code ${code}`));
      }
    });
  });
}

function toPowerShellString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function findUnityExecutable() {
  const candidates = [];
  if (process.env.UNITY_EXE) {
    candidates.push(process.env.UNITY_EXE);
  }

  candidates.push(
    'C:\\Program Files\\Unity\\Hub\\Editor\\6000.5.2f1\\Editor\\Unity.exe',
    'C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.0f1\\Editor\\Unity.exe'
  );

  const hubEditorRoot = process.env.UNITY_HUB_EDITOR_DIR ?? 'C:\\Program Files\\Unity\\Hub\\Editor';
  try {
    const entries = await readdir(hubEditorRoot, { withFileTypes: true });
    const versions = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

    for (const version of versions) {
      candidates.push(path.join(hubEditorRoot, version, 'Editor', 'Unity.exe'));
    }
  } catch {
    // Unity Hub is optional on machines that only run Electron checks.
  }

  for (const candidate of candidates) {
    if (candidate && await canExecute(candidate)) {
      return candidate;
    }
  }

  return '';
}

async function canExecute(filePath) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

async function addLocalPackageDependency(projectPath) {
  const packagesDir = path.join(projectPath, 'Packages');
  const manifestPath = path.join(packagesDir, 'manifest.json');
  await mkdir(packagesDir, { recursive: true });

  let manifest = { dependencies: {} };
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    manifest = { dependencies: {} };
  }

  manifest.dependencies ??= {};
  manifest.dependencies['com.suwol.suwol2d'] = packageDependency;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Unity smoke package dependency: ${packageDependency}`);
}

async function runUnity(unity, args, logPath, label) {
  const code = await new Promise((resolve) => {
    const child = spawn(unity, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('close', resolve);
  });

  let logText = '';
  try {
    logText = await readFile(logPath, 'utf8');
  } catch {
    logText = '';
  }

  if (code !== 0) {
    throw new Error(`Unity failed to ${label} with exit code ${code}.\n${tail(logText)}`);
  }

  return logText;
}

async function removeTempRoot(tempRoot) {
  let lastError;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await rm(tempRoot, { recursive: true, force: true });
      console.log(`Unity smoke temp project deleted: ${tempRoot}`);
      return;
    } catch (error) {
      lastError = error;
      await delay(1000);
    }
  }

  console.warn(`Unity smoke temp project cleanup skipped because files were still locked: ${tempRoot}`);
  if (lastError) {
    console.warn(String(lastError.message ?? lastError));
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tail(text, maxLines = 80) {
  return text
    .split(/\r?\n/)
    .slice(-maxLines)
    .join('\n');
}
