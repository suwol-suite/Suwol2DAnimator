# Suwol 2D Animator

Suwol 2D Animator is a standalone Electron editor for 2D skeletal and mesh
animation data, developed together with its Unity UPM runtime/importer package
in the same repository.

Current release readiness version: `0.12.0`.

## Repository Layout

```text
Suwol2DAnimator/
  package.json
  src/
  assets/
  docs/
  samples/
  unity/
    com.suwol.suwol2d/
      package.json
      Runtime/
      Editor/
      Samples~/
      Documentation~/
```

Unity code is not a separate Unity project. It is maintained as the UPM package
under `unity/com.suwol.suwol2d/`.

## Supported Features

- Region attachments
- Mesh attachments
- Weighted mesh deformation
- Deform timelines
- 2-bone IK constraints
- Skins and slot attachment swaps
- Attachment, draw order, slot color, and event timelines
- Unity `.suwol2d` importer and prefab workflow
- Runtime stability checks and Unity smoke tests
- Single-layer animation mixing
- Simple bool/trigger state machines
- Timeline key editing, snap, copy/paste, duplicate, filters, and explicit duration
- Keyframe interpolation presets for transform, slot color, and deform timelines
- Canvas vertex selection/move plus weight and deform brush editing
- Optional PNG texture atlas export with Unity atlas UV fallback
- Convex polygon clipping attachments and masks

Out of scope for this release: Spine import/export/runtime compatibility,
concave clipping, rotated/trimmed/multi-page atlases, custom bezier handles,
graph curve editing, animation layers, blend trees, additive animation,
telemetry, Windows/macOS auto-updaters, and
licensing/payment systems.

## Install And Run

```powershell
npm.cmd install
npm.cmd run dev
```

## Development Checks

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
npm.cmd run verify:locales
npm.cmd run verify:unity
```

`verify:unity` runs a temporary Unity project smoke test when Unity is installed
or `UNITY_EXE` is set. If Unity is unavailable, the script reports a clear skip.

## Windows Packaging

Generate icons when needed:

```powershell
npm.cmd run icons:generate
```

Build Electron release artifacts:

```powershell
npm.cmd run release:check
npm.cmd run dist:win:dir
npm.cmd run dist:win:portable
npm.cmd run dist:win:nsis
npm.cmd run release:checksums
```

The Electron build output is written to:

```text
release/
  win-unpacked/
  Suwol 2D Animator-0.12.0-portable.exe
  Suwol 2D Animator Setup 0.12.0.exe
  checksums.txt
