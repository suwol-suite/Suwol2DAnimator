# Release Checklist v12

Target version: `0.12.0`

## Version And Metadata

- [ ] Root `package.json` version is `0.12.0`.
- [ ] Root `package.json` name is `suwol-2d-animator`.
- [ ] Unity package `unity/com.suwol.suwol2d/package.json` version is `0.12.0`.
- [ ] Unity package displayName is `Suwol 2D Animator Runtime`.
- [ ] About panel shows app and Unity package version.
- [ ] `LICENSE` and `THIRD-PARTY-NOTICES.md` are present.
- [ ] Code signing status is documented. Current v12 status: no signing configuration or certificate is stored in this repository.

## Required Verification

```powershell
npm.cmd install
npm.cmd run icons:generate
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
npm.cmd run verify:locales
npm.cmd run verify:unity
```

## Localization Smoke

- [ ] `npm.cmd run verify:locales` passes.
- [ ] App starts in Korean when no app setting exists.
- [ ] Language selector switches to English without restart.
- [ ] Selected language persists after app restart.
- [ ] Toolbar, panels, timeline, validation, export/status, and about messages follow the selected language.
- [ ] Unity package menu and inspector localization remains deferred for v15.

## Release Build

```powershell
npm.cmd run release:check
npm.cmd run dist:win:dir
npm.cmd run dist:win:portable
npm.cmd run dist:win:nsis
npm.cmd run dist:linux:zip
npm.cmd run release:unity-package
npm.cmd run release:checksums
```

## Linux ZIP GitHub Actions

- [ ] `.github/workflows/release-linux-zip.yml` exists.
- [ ] Workflow `Release Linux ZIP` is visible in GitHub Actions.
- [ ] Manual `workflow_dispatch` run creates the Linux x64 ZIP artifact.
- [ ] `release/checksums-linux-x64.txt` is included in the workflow artifact.
- [ ] Tag push `v*.*.*` runs the workflow automatically.
- [ ] Tag-triggered run uploads ZIP and checksum files to the GitHub Release.
- [ ] Workflow builds only ZIP, not AppImage, deb, rpm, Snap, or updater assets.
- [ ] Unity smoke checks are not required in this Linux ZIP workflow.

## Packaged App Smoke

- [ ] `release/win-unpacked/Suwol 2D Animator.exe` exists.
- [ ] `npm.cmd run smoke:packaged` passes.
- [ ] App opens without missing resource errors.
- [ ] Create a new project.
- [ ] Create Timeline Editing Sample.
- [ ] Save project.
- [ ] Export `.suwol2d`.
- [ ] Export `.suwol2d.json`.
- [ ] Confirm exported `Textures/` exists.
- [ ] Confirm backups are created after dirty project delay.

## Unity Importer Smoke

- [ ] Install `unity/com.suwol.suwol2d/package.json` with Add package from disk.
- [ ] Import `Samples~/TimelineUsabilityV11/sample_timeline_editing.suwol2d`.
- [ ] Confirm generated prefab has `Suwol2DCharacter`.
- [ ] Confirm import report has no errors.
- [ ] Confirm sample textures resolve.
- [ ] Confirm explicit animation durations are preserved.

## Release Artifacts

- [ ] `release/win-unpacked/`
- [ ] Portable `.exe`
- [ ] Optional NSIS setup `.exe`
- [ ] Linux x64 `.zip`
- [ ] `release/checksums-linux-x64.txt`
- [ ] `release/com.suwol.suwol2d-0.12.0.zip`
- [ ] `release/checksums.txt`
- [ ] No temporary Unity smoke project remains.
- [ ] No `_unity-package-staging` folder remains.

## Notes

- Do not add signing certificates or secrets to the repository.
- Do not claim Spine compatibility.
- Do not create a separate Unity project repository.
- Keep Electron editor and Unity UPM package in this repository.
- Keep Linux distribution scoped to ZIP until another target is explicitly planned.
