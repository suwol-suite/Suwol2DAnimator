# IK Constraint v5 Sample

This sample demonstrates the v5 2-bone IK constraint path.

- `upper_arm` and `lower_arm` form the IK chain.
- `hand_target` is animated in `walk`.
- `arm_ik` solves after animation sampling.
- `arm_ik_mesh` is weighted to `upper_arm` and `lower_arm`, so mesh vertices use the IK result.

Use `Tools/Suwol2D/Create IK Constraint v5 Demo` after importing this sample into a Unity project.