```

Actual filenames may vary slightly by `electron-builder` target.

Run a local packaged smoke test after `dist:win:dir`:

```powershell
npm.cmd run smoke:packaged
```

## Linux ZIP Distribution

GitHub Actions keeps a lightweight Linux PC ZIP package workflow with:

```text
Actions > Release Linux ZIP
```

The workflow can be run manually, and it also runs automatically when a
`v*.*.*` tag is pushed. It uploads the Linux x64 ZIP, checksum file, and Linux
update manifest as a workflow artifact. Tag-triggered runs also upload the ZIP,
checksum, and update manifest to the matching GitHub Release.

Expected artifact names:

```text
release/Suwol 2D Animator-0.12.0-linux-x64.zip
release/checksums-linux-x64.txt
release/suwol2d-linux-x64-update.json
```

Create a tag release:

```powershell
git tag v0.12.0
git push origin v0.12.0
```

Local Linux ZIP build command:

```powershell
npm.cmd run dist:linux:zip
```

The ZIP workflow intentionally builds only the ZIP target plus checksum and
Linux ZIP update manifest. It does not build AppImage, deb, rpm, Snap, Windows
or macOS updater metadata, or code-signing assets.

## Signed Linux Release

GitHub Actions builds the signed Linux release bundle with:

```text
Actions > Release Linux
```

The workflow runs automatically when a `v*` tag is pushed. It builds Linux
AppImage and tar.gz artifacts, writes `release/checksums.txt`, creates the GPG
detached signature `release/checksums.txt.asc`, verifies the signature with the
repository public key, verifies SHA-256 checksums, then uploads the artifacts to
the matching GitHub Release.

Required GitHub repository or organization secrets:

```text
GPG_PRIVATE_KEY_B64
GPG_PASSPHRASE
```

The public verification key is stored in this repository:

```text
suwol-release-public-key.asc
```

Do not commit private keys, revocation certificates, or passphrases.

Local Linux AppImage/tar.gz build command:

```powershell
npm.cmd run dist:linux
```

To verify a downloaded signed release bundle, put the Linux artifacts,
`checksums.txt`, `checksums.txt.asc`, and `suwol-release-public-key.asc` in the
same directory. Import the public key, verify the signed checksum manifest, then
verify the downloaded files:

```bash
gpg --import suwol-release-public-key.asc
gpg --verify checksums.txt.asc checksums.txt
sha256sum -c checksums.txt
```

On macOS, use `shasum` for the checksum step:

```bash
shasum -a 256 -c checksums.txt
```

The GPG step confirms that `checksums.txt` was signed by the Suwol release key.
The checksum step confirms that the downloaded artifacts match the signed
SHA-256 entries.

## Localization

The Electron editor supports Korean and English:

```text
default locale: ko
fallback locale: en
settings: userData/settings.json
```

Startup locale priority is saved settings, then Korean OS locale detection,
then English fallback. If OS locale detection is unavailable and no settings
exist, the editor starts in Korean.

The in-app UI and Electron native menu follow the selected app language.
Production packaged builds hide development-only reload and developer tools
menu items. User-authored project data names are not auto-translated, and
OS-owned file dialogs/security prompts remain outside the app localization
scope.

Verify locale files:

```powershell
npm.cmd run verify:locales
```

See:

```text
docs/localization-i18n-v15.md
```

Unity package menu and inspector localization is deferred.

## Unity UPM Package

Unity Package Manager:

```text
Add package from disk
select unity/com.suwol.suwol2d/package.json
```

Package metadata:

```text
name: com.suwol.suwol2d
displayName: Suwol 2D Animator Runtime
version: 0.12.0
unity: 6000.0
```

Create a standalone UPM zip:

```powershell
npm.cmd run release:unity-package
```

Output:

```text
release/com.suwol.suwol2d-0.12.0.zip
```

## Export / Import Workflow

1. Create or open an Electron editor project.
2. Create a sample or import textures and edit data.
3. Export `.suwol2d` for the Unity importer.
4. Export `.suwol2d.json` when a readable debug JSON is needed.
5. Copy the exported asset and `Textures/` folder into a Unity project.
6. Optionally enable Atlas export to create `Atlas/*.atlas.png` and `Atlas/*.atlas.json`.
7. Import with the `com.suwol.suwol2d` UPM package installed.

Atlas export is optional. Existing individual texture export remains the
fallback path, and Unity uses atlas regions only when an attachment image name
matches a region in the `.suwol2d` `atlases` array.

Clipping export uses `type: "clipping"` and `clippingVertices`. v21 supports
convex polygon masks only. A clipping attachment masks subsequent draw-order
slots through `endSlot`, or through the end of draw order when `endSlot` is not
set.

## Linux ZIP Auto Update

Linux ZIP builds can check public GitHub Releases for
`suwol2d-linux-x64-update.json`, download the matching
`Suwol 2D Animator-<version>-linux-x64.zip`, verify SHA256, and stage the
update under app user data. Install and restart is enabled only for packaged
Linux apps when the install folder is writable; otherwise the verified ZIP stays
available for manual replacement.

Manual `workflow_dispatch` runs are artifact verification only. Tag push release
runs include the ZIP, `checksums-linux-x64.txt`, and
`suwol2d-linux-x64-update.json` as GitHub Release assets.

## Release Documents

- `docs/release-checklist-v12.md`
- `docs/packaging-release-readiness-v12.md`
- `docs/manual-qa-dogfooding-v13.md`
- `docs/manual-qa-results-v13.md`
- `docs/hotfix-candidates-0.12.1.md`
- `docs/localization-i18n-v15.md`
- `docs/brush-editing-canvas-direct-editing-v16.md`
- `docs/atlas-packing-texture-atlas-v17.md`
- `docs/atlas-qa-release-refresh-v18.md`
- `docs/atlas-qa-results-v18.md`
- `docs/linux-zip-auto-update-v19.md`
- `docs/curve-interpolation-editor-v20.md`
- `docs/clipping-mask-v21.md`
- `unity/com.suwol.suwol2d/Documentation~/index.md`
- `unity/com.suwol.suwol2d/Documentation~/packaging-release-readiness-v12.md`
- `unity/com.suwol.suwol2d/Documentation~/atlas-packing-texture-atlas-v17.md`
- `unity/com.suwol.suwol2d/Documentation~/curve-interpolation-editor-v20.md`
- `unity/com.suwol.suwol2d/Documentation~/clipping-mask-v21.md`

## License

Suwol 2D Animator is licensed under the Apache License 2.0.

See [LICENSE](LICENSE) for details.

See:

- `LICENSE`
- `THIRD-PARTY-NOTICES.md`
