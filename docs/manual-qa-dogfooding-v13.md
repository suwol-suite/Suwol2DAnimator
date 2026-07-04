# Manual QA / Dogfooding Pass v13

Version under QA: `0.12.0`

This pass verifies release artifacts and real user workflows. It does not add
new animation features.

## Do Not Add In v13

- Spine import/export/runtime compatibility
- New timeline types
- New constraints
- Atlas packing
- Clipping
- Brush weight/deform painting
- Animation layers, blend trees, or additive animation
- Full UI redesign
- Code signing certificates, secrets, auto updater, telemetry, or licensing
- A separate Unity project inside this repository

## Required Artifacts

Confirm these exist and are non-empty:

```text
release/win-unpacked/
release/win-unpacked/Suwol 2D Animator.exe
release/Suwol 2D Animator-0.12.0-portable.exe
release/Suwol 2D Animator Setup 0.12.0.exe
release/Suwol 2D Animator Setup 0.12.0.exe.blockmap
release/Suwol 2D Animator-0.12.0-linux-x64.zip
release/com.suwol.suwol2d-0.12.0.zip
release/checksums.txt
release/checksums-linux-x64.txt
```

`checksums.txt` should list the portable executable, installer executable,
installer blockmap, Unity package zip, `win-unpacked` executable, and
`win-unpacked/resources/elevate.exe`.

`checksums-linux-x64.txt` should list the Linux x64 ZIP from the GitHub Actions
workflow, or the ZIP created after a local `npm.cmd run dist:linux:zip` run.

## Packaged App Smoke

Run:

```powershell
npm.cmd run smoke:packaged
```

This checks:

- `release/win-unpacked/Suwol 2D Animator.exe`
- non-empty executable
- app launch for a short window
- clean termination by the smoke script
- packaged `resources/unity/com.suwol.suwol2d`
- packaged `resources/docs`
- packaged README, LICENSE, and third-party notices

Portable executable smoke:

```powershell
npm.cmd run smoke:packaged -- "release/Suwol 2D Animator-0.12.0-portable.exe"
```

For the portable single-file target, resource-folder checks may be skipped
because resources are embedded in the executable.

## Linux ZIP Workflow QA

Workflow:

```text
.github/workflows/release-linux-zip.yml
```

Confirm:

- Manual `workflow_dispatch` run succeeds.
- Artifact `suwol-2d-animator-linux-x64-zip` is uploaded.
- Artifact includes `Suwol 2D Animator-0.12.0-linux-x64.zip`.
- Artifact includes `checksums-linux-x64.txt`.
- Tag push such as `v0.12.0` runs the workflow automatically.
- Tag-triggered run uploads ZIP and checksum files to the GitHub Release.
- Workflow does not build AppImage, deb, rpm, Snap, updater metadata, or signing assets.
- Workflow does not require `verify:unity`.

## Dogfood Workspace

Create QA projects outside the repository:

```text
%TEMP%\suwol2d-dogfood-v13\
```

Do not create QA Unity projects or editor projects inside
`C:\Project\Suwol2DAnimator`.

## Electron Packaged App QA

Preferred order:

1. `release/win-unpacked/Suwol 2D Animator.exe`
2. `release/Suwol 2D Animator-0.12.0-portable.exe`
3. Optional NSIS installer

### Basic Project

1. Launch packaged app.
2. New Project.
3. Choose `%TEMP%\suwol2d-dogfood-v13\`.
4. Name project `DogfoodBasic`.
5. Save.
6. Close app.
7. Reopen app.
8. Open `DogfoodBasic/project.suwol2dproj.json`.
9. Confirm dirty-state prompts only appear after edits.
10. Confirm `.backups/` is created after dirty project backup delay.

### Samples

Create and inspect each sample:

- Region Sample
- Mesh Sample
- Weighted Sample
- Deform Sample
- IK Sample
- Skin Sample
- Animation Timelines Sample
- Mixing State Sample
- Timeline Editing Sample

For each sample:

- Preview renders.
- Play/Stop works.
- Scrubber updates preview.
- Timeline key list appears when keys exist.
- Validation panel has no blocking errors.
- Export `.suwol2d`.
- Export `.suwol2d.json`.
- `Textures/` is copied next to the exported asset.

## Export QA

Expected export layout:

```text
exports/
  character.suwol2d
  character.suwol2d.json
  Textures/
    *.png
```

Confirm:

- `.suwol2d` parses as JSON.
- `.suwol2d.json` parses as JSON.
- The two JSON structures match when exported for the same sample.
- Attachment `image` values match copied texture filenames by normalized name.
- Export status message is clear.
- Validation errors block export.
- Warnings are documented in QA results.

## Unity Package Zip QA

Use:

```text
release/com.suwol.suwol2d-0.12.0.zip
```

Manual steps:

1. Extract zip under `%TEMP%\suwol2d-dogfood-v13\com.suwol.suwol2d-0.12.0\`.
2. Open Unity Package Manager.
3. Add package from disk.
4. Select extracted `package.json`.
5. Confirm package imports.
6. Confirm Samples list includes Timeline Usability v11.
7. Confirm Documentation files exist.

Automated release zip smoke:

```powershell
npm.cmd run verify:unity:release
```

## Unity Importer QA

Use Unity `6000.5.2f1` or set `UNITY_EXE`.

1. Create a temporary Unity project under `%TEMP%`.
2. Install the extracted release package zip with Add package from disk.
3. Copy an exported `.suwol2d` and its `Textures/` folder into `Assets/`.
4. Reimport.
5. Confirm a generated prefab appears.
6. Confirm prefab has `Suwol2DCharacter`.
7. Confirm import report has no errors.
8. Place prefab in a scene.
9. Enter Play Mode.

Confirm:

- No missing texture warnings for sample assets.
- Material is assigned.
- Renderers are created.
- Animation list is available.
- Skin list is available when skins exist.
- State machine count is available for v10 sample.
- Reimport does not duplicate generated subassets.

## Runtime API QA

Confirm these APIs in Play Mode or batch smoke:

```csharp
LoadFromJson(string json)
LoadFromData(Suwol2DAssetData data)
Play("idle")
Play("walk")
Play("walk", 0.2f)
CrossFade("attack", 0.1f)
SetSkin("armor_01")
SetAttachment("weapon_slot", "sword")
ResetAttachments()
PlayStateMachine("default")
SetBool("moving", true)
SetTrigger("attack")
```

Also confirm:

- Missing animation returns false or logs a clear warning.
- Missing skin returns false or logs a clear warning.
- Missing attachment returns false or logs a clear warning.
- Stop does not dispatch stale events.
- CrossFade transition progress advances.
- State machine transitions occur.
- No NaN transforms.
- Renderer count does not grow without bound.

## Documentation QA

Read in this order:

1. `README.md`
2. `docs/packaging-release-readiness-v12.md`
3. `docs/release-checklist-v12.md`
4. `docs/unity-importer-prefab-workflow-v7.md`
5. `docs/animation-mixing-state-machine-v10.md`
6. `docs/editor-timeline-usability-key-editing-v11.md`

Check:

- Commands match `package.json`.
- Paths exist.
- Artifact names match `release/`.
- Unity zip instructions match actual zip structure.
- `.suwol2d` and `.suwol2d.json` difference is clear.
- Code signing status is clear.
- No unsupported Spine compatibility claim appears.

## Result Logging

Record outcomes in:

```text
docs/manual-qa-results-v13.md
```

Potential hotfixes go in:

```text
docs/hotfix-candidates-0.12.1.md
```
