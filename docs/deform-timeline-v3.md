# Deform Timeline v3

Deform Timeline v3 adds mesh vertex offset keyframes to Suwol2D animations.

This milestone keeps editing numeric and explicit. The Electron editor can create deform timelines, add/delete keys, edit key time, edit per-vertex offset `x/y`, reset a key to zero offsets, clear a timeline, and export `animation.deforms` to `.suwol2d.json`.

Out of scope:

- brush deform editing
- brush weight painting
- curve editor
- onion skin
- IK
- constraints
- clipping
- Spine import/export or runtime compatibility
- Burst, Jobs, or compute shader optimization

## JSON Shape

Deform timelines live on animations:

```json
{
  "name": "walk",
  "loop": true,
  "bones": [],
  "deforms": [
    {
      "slot": "arm_slot",
      "attachment": "arm_deform_mesh",
      "keys": [
        {
          "time": 0,
          "offsets": [
            { "vertex": 0, "x": 0, "y": 0 },
            { "vertex": 1, "x": 0.04, "y": -0.02 }
          ]
        }
      ]
    }
  ]
}
```

`slot` and `attachment` target a mesh attachment. Region attachments do not use deform timelines. Missing vertex offsets are treated as zero.

## Electron Editor

Use **Deform Sample** to create a sample character with weighted mesh plus deform keys.

To edit manually:

1. Select an animation in the toolbar.
2. Select a mesh attachment in the left panel.
3. Use **Add Deform Key** in the timeline panel.
4. Edit key time and per-vertex offset `x/y` values.
5. Use **Reset Selected Deform Key** to zero every vertex on the selected key.
6. Use **Clear Deform Timeline** to remove the selected mesh's deform timeline from the current animation.

The canvas preview samples deform offsets with linear interpolation and applies them to the mesh wireframe. Weighted mesh skinning is still validated primarily in Unity Runtime.

## Unity Runtime

Runtime order:

```text
base vertex
-> deform offset
-> rigid mesh transform or weighted deformation
```

Rigid meshes update `Mesh.vertices` with `base + deform`, then use the existing slot bone transform path.

Weighted meshes solve `base + deform` through the weighted mesh solver, and keep the mesh object at character-root local transform to avoid double transforms.

## Verification

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
```

`verify:format` checks region, rigid mesh, weighted mesh, and deform samples.
