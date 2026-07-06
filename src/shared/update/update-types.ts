export interface LinuxUpdateManifest {
  version: string;
  platform: 'linux';
  arch: 'x64';
  fileName: string;
  sha256: string;
  size: number;
  releaseTag: string;
  releaseUrl: string;
  publishedAt: string;
}

export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  manifest?: LinuxUpdateManifest;
  reason?: string;
}

export interface UpdateDownloadResult {
  ok: boolean;
  filePath?: string;
  manifest?: LinuxUpdateManifest;
  errorCode?: string;
  message?: string;
}

export interface UpdateInstallResult {
  ok: boolean;
  mode: 'install-restart' | 'download-only' | 'unsupported';
  errorCode?: string;
  message?: string;
}
