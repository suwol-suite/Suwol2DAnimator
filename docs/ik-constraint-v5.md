# IK Constraint v5

IK Constraint v5 adds a small 2-bone IK path to Suwol 2D Animator.

The goal is practical playback, not Spine compatibility or a full constraint system. The supported chain is:

```text
parentBone -> childBone -> targetBone
```

## Format

Documents may include top-level `ikConstraints`.

```json
{
  "ikConstraints": [
    {
      "name": "arm_ik",
      "parentBone": "upper_arm",
      "childBone": "lower_arm",
      "targetBone": "hand_target",
      "enabled": true,
      "mix": 1,
      "bendDirection": 1,
      "order": 0
    }
  ]
}
```

Bones may include `length`. Existing JSON without `length` remains valid. When a length is missing, the editor/runtime fall back to child local distance, then attachment size, then `50`.

## Fields

- `parentBone`: first bone in the IK chain.
- `childBone`: second bone in the IK chain. It should be parented to `parentBone`.
- `targetBone`: bone whose world position is the goal.
- `enabled`: disables solving when false.
- `mix`: 0..1 blend between FK and IK.
- `bendDirection`: `1` or `-1` elbow direction.
- `order`: solve order when several constraints exist.

## Editor

- Use the left `IK Constraints` section to add/delete/select constraints.
- Select a bone and edit `Length` in the inspector.
- Select an IK constraint to edit name, enabled, parent, child, target, mix, bend, and order.
- Use `IK Sample` to create a sample character with `upper_arm`, `lower_arm`, `hand_target`, and `arm_ik`.

## Evaluation Order

```text
setup pose
-> animation bone timelines
-> world transform calculation
-> IK constraints by order
-> world transform recalculation
-> region / mesh / weighted mesh / deform rendering
```

Weighted mesh and deform playback use the post-IK bone world transforms.

## Unity Test

Import the package sample `IkConstraintV5`, then run:

```text
Tools/Suwol2D/Create IK Constraint v5 Demo
```

The generated demo uses `sample_ik_character.suwol2d.json`, `body.png`, `arm.png`, and starts with the `walk` animation.

## Common Issues

- `childBone.parent` does not match `parentBone`: the solver skips the constraint.
- Bone length is zero or missing: the solver uses a fallback, which may look wrong.
- Target is too close or too far: distance is clamped to keep rotations finite.
- Bend direction looks flipped: switch `bendDirection` between `1` and `-1`.
- Mesh appears to ignore IK: confirm weighted mesh update runs after IK solving.

## Not Supported Yet

- 1-bone IK
- n-bone IK
- transform constraint
- path constraint
- IK keyframe timeline
- Spine compatibility
- clipping
- linked mesh
- atlas packing
- brush weight/deform editing
- state machine
- curve editor
- onion skin
