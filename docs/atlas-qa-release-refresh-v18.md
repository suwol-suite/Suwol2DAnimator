# Atlas QA / Release Artifact Refresh v18

## Purpose

Validate v17 atlas export and Unity atlas import behavior before refreshing
release artifacts.

## Scope

- Atlas export from packaged app
- Atlas PNG/JSON generation
- `.suwol2d` `atlases` data verification
- Unity importer atlas texture lookup
- Region attachment atlas UV remap
- Mesh attachment atlas UV remap
- Fallback to individual textures when atlas is disabled
- Release artifact rebuild after atlas validation

## Manual QA Checklist / Electron

- Start packaged app
- Create Skin Sample or Animation Timelines Sample
- Enable atlas export
- Export `.suwol2d`
- Confirm `Atlas/character.atlas.png`
- Confirm `Atlas/character.atlas.json`
- Confirm `.suwol2d` includes `atlases`
- Confirm `Textures/` fallback files still exist
- Disable atlas export and confirm legacy texture export still works

## Manual QA Checklist / Unity

- Import Unity package
- Copy exported folder into Unity Assets
- Select `.suwol2d`
- Confirm importer report has atlas info
- Confirm generated prefab
- Enter Play Mode
- Confirm region attachments render correctly
- Confirm mesh attachments render correctly
- Confirm skin swap still works
- Confirm animation timelines still work
- Confirm no missing texture warning
- Confirm fallback works when atlas data is removed

## Automated Checks

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd audit`
- `npm.cmd run verify:format`
- `npm.cmd run verify:locales`
- `npm.cmd run verify:unity`
- `npm.cmd run release:check`
- `npm.cmd run dist:win:dir`
- `npm.cmd run smoke:packaged`

## Release Refresh Checklist

- Rebuild Windows dir
- Rebuild portable
- Rebuild NSIS
- Rebuild Unity package zip
- Regenerate checksums
- Do not create tag unless explicitly instructed
- Do not upload GitHub Release unless explicitly instructed

## Known Restrictions

- No rotate packing
- No trim packing
- No multi-page atlas
- No Spine compatibility
