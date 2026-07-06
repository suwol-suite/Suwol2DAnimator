# Clipping / Mask v21

The Unity package supports convex polygon clipping attachments exported by the
Electron editor in v21.

## Data Fields

Clipping attachments use:

- `type: "clipping"`
- `endSlot`
- `clippingVertices`

`clippingVertices` is separate from mesh `vertices` so Unity `JsonUtility` can
deserialize clipping and mesh attachments without field ambiguity.

## Runtime Behavior

During renderer sync, `Suwol2DCharacter` builds an active clipping context from
the current draw order. A clipping attachment masks subsequent renderable slots
until its `endSlot`, or until the end of draw order when no `endSlot` is set.

Region and mesh renderer output is clipped after transform, IK, atlas lookup,
weights, and deform offsets are evaluated.

## Importer

The `.suwol2d` ScriptedImporter validates clipping attachments and reports:

- clipping attachment count
- clipping vertex count
- missing end slots
- invalid or zero-area polygons
- concave polygon warnings

## Sample

Import `Samples~/ClippingMaskV21` to inspect
`sample_clipping_mask.suwol2d`. The `walk` animation toggles the `body_mask`
clipping attachment off and back on through attachment keys.

## Limits

v21 supports convex polygons only. It does not include Spine clipping
compatibility, concave clipping, animation layers, blend trees, path
constraints, or transform constraints.
