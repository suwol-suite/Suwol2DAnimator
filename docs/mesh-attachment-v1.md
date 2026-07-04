# Mesh Attachment v1

Mesh Attachment v1 adds rigid mesh attachments beside the existing region attachment path.

This is not weighted mesh. Vertices are stored in attachment local space and the whole mesh follows the slot bone as one rigid object.

Out of scope:

- bone weights
- weight painting
- deform timelines
- IK
- constraints
- clipping
- linked mesh
- atlas packing
- Spine import/export
- advanced drag-based mesh editing

## JSON Shape

`version` remains `0` for this compatibility milestone. Attachments can now be either `region` or `mesh`.

```json
{
  "name": "arm_mesh",
  "slot": "arm_slot",
  "type": "mesh",
  "image": "arm",
  "x": 0.2,
  "y": -0.25,
  "rotation": -18,
  "scaleX": 1,
  "scaleY": 1,
  "vertices": [
    { "x": -0.13, "y": -0.425, "u": 0, "v": 0 },
    { "x": 0.13, "y": -0.425, "u": 1, "v": 0 },
    { "x": 0.16, "y": 0.425, "u": 1, "v": 1 },
    { "x": -0.1, "y": 0.425, "u": 0, "v": 1 }
  ],
  "triangles": [0, 1, 2, 0, 2, 3]
}
```

`vertices` contains local `x/y` and UV `u/v`.

`triangles` is a flat index array. Its length must be a multiple of 3 and every index must reference an existing vertex.

## Electron Editor

Create or open a project, then import an image.

Mesh attachment options:

- use **Add Mesh Attachment** in the Attachments panel
- select an attachment and change **Type** between `region` and `mesh`
- edit `x`, `y`, `rotation`, `scaleX`, and `scaleY`
- edit vertex `x`, `y`, `u`, and `v`
- edit triangle indices in groups of 3
- use **Reset Quad Mesh** to rebuild a simple four-vertex quad

The preview draws mesh attachments as a tinted image bounds plus vertex and triangle wireframe. Unity Runtime performs the actual textured mesh rendering.

Use **Mesh Sample** to create a sample character with:

- body region attachment
- arm mesh attachment
- idle animation
- walk animation

## Export

Export still writes:

```text
exports/
  sample_mesh_character.suwol2d.json
  Textures/
    body.png
    arm.png
```

Export validation checks:

- mesh has at least 3 vertices
- triangles are not empty
- triangle count is a multiple of 3
- triangle indices are in range
- vertex values are finite numbers
- UV values are finite numbers
- attachment image is present
- references to slot/bone/attachment are valid

## Unity Runtime

Unity Runtime now supports:

- region attachments through `Suwol2DRegionRenderer`
- rigid mesh attachments through `Suwol2DMeshAttachmentRenderer`

The mesh renderer creates a `MeshFilter`, `MeshRenderer`, Unity `Mesh`, UVs, triangles, and material with the matching texture.

Texture lookup uses the existing normalized policy: `arm`, `arm.png`, and case differences can match the same `Texture2D.name`.

## Unity Test

Install the package with **Add package from disk**:

```text
C:/Project/Suwol2DAnimator/unity/com.suwol.suwol2d/package.json
```

To test the built-in sample:

1. Import the **Mesh Attachment v1** sample from Package Manager.
2. Run **Tools > Suwol2D > Create Mesh Attachment v1 Demo**.
3. Enter Play Mode.
4. Confirm the arm mesh follows the `arm` bone during `idle`.
5. Set `initialAnimation` to `walk` or call `Play("walk")` to confirm the mesh follows the rotating arm bone.

To test Electron export:

1. In the Electron editor, create a project.
2. Click **Mesh Sample**.
3. Click **Export JSON**.
4. Copy the exported JSON and `Textures/` folder into a Unity project's `Assets/` folder.
5. Select the JSON and textures.
6. Run **Tools > Suwol2D > Create Runtime MVP Demo From Selected Assets**.

## Verification

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
```

`verify:format` checks the original region sample, the rigid mesh sample, and the weighted mesh sample.
