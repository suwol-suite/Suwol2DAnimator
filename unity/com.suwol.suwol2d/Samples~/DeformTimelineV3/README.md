# Deform Timeline v3 Sample

This sample adds mesh vertex offset keyframes to the weighted mesh character path.

Files:

- `sample_deform_character.suwol2d.json`
- `Textures/body.png`
- `Textures/arm.png`

The arm attachment is a weighted mesh named `arm_deform_mesh`. Its `idle` and `walk` animations include `deforms` timelines that offset selected mesh vertices over time.

This sample does not include brush deform editing, brush weight painting, IK, constraints, clipping, or Spine compatibility.

To create a demo object after importing this sample, run:

```text
Tools > Suwol2D > Create Deform Timeline v3 Demo
```
