# Suwol 2D Animator Runtime

Package: `com.suwol.suwol2d`  
Version: `0.12.0`  
Minimum Unity version: `6000.0`

This package contains the Unity runtime and importer for assets exported by the
Suwol 2D Animator Electron editor.

## Quick Start

1. Open Unity Package Manager.
2. Select **Add package from disk**.
3. Choose `unity/com.suwol.suwol2d/package.json`.
4. Import or copy a `.suwol2d` asset and its `Textures/` folder into a Unity project.
5. Select the `.suwol2d` asset and let the ScriptedImporter generate a prefab.

## Supported Runtime Features

- Bone hierarchy and world transforms
- Region attachments
- Mesh attachments
- Weighted mesh deformation
- Deform timelines
- 2-bone IK constraints
- Skins and slot attachment swaps
- Attachment timelines
- Draw order timelines
- Slot color/alpha timelines
- Event callbacks
- Translate, rotate, and scale timelines
- Single-layer animation mixing
- Simple bool/trigger state machines
- Explicit animation duration exported by the editor

## Samples

- Runtime MVP v0: `Samples~/RuntimeMvp`
- Mesh Attachment v1: `Samples~/MeshAttachmentV1`
- Weighted Mesh v2: `Samples~/WeightedMeshV2`
- Deform Timeline v3: `Samples~/DeformTimelineV3`
- IK Constraint v5: `Samples~/IkConstraintV5`
- Skin Attachment Swap v6: `Samples~/SkinAttachmentSwapV6`
- Importer Prefab Workflow v7: `Samples~/ImporterPrefabWorkflowV7`
- Animation Timelines v8: `Samples~/AnimationTimelinesV8`
- Animation Mixing State Machine v10: `Samples~/AnimationMixingStateMachineV10`
- Timeline Usability v11: `Samples~/TimelineUsabilityV11`

## API Overview

Main runtime component:

```csharp
Suwol.Suwol2D.Suwol2DCharacter
```

Common APIs include animation playback, crossfade, state machine controls,
skin switching, slot attachment overrides, and animation event callbacks.

## Limitations

- No Spine compatibility or Spine runtime integration.
- No clipping runtime.
- No atlas packing.
- No blend tree, additive animation, or animation layer system.
- No physics, audio, telemetry, licensing, payment, or cloud login system.

## Troubleshooting

- If textures are missing, keep the `.suwol2d` asset and `Textures/` folder next to each other.
- If import reports errors, inspect the `Suwol2DImportedAsset` report subasset.
- If package installation fails, verify the selected file is `com.suwol.suwol2d/package.json`.
- If smoke tests cannot run, install Unity Hub/Editor or set `UNITY_EXE`.

## Version Docs

- `runtime-mvp-v0.md`
- `mesh-attachment-v1.md`
- `weighted-mesh-v2.md`
- `deform-timeline-v3.md`
- `ik-constraint-v5.md`
- `skin-attachment-swap-v6.md`
- `unity-importer-prefab-workflow-v7.md`
- `animation-timelines-v8.md`
- `runtime-regression-stability-v9.md`
- `animation-mixing-state-machine-v10.md`
- `editor-timeline-usability-key-editing-v11.md`
- `packaging-release-readiness-v12.md`
