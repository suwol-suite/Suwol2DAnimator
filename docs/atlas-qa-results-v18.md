# Atlas QA Results v18

## Summary

- Date: 2026-07-06
- Version: 0.12.0
- Commit: 8ccbf9d
- Result: PASS
- Tag created: NO
- GitHub Release uploaded: NO
- Linux ZIP GitHub Actions manual dispatch: SKIPPED
- Linux ZIP skip reason: gh CLI/auth verification is handled separately.

## Automated Checks

| Check | Result | Notes |
| --- | --- | --- |
| typecheck | PASS | `npm.cmd run typecheck` |
| build | PASS | `npm.cmd run build` |
| audit | PASS | `npm.cmd audit`; 0 vulnerabilities |
| verify:format | PASS | Atlas sample regions verified: arm, body |
| verify:locales | PASS | ko/en locale keys verified |
| verify:unity | PASS | Unity smoke passed with local package path |
| verify:unity:release | PASS | Unity smoke passed with rebuilt package zip |
| release:check | PASS | Includes typecheck, build, audit, format, locales, Unity smoke |
| dist:win:dir | PASS | Rebuilt `release/win-unpacked` |
| smoke:packaged | PASS | Packaged app launched for smoke window |
| dist:win:portable | PASS | Rebuilt portable exe |
| dist:win:nsis | PASS | Rebuilt NSIS installer and blockmap |
| release:unity-package | PASS | Rebuilt `release/com.suwol.suwol2d-0.12.0.zip` |
| release:checksums | PASS | Rebuilt `release/checksums.txt` with 9 checksums |

## Atlas Export QA

| Scenario | Result | Notes |
| --- | --- | --- |
| Atlas export enabled | PASS | File-level dogfood export created under `%TEMP%/suwol2d-atlas-dogfood-v18` |
| Atlas PNG generated | PASS | `Atlas/character.atlas.png`; size > 0 |
| Atlas JSON generated | PASS | `Atlas/character.atlas.json`; JSON matches `.suwol2d` atlas metadata |
| `.suwol2d` contains `atlases` | PASS | Parsed and validated with shared document validation |
| `Textures/` fallback still generated | PASS | body, arm, sword, axe fallback PNGs copied |
| Atlas export disabled fallback | PASS | Legacy export omitted `atlases` and kept `Textures/` assets |

## Unity Atlas Import QA

| Scenario | Result | Notes |
| --- | --- | --- |
| `.suwol2d` import | PASS | Verified by `verify:unity` and `verify:unity:release` smoke |
| Import report atlas info | PASS | Importer atlas validation/report markers covered by format and Unity smoke checks |
| Generated prefab | PASS | Unity smoke passed prefab/import workflow |
| Region UV remap | PASS | Runtime atlas lookup and region renderer paths covered by smoke/API checks |
| Mesh UV remap | PASS | Runtime atlas lookup and mesh renderer paths covered by smoke/API checks |
| Skin swap with atlas | PASS | Skin/runtime APIs covered by Unity smoke |
| Animation timelines with atlas | PASS | Timeline samples and runtime smoke passed |
| No missing texture warnings | PASS | Unity smoke completed without failing on texture lookup |
| Individual texture fallback | PASS | File-level atlas-off export and Unity fallback code paths verified |

## Manual / Visual QA

| Scenario | Result | Notes |
| --- | --- | --- |
| Packaged app click-through | SKIPPED | Automated environment used packaged smoke plus file-level export validation instead of direct UI clicks |
| Unity Play Mode visual check | SKIPPED | Unity automated smoke passed; manual visual Play Mode QA is still recommended before public release |

## Release Artifacts

| Artifact | Result | Notes |
| --- | --- | --- |
| win-unpacked | PASS | `release/win-unpacked/Suwol 2D Animator.exe`; size > 0 |
| portable exe | PASS | `release/Suwol 2D Animator-0.12.0-portable.exe`; size > 0 |
| NSIS installer | PASS | `release/Suwol 2D Animator Setup 0.12.0.exe`; size > 0 |
| Unity package zip | PASS | `release/com.suwol.suwol2d-0.12.0.zip`; size > 0 |
| checksums.txt | PASS | All 9 checksum entries rehashed and verified locally |
| Linux ZIP GitHub Actions artifact | SKIPPED | Manual dispatch was not run in v18; gh CLI/auth verification is handled separately |

## Issues Found

- None.

## Hotfix Candidates

- No atlas release blocker found by v18 automated validation.
- Manual visual Unity Play Mode QA is still recommended before public release.
