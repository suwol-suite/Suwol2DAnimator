# Weighted Mesh v2 Sample

This sample adds per-vertex bone weights to the Mesh Attachment v1 character path.

Files:

- `sample_weighted_character.suwol2d.json`
- `Textures/body.png`
- `Textures/arm.png`

The arm attachment is a mesh with eight vertices. Shoulder-side vertices are weighted to `upper_arm`, wrist-side vertices are weighted to `lower_arm`, and middle vertices blend both bones.

This sample does not include brush weight painting, deform timelines, IK, constraints, clipping, or Spine compatibility.

To create a demo object after importing this sample, run:

```text
Tools > Suwol2D > Create Weighted Mesh v2 Demo
```
