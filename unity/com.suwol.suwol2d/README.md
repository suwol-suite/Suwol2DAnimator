# Suwol 2D Animator Runtime

This package is developed inside the Suwol 2D Animator Electron editor
repository.

Version: `0.12.0`

License: `Apache-2.0`

Use Unity Package Manager's **Add package from disk** command and select:

```text
unity/com.suwol.suwol2d/package.json
```

The current package contains:

- `.suwol2d.json` v0 data models
- bone hierarchy and world transform calculation
- slot and region attachment runtime objects
- MeshFilter/MeshRenderer region quad rendering
- rigid mesh attachment rendering
- weighted mesh attachment deformation
- deform timeline playback for mesh attachments
- 2-bone IK constraint playback
- multiple skins and slot-based attachment swap
- `.suwol2d` ScriptedImporter and generated prefab workflow
- attachment timelines, draw order timelines, slot color/alpha timelines, and event callbacks
- translate, rotate, and scale timeline playback
- Runtime Regression / Stability Pack v9 renderer cache, malformed-data, reimport, and smoke-test coverage
- single-layer crossfade animation mixing
- simple bool/trigger state machine playback
- Animation Mixing / State Machine v10 importer report and demo menu support
- explicit animation duration for editor/runtime playback
- keyframe interpolation presets for transform, slot color, and deform timelines
- Runtime MVP v0, Mesh Attachment v1, Weighted Mesh v2, Deform Timeline v3, IK Constraint v5, Skin Attachment Swap v6, Importer Prefab Workflow v7, Animation Timelines v8, Animation Mixing State Machine v10, Timeline Usability v11, and Curve Interpolation v20 samples

See these docs for setup and demo instructions:

- `Documentation~/index.md`
- `Documentation~/runtime-mvp-v0.md`
- `Documentation~/mesh-attachment-v1.md`
- `Documentation~/weighted-mesh-v2.md`
- `Documentation~/deform-timeline-v3.md`
- `Documentation~/ik-constraint-v5.md`
- `Documentation~/skin-attachment-swap-v6.md`
- `Documentation~/unity-importer-prefab-workflow-v7.md`
- `Documentation~/animation-timelines-v8.md`
- `Documentation~/runtime-regression-stability-v9.md`
- `Documentation~/animation-mixing-state-machine-v10.md`
- `Documentation~/editor-timeline-usability-key-editing-v11.md`
- `Documentation~/packaging-release-readiness-v12.md`
- `Documentation~/curve-interpolation-editor-v20.md`

Spine compatibility, clipping, animation layers, blend trees, additive animation, graph node editing, custom bezier handles, and full curve editors are intentionally outside the current scope.
