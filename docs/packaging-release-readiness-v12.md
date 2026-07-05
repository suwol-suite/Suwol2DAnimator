# Packaging / Release Readiness v12

v12 prepares the Electron editor and Unity UPM package for local Windows release
builds, and adds GitHub Actions paths for Linux x64 ZIP distribution and signed
Linux release uploads. It does not add new animation features.

## Goals

- Align Electron app and Unity package versions at `0.12.0`.
- Add Windows packaging through `electron-builder`.
- Add Linux x64 ZIP packaging through `electron-builder`.
- Add Linux AppImage and tar.gz packaging through `electron-builder`.
- Add GitHub Actions workflow for Linux ZIP artifacts and tag release uploads.
- Add GitHub Actions workflow for GPG-signed Linux release artifacts.
- Generate local brand icons and Windows ICO assets.
- Include Unity UPM package and docs as packaged app resources.
- Add release verification, checksum, Unity package zip, and packaged smoke scripts.
- Document release checklist, artifacts, license status, and troubleshooting.

## Electron Packaging

Configuration:

```text
electron-builder.yml
```

Important settings:

- `appId`: `com.suwol.suwol2danimator`
- `productName`: `Suwol 2D Animator`
- output: `release/`
- Windows icon: `build/icon.ico`
- Windows targets: `dir`, `portable`, `nsis`
- Linux targets: `AppImage`, `tar.gz`, and `zip` for `x64`
- bundled resources: Unity UPM package, docs, README, LICENSE, THIRD-PARTY notices

Commands:

```powershell
npm.cmd run icons:generate
npm.cmd run release:check
npm.cmd run dist:win:dir
npm.cmd run dist:win:portable
npm.cmd run dist:win:nsis
npm.cmd run dist:linux
npm.cmd run dist:linux:zip
npm.cmd run release:checksums
```

Code signing is intentionally not configured in v12. Add signing configuration
only through secure release environment variables or external CI secrets.

## GitHub Actions Linux ZIP

Workflow:

```text
.github/workflows/release-linux-zip.yml
```

Behavior:

- Runs manually through `workflow_dispatch`.
- Runs automatically on tag pushes matching `v*.*.*`.
- Uses Node.js 22 and `npm ci`.
- Runs `typecheck`, `build`, and `verify:format`.
- Builds only `electron-builder --linux zip --x64 --publish never`.
- Uploads `release/*.zip` and `release/checksums-linux-x64.txt` as a workflow artifact.
- Uploads the same files to the matching GitHub Release on tag-triggered runs.

The workflow intentionally does not run `verify:unity` because GitHub-hosted
Linux runners do not provide the project Unity editor by default. Unity runtime
and importer validation remains covered by the existing local or dedicated
Unity smoke flow.

No AppImage, deb, rpm, Snap, auto-updater, code-signing, or external deployment
server is configured for the Linux ZIP path.

## GitHub Actions Signed Linux Release

Workflow:

```text
.github/workflows/release-linux.yml
```

Behavior:

- Runs automatically on tag pushes matching `v*`.
- Uses Node.js 22 and `npm ci`.
- Runs `typecheck`, optional `lint`, and optional `test`.
- Builds `electron-builder --linux AppImage tar.gz --x64 --publish never`.
- Creates `release/checksums.txt` for Linux AppImage and tar.gz artifacts.
- Imports the private signing key from `GPG_PRIVATE_KEY_B64`.
- Signs the checksum manifest as `release/checksums.txt.asc`.
- Imports `suwol-release-public-key.asc` and verifies the detached signature.
- Runs `sha256sum -c checksums.txt`.
- Uploads Linux artifacts, checksums, signature, and public key to the matching
  GitHub Release.

Required GitHub Secrets:

```text
GPG_PRIVATE_KEY_B64
GPG_PASSPHRASE
```

The private key, revocation certificate, and passphrase must never be committed
to the repository. The public key is intentionally committed as
`suwol-release-public-key.asc`.

## Unity Package Distribution

The Unity package remains under:

```text
unity/com.suwol.suwol2d/
```

Install from disk in Unity Package Manager by selecting:

```text
unity/com.suwol.suwol2d/package.json
```

Create a standalone package zip:

```powershell
npm.cmd run release:unity-package
```

Output:

```text
release/com.suwol.suwol2d-0.12.0.zip
```

The zip includes package metadata, Runtime, Editor, Samples~, Documentation~,
and package README files. It excludes Unity project caches such as Library,
Temp, obj, generated project files, and solution files.

## Release Artifacts

Expected release folder:

```text
release/
  win-unpacked/
  Suwol 2D Animator-0.12.0-portable.exe
  Suwol 2D Animator Setup 0.12.0.exe
  Suwol 2D Animator-0.12.0-linux-x64.zip
  Suwol 2D Animator-0.12.0-linux-x64.AppImage
  Suwol 2D Animator-0.12.0-linux-x64.tar.gz
  com.suwol.suwol2d-0.12.0.zip
  checksums.txt
  checksums.txt.asc
  checksums-linux-x64.txt
```

Actual Electron artifact names may vary by target and electron-builder version.

## Packaged App Resource Notes

Runtime sample textures are resolved from packaged `process.resourcesPath`
first, then development fallbacks. The renderer still uses main IPC for file
operations; direct renderer filesystem access is not introduced.

Packaged resource paths shown in the About panel:

```text
resources/docs
resources/unity/com.suwol.suwol2d
```

## Troubleshooting

- If `verify:unity` skips, set `UNITY_EXE` or install Unity through Unity Hub.
- If NSIS artifacts are missing, run `npm.cmd run dist:win:nsis`.
- If checksum generation fails, ensure `release/` contains `.exe`, `.zip`, or
  other release artifacts.
- If sample textures fail in a packaged build, confirm `extraResources` copied
  `unity/com.suwol.suwol2d/Samples~/`.
- If public distribution is planned, complete third-party license review and
  code signing setup first.
- If the Linux ZIP workflow fails during package upload, confirm the build
  produced `release/Suwol 2D Animator-0.12.0-linux-x64.zip`.
- If the signed Linux release workflow fails during signing, confirm
  `GPG_PRIVATE_KEY_B64` is base64-encoded armored private key text and
  `GPG_PASSPHRASE` matches the key.
- If signature verification fails, confirm `suwol-release-public-key.asc`
  matches the private release key stored in GitHub Secrets.
- If a manual workflow run should upload to a GitHub Release, set
  `upload_to_github_release` to `true` and ensure a matching release exists.
- If localized UI text is missing in a packaged build, run
  `npm.cmd run verify:locales`; locale JSON is bundled through renderer imports
  and should not require an extra `extraResources` entry.

## Checklist

Use:

```text
docs/release-checklist-v12.md
```
