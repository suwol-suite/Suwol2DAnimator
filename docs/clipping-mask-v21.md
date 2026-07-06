# Clipping / Mask v21

v21 adds the first clipping attachment workflow for Suwol 2D Animator. The goal
is a practical convex polygon mask that can be authored in the Electron editor,
exported in the `.suwol2d` format, imported by Unity, and played by the Unity
runtime.

## Format

Clipping attachments use their own attachment type:

```json
{
  "name": "body_mask",
  "slot": "mask_slot",
  "type": "clipping",
  "endSlot": "arm_slot",
  "x": 0,
  "y": 0.05,
  "rotation": 0,
  "scaleX": 1,
  "scaleY": 1,
  "clippingVertices": [
    { "x": -0.42, "y": -0.58 },
    { "x": 0.3, "y": -0.48 },
    { "x": 0.38, "y": 0.46 },
    { "x": -0.34, "y": 0.62 }
  ]
}
```

The field is named `clippingVertices` so it does not collide with mesh
`vertices` in Unity `JsonUtility` data classes.

`endSlot` is optional. When it is present, clipping applies from the clipping
slot through that slot. When it is absent, clipping applies through the end of
the current draw order.

## Electron Editor

- `Add Clipping Attachment` creates a convex rectangular clipping polygon.
- The attachment inspector edits `endSlot` and vertex coordinates.
- The canvas draws the clipping polygon and its vertices.
- The existing move vertex canvas tool can move clipping vertices directly.
- Attachment timelines can show, hide, and swap clipping attachments.
- Validation reports missing end slots, invalid vertices, zero area polygons,
  and concave polygons.

## Unity Runtime

Unity parses `type: "clipping"`, `endSlot`, and `clippingVertices`. Runtime
draw order builds an active clipping range and applies the polygon to region
and mesh renderer output. Mesh, weighted mesh, deform timeline, IK, and atlas
UV lookup are evaluated before the final clipping pass.

The v21 runtime supports convex polygons. Concave polygons are validation
warnings and should be treated as unsupported authoring data.

## Unity Importer

The importer validates clipping attachment data and includes clipping attachment
and vertex counts in the import report. Generated prefabs use the same runtime
clipping path as JSON-loaded characters.

## Sample

The Unity package includes:

```text
unity/com.suwol.suwol2d/Samples~/ClippingMaskV21
```

The sample contains `sample_clipping_mask.suwol2d`, matching debug JSON, and
textures. The Electron sample menu can also create the same document.

## Not Included

v21 does not add Spine import/export/runtime compatibility, concave polygon
clipping, custom bezier mask editing, animation layers, blend trees, path
constraints, transform constraints, or a full UI redesign.
