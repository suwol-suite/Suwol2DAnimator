# Clipping Mask v21 Sample

This sample demonstrates convex polygon clipping attachments supported by Suwol 2D Animator v21.

- `mask_slot` holds the `body_mask` clipping attachment.
- `body_mask` clips subsequent slots through `arm_slot` using `endSlot`.
- The `walk` animation toggles the clipping attachment off and back on with attachment keys.
- Region and mesh attachments continue to use the existing textures in `Textures/`.

The sample intentionally uses a convex polygon. Concave clipping polygons are reported as warnings and are not part of v21 support.
