# Transform Constraint v22

v22 adds a small transform constraint system to the Electron editor format,
preview, export path, Unity importer, and Unity runtime.

## Scope

Supported in v22:

- One constrained bone per constraint.
- One target bone per constraint.
- World-space follow behavior.
- `translateMix`, `rotateMix`, and `scaleMix` in the `0..1` range.
- `offsetX`, `offsetY`, `offsetRotation`, `offsetScaleX`, and `offsetScaleY`.
- `enabled` and `order`.
- Electron editor list/inspector editing.
- Unity runtime playback before IK.

Not included in v22:

- Multiple constrained bones per constraint.
- Local or relative transform modes.
- Shear.
- Path constraints.
- Constraint timelines.
- Advanced constraint mixing, animation layers, or blend trees.
- Spine import/export/runtime compatibility.

## Format

Transform constraints live at the top level of `.suwol2d` data:

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

Existing files without `transformConstraints` remain valid.

## Evaluation Order

Electron preview and Unity runtime use the same order:

1. Reset setup pose.
2. Sample animation or mixer pose.
3. Calculate skeleton world transforms.
4. Apply transform constraints by `order`.
5. Recalculate world transforms.
6. Apply IK constraints.
7. Recalculate world transforms.
8. Resolve attachments, draw order, colors, deform, clipping, and rendering.

This means IK sees bones after transform constraints have already moved them.

## Editor Usage

Use the left panel **Transform Constraints** section to add and select a
constraint. The inspector exposes:

- name
- enabled
- constrained bone
- target bone
- order
- translate, rotate, and scale mix
- position, rotation, and scale offsets

Undo/redo and dirty state use the existing document update flow.

## Unity Runtime

Unity adds:

- `Suwol2DTransformConstraintData`
- `Suwol2DSkeleton.TransformConstraints`
- `Suwol2DTransformConstraintSolver`

The solver modifies the constrained bone local transform by converting the
desired world-space result back through the parent transform. It runs before
`Suwol2DIkSolver`.

## Sample

The package includes:

```text
unity/com.suwol.suwol2d/Samples~/TransformConstraintV22/
  sample_transform_constraint.suwol2d
  sample_transform_constraint.suwol2d.json
  Textures/
```

The sample animates `hand` and constrains `weapon` with
`weapon_follow_hand`, using full translate/rotate follow and no scale follow.

## Manual Visual QA

SKIPPED in this automated Codex run because no interactive Electron or Unity GUI
session was available for direct visual inspection. Coverage is provided by
`verify:format`, shared validation, Electron typecheck/build, and Unity smoke
tests that load the sample and verify `weapon` follows `hand` at runtime.
