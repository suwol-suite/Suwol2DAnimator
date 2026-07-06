# Hotfix Candidates 0.12.1

Current release under QA: `0.12.0`

Last reviewed during v18 atlas QA / release artifact refresh: 2026-07-06

This document tracks issues found during release QA passes that may justify a
`0.12.1` hotfix. Do not bump versions in this document alone.
Actual `0.12.1` version changes should happen only after an explicit release
decision.

## Candidates

| Priority | Issue | Impact | Suggested Fix | Status |
| --- | --- | --- | --- | --- |
| None | No blocking 0.12.1 hotfix candidate identified during automated v13 checks. | No known release-blocking impact. | Continue interactive manual dogfooding and add candidates here if found. | Open |
| None | No atlas release blocker found by v18 automated validation. | v17 atlas export/import did not reveal a release blocker in automated, file-level, or Unity smoke checks. | Manual visual Unity Play Mode QA is still recommended before public release. | Open |

## Watchlist

| Priority | Issue | Impact | Suggested Fix | Status |
| --- | --- | --- | --- | --- |
| P3 | Windows local builds are not configured with repository-stored signing certificates. | Users may see OS trust warnings for unsigned or locally signed artifacts. | Keep signing out of repo; configure external signing only in a secure release environment. | Documented |
| P3 | Interactive UI dogfood is still recommended after automated smoke. | Automated checks do not verify every visual workflow or every manual click path. | Run `docs/manual-qa-dogfooding-v13.md` and update `docs/manual-qa-results-v13.md`. | Open |

## Candidate Template

| Priority | Issue | Impact | Suggested Fix | Status |
| --- | --- | --- | --- | --- |
| P1/P2/P3 | Short issue title | User/release impact | Concrete fix plan | Open/In Progress/Fixed/Deferred |
