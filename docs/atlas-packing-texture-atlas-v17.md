# Atlas Packing / Texture Atlas Export v17

v17 adds optional texture atlas export to the Electron editor and minimal atlas
UV support to the Unity importer/runtime.

## Goal

The default export still copies referenced source images into `Textures/`.
When atlas export is enabled, the exporter also creates:

```text
Atlas/
  character.atlas.png
  character.atlas.json
```

The exported `.suwol2d` document can include an optional top-level `atlases`
array. Attachments keep their existing `image` field. Unity resolves
`attachment.image` against atlas region names first and falls back to the
individual texture lookup when no atlas region is available.

## Editor Options

The toolbar export options include:

```text
[ ] Atlas
Atlas Name
Max Size
Padding
```

Defaults:

```text
createAtlas: false
atlasMaxSize: 2048
atlasPadding: 2
```

Atlas export currently reads PNG images only. Non-PNG images keep using the
existing `Textures/` fallback path.

## Format

Example:

```json
{
  "atlases": [
    {
      "name": "character",
      "image": "Atlas/character.atlas.png",
      "width": 1024,
      "height": 1024,
      "regions": [
        {
          "name": "body",
          "x": 2,
          "y": 2,
          "width": 128,
          "height": 128,
          "u": 0.001953,
          "v": 0.001953,
          "u2": 0.126953,
          "v2": 0.126953
        }
      ]
    }
  ]
}
```

`x` and `y` are stored in bottom-left atlas pixel coordinates so the exported
UVs can be used directly in Unity.

## Unity Importer / Runtime

The importer looks for atlas textures beside the `.suwol2d` asset in `Atlas/`
as well as the existing texture search locations. Runtime rendering uses atlas
UVs when a region matches the attachment image name:

```text
finalU = region.u + vertex.u * (region.u2 - region.u)
finalV = region.v + vertex.v * (region.v2 - region.v)
```

If the atlas, atlas texture, or matching region is missing, rendering falls
back to the existing individual texture lookup.

## Limits

- No rotation packing
- No trimming
- No multi-page atlas
- No Spine import/export/runtime compatibility
- No new animation, constraint, blend tree, or layer feature
