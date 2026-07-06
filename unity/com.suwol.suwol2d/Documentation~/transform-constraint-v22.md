# Transform Constraint v22

v22 adds transform constraint data and runtime playback to the Unity package.
It matches the Electron editor preview/export behavior.

## Data

The `.suwol2d` JSON may include:

```json
{
  "transformConstraints": [
    {
      "name": "weapon_follow_hand",
      "bone": "weapon",
      "targetBone": "hand",
      "enabled": true,
      "order": 0,
      "translateMix": 1,
      "rotateMix": 1,
      "scaleMix": 0,
      "offsetX": 0,
      "offsetY": 0,
      "offsetRotation": 0,
      "offsetScaleX": 0,
      "offsetScaleY": 0
    }
  ]
}
```

`bone` is the constrained bone. `targetBone` is the bone it follows.

## Runtime Order

Unity applies runtime animation in this order:

1. Sample animation or crossfade pose.
2. Update world transforms.
3. Apply transform constraints by `order`.
4. Update world transforms.
5. Apply IK constraints.
6. Update world transforms.
7. Resolve attachments, draw order, color, deform, clipping, renderers, events,
   and state machine transitions.

## Runtime APIs

Implemented runtime types:

- `Suwol2DTransformConstraintData`
- `Suwol2DSkeleton.TransformConstraints`
- `Suwol2DTransformConstraintSolver`

The solver uses world-space follow, mixes translate/rotate/scale separately,
applies offsets, and writes the constrained bone local transform.

## Importer

The ScriptedImporter report includes Transform Constraints count and validates:

- missing constrained bone
- missing target bone
- same constrained and target bone
- invalid mix values
- invalid offsets

## Sample

Import the sample from Package Manager:

```text
Samples~/TransformConstraintV22
```

It includes `weapon_follow_hand`, where `weapon` follows the animated `hand`
bone during the `swing` animation.

## Manual Visual QA

SKIPPED in this automated Codex run because no interactive Unity editor session
was available for direct visual inspection. Unity smoke tests still import the
sample, play `swing`, and verify the constrained `weapon` bone follows `hand`.

## Limitations

v22 does not include path constraints, constraint timelines, multiple
constrained bones, local/relative modes, shear, animation layers, blend trees,
or Spine compatibility.
