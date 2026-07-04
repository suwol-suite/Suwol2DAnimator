# Editor Timeline Usability / Key Editing v11

v11 focuses on making the Electron editor timeline practical for repeated key editing. It does not add Spine compatibility, IK expansion, mesh weight painting, graph curves, blend trees, or new Unity project structure.

## Scope

- Timeline transport now exposes animation selection, current time, explicit duration, playback speed, loop, snap, snap step, key filtering, and key search.
- Animation duration is an optional `duration` field on `Suwol2DAnimation`. Values greater than zero are exported and used by preview/runtime playback; missing or zero duration falls back to the last key time.
- The key browser lists bone translate/rotate/scale, deform, attachment, draw order, slot color, and event keys sorted by time.
- Selected keys can be copied, pasted, duplicated, deleted, and edited through a selected key inspector.
- Snap defaults to enabled with a `0.05` second step. It is applied to scrubbed time, key creation, pasted/duplicated key time, and key time edits.
- Preview playback clamps or wraps by effective duration and guards against non-finite speed/time values.

## Data Safety

- Selected key state is kept separate from scene object selection.
- Deleted, renamed, undone, redone, or removed keys are normalized so the editor does not point at missing key indices.
- Pasting into the same timeline at the same time replaces the existing key.
- Explicit duration validation reports errors for NaN, Infinity, and negative duration values.
- Keys outside an explicit duration are allowed but reported as warnings so intentional overshoot is visible.

## Unity Package

The Unity UPM package remains inside this Electron editor repository:

```text
unity/com.suwol.suwol2d/
```

Unity runtime data now includes `Suwol2DAnimationData.duration`, and the runtime sampler uses explicit duration when it is greater than zero. The `Samples~/TimelineUsabilityV11/` package sample contains `.suwol2d`, `.suwol2d.json`, textures, explicit durations, and representative key timeline data.

## Verification

The expected checks for this stage are:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
npm.cmd run verify:unity
```
