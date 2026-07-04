# Manual QA Results v13

Version under QA: `0.12.0`

Date: 2026-07-04  
Workspace: `C:\Project\Suwol2DAnimator`

Status values: `PASS`, `FAIL`, `BLOCKED`, `SKIPPED`

## Summary

| Area | PASS | FAIL | BLOCKED | SKIPPED |
| --- | ---: | ---: | ---: | ---: |
| Automated checks | 6 | 0 | 0 | 0 |
| Release artifacts | 2 | 0 | 0 | 0 |
| Packaged app smoke | 2 | 0 | 0 | 0 |
| Unity release package smoke | 1 | 0 | 0 | 0 |
| Manual UI dogfood | 0 | 0 | 0 | 4 |

## Results

| ID | Area | Scenario | Expected | Result | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| V13-AUTO-001 | Automated checks | `npm.cmd run typecheck` | TypeScript passes | Passed | PASS | Also covered by `release:check`. |
| V13-AUTO-002 | Automated checks | `npm.cmd run build` | Electron/Vite build passes | Passed | PASS | Main, preload, and renderer production build completed. |
| V13-AUTO-003 | Automated checks | `npm.cmd audit` | 0 vulnerabilities | Passed | PASS | `found 0 vulnerabilities`. |
| V13-AUTO-004 | Automated checks | `npm.cmd run verify:format` | Format/sample/release metadata pass | Passed | PASS | v0-v11 samples and v13 doc metadata checks passed. |
| V13-AUTO-005 | Automated checks | `npm.cmd run verify:unity` | Unity smoke passes or clearly skips | Passed | PASS | Unity `6000.5.2f1`; temp project deleted on final run. |
| V13-AUTO-006 | Automated checks | `npm.cmd run release:check` | Aggregated release check passes | Passed | PASS | typecheck, build, audit, verify:format, verify:unity all passed. |
| V13-REL-001 | Release artifacts | Required files exist and are non-empty | All expected release artifacts present | Passed | PASS | Verified `win-unpacked`, portable exe, setup exe, blockmap, Unity zip, checksums. |
| V13-REL-002 | Release artifacts | `release/checksums.txt` | Checksums list key artifacts | Passed | PASS | 6 checksum entries include portable, setup, blockmap, Unity zip, win-unpacked exe, elevate.exe. |
| V13-PKG-001 | Packaged app smoke | `npm.cmd run smoke:packaged` | win-unpacked app launches and resources exist | Passed | PASS | Resources verified: Unity package, docs, README, LICENSE, third-party notices; app launched for 8000ms. |
| V13-PKG-002 | Packaged app smoke | `npm.cmd run smoke:packaged -- "release\Suwol 2D Animator-0.12.0-portable.exe"` | Portable exe launches | Passed | PASS | Resource-folder check skipped as expected for single-file portable target; app launched for 8000ms. |
| V13-UNITY-001 | Unity package zip | `npm.cmd run verify:unity:release` | Release zip extracts and Unity smoke passes | Passed | PASS | Zip extracted under temp; package installed by file dependency; Unity smoke passed; temp project deleted. |
| V13-MAN-001 | Manual UI dogfood | New Project / Save / Open | Packaged app project workflow works | Not executed by automation | SKIPPED | Requires interactive desktop QA under `%TEMP%\suwol2d-dogfood-v13\`. |
| V13-MAN-002 | Manual UI dogfood | All sample buttons | Samples render, play, scrub, validate, export | Not executed by automation | SKIPPED | Requires interactive click-through of sample buttons and export dialogs. |
| V13-MAN-003 | Manual Unity QA | UPM zip Add package from disk | Package appears with docs and samples | Covered by release smoke where possible | SKIPPED | Manual Package Manager visual confirmation still recommended. |
| V13-MAN-004 | Manual Unity QA | Scene Play Mode API checks | Play/CrossFade/SetSkin/SetAttachment/StateMachine work | Covered by Unity smoke where possible | SKIPPED | Manual scene visual confirmation still recommended. |

## Release Artifacts Observed

```text
release/win-unpacked/Suwol 2D Animator.exe
release/Suwol 2D Animator-0.12.0-portable.exe
release/Suwol 2D Animator Setup 0.12.0.exe
release/Suwol 2D Animator Setup 0.12.0.exe.blockmap
release/com.suwol.suwol2d-0.12.0.zip
release/checksums.txt
```

## Temporary Project Cleanup

- Final `verify:unity` run deleted its temporary project.
- Final `verify:unity:release` run deleted its temporary project.
- An earlier Unity smoke run left a locked log file temporarily; it was deleted successfully after the lock released.
- Dogfood editor/Unity projects should be created under `%TEMP%\suwol2d-dogfood-v13\`, not inside this repository.

## Notes

- Code signing certificates and secrets are not stored in this repository.
- Windows SmartScreen/signing warnings may appear for local release artifacts; record them during interactive QA if seen.
- No unsupported Spine compatibility claim was added during v13.
- No `0.12.1` version bump was made.
