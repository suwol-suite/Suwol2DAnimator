# Linux ZIP Auto Update v19

## Purpose

v19 adds a Linux ZIP auto update path for packaged Linux x64 builds. The
updater checks public GitHub Releases, downloads the Linux ZIP, verifies its
SHA256 hash, stages the update, and can restart into the staged files when the
install directory is writable.

## Scope

- Linux x64 ZIP packages
- Public GitHub Releases update check
- ZIP asset download
- SHA256 checksum verification from the update manifest
- Staged extraction under app user data
- Install and restart when the Linux install directory is writable
- Download-only fallback when the install directory is not writable

Windows auto update, macOS auto update, AppImage update, deb/rpm package manager
update, silent forced update, and Spine compatibility are out of scope.

## GitHub Releases Assets

Each Linux ZIP release should publish these assets together:

```text
Suwol 2D Animator-<version>-linux-x64.zip
checksums-linux-x64.txt
suwol2d-linux-x64-update.json
```

Example for `0.12.0`:

```text
Suwol 2D Animator-0.12.0-linux-x64.zip
checksums-linux-x64.txt
suwol2d-linux-x64-update.json
```

## Update Manifest

The workflow writes `suwol2d-linux-x64-update.json` beside the ZIP and checksum
file:

```json
{
  "version": "0.12.0",
  "platform": "linux",
  "arch": "x64",
  "fileName": "Suwol 2D Animator-0.12.0-linux-x64.zip",
  "sha256": "...",
  "size": 123456789,
  "releaseTag": "v0.12.0",
  "releaseUrl": "https://github.com/suwol-suite/Suwol2DAnimator/releases/tag/v0.12.0",
  "publishedAt": "2026-07-06T00:00:00Z"
}
```

The packaged app refuses to stage an update when the downloaded ZIP hash does
not match `sha256`.

## Runtime Behavior

The updater is active only when both conditions are true:

- `process.platform` is `linux`
- the app is packaged

Development preview does not check for updates. Windows builds show that Linux
ZIP auto update is only available in the Linux packaged app.

The updater downloads to:

```text
app.getPath("userData")/updates/downloads/
```

Verified ZIP contents are extracted to:

```text
app.getPath("userData")/updates/staged/<version>/
```

If `path.dirname(process.execPath)` is writable, the app writes an
`apply-update.sh` script, launches it detached, quits, copies staged contents
over the install directory, marks the executable as runnable, and starts the app
again.

If the install directory is not writable, the verified ZIP remains in the
downloads folder and the UI reports a download-only fallback for manual
replacement.

## Workflow Dispatch vs Tag Release

`workflow_dispatch` is for artifact verification. It creates the ZIP,
`checksums-linux-x64.txt`, and `suwol2d-linux-x64-update.json` as workflow
artifacts.

GitHub Release upload is limited to tag push runs. Do not create tags or upload
Release assets unless explicitly instructed.

## Security Notes

- No GitHub token is used by the app updater.
- The app uses only the public GitHub Releases API.
- No code signing secrets are stored in this repository.
- Checksum verification is required before staging.
- A checksum failure blocks installation.

## Verification

Run:

```powershell
npm.cmd run verify:linux-update
npm.cmd run release:check
```

Linux install/restart should still be manually checked on a Linux ZIP package
before public release.
