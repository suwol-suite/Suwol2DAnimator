# IK Constraint v5

IK Constraint v5 adds 2-bone IK runtime playback to the Suwol2D Unity package.

## Runtime Data

`Suwol2DAssetData` now includes:

- `Suwol2DBoneData.length`
- `Suwol2DAssetData.ikConstraints`
- `Suwol2DIkConstraintData`

Existing JSON without these fields remains valid.

## 2-Bone Chain

The runtime solves:

```text
parentBone -> childBone -> targetBone
```

`childBone` should be parented to `parentBone`. The target bone is not part of the chain; its world position is used as the goal.

## Update Order

```text
animation time update
-> setup pose reset
-> animation timelines sample
-> skeleton world transform calculate
-> IK solve
-> skeleton world transform recalculate
-> region renderer update
-> mesh renderer update
```

This order lets weighted mesh and deform playback use the IK-adjusted bone transforms.

## Sample

Import `Samples~/IkConstraintV5` through Package Manager, then run:

```text
Tools/Suwol2D/Create IK Constraint v5 Demo
```

The demo assigns `sample_ik_character.suwol2d.json`, `body.png`, `arm.png`, and starts `walk`.

## Limitations

- 2-bone IK only.
- No IK animation timeline.
- No path/transform constraints.
- No Spine compatibility.
- Scale handling is intentionally simple for v5.
