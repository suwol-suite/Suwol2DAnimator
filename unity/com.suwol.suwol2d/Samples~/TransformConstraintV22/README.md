# Transform Constraint v22 Sample

This sample demonstrates v22 transform constraints.

- `hand` is animated by the `swing` animation.
- `weapon_follow_hand` constrains `weapon` to follow `hand`.
- `translateMix` and `rotateMix` are `1`.
- `scaleMix` is `0`, so weapon scale stays unchanged.
- The Unity runtime applies this constraint before IK.

The sample intentionally avoids path constraints, constraint timelines,
multi-target constraints, and Spine compatibility.
