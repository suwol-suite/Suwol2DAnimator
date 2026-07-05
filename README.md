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

Out of scope for this release: Spine import/export/runtime compatibility,
clipping, atlas packing, brush weight/deform painting, animation layers, blend
trees, additive animation, telemetry, auto-updater, and licensing/payment
systems.

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

GitHub Actions builds the Linux PC ZIP package with:

```text
Actions > Release Linux ZIP
```

The workflow can be run manually, and it also runs automatically when a
`v*.*.*` tag is pushed. It uploads the Linux x64 ZIP and checksum file as a
workflow artifact. Tag-triggered runs also upload the ZIP and checksum to the
matching GitHub Release.

Expected artifact names:

```text
release/Suwol 2D Animator-0.12.0-linux-x64.zip
release/checksums-linux-x64.txt
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

The Linux workflow intentionally builds only the ZIP target. It does not build
AppImage, deb, rpm, Snap, auto-updater metadata, or code-signing assets.

## Localization

The Electron editor supports Korean and English:

```text
default locale: ko
fallback locale: en
settings: userData/settings.json
```

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
6. Import with the `com.suwol.suwol2d` UPM package installed.

## Release Documents

- `docs/release-checklist-v12.md`
- `docs/packaging-release-readiness-v12.md`
- `docs/manual-qa-dogfooding-v13.md`
- `docs/manual-qa-results-v13.md`
- `docs/hotfix-candidates-0.12.1.md`
- `docs/localization-i18n-v15.md`
- `unity/com.suwol.suwol2d/Documentation~/index.md`
- `unity/com.suwol.suwol2d/Documentation~/packaging-release-readiness-v12.md`

## License

Current repository status: `UNLICENSED / Internal development build`.

See:

- `LICENSE`
- `THIRD-PARTY-NOTICES.md`
