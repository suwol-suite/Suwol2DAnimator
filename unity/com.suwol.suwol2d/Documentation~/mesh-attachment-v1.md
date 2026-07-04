# Mesh Attachment v1

Mesh Attachment v1 extends the Runtime MVP data model with rigid mesh attachments.

Supported:

- `type: "mesh"`
- local vertices with `x`, `y`, `u`, `v`
- flat triangle index arrays
- texture lookup through the existing texture array
- slot draw order
- bone transform following

Not supported:

- weighted mesh
- bone weights
- deform timelines
- IK
- constraints
- clipping
- Spine compatibility

## Data Model

Mesh data is stored on `Suwol2DAttachmentData`:

```csharp
public Suwol2DMeshVertexData[] vertices;
public int[] triangles;
```

Each vertex contains:

```csharp
public float x;
public float y;
public float u;
public float v;
```

The attachment still uses common transform fields:

- `x`
- `y`
- `rotation`
- `scaleX`
- `scaleY`

## Rendering

`Suwol2DCharacter` builds both render paths:

- `Suwol2DRegionRenderer`
- `Suwol2DMeshAttachmentRenderer`

Mesh attachment vertices are treated as attachment local-space coordinates. The whole mesh is transformed by its slot bone and attachment transform.

## Sample

Import the **Mesh Attachment v1** sample from Package Manager, then run:

```text
Tools > Suwol2D > Create Mesh Attachment v1 Demo
```

Enter Play Mode to test `idle`. Set `initialAnimation` to `walk` or call `Play("walk")` to confirm the mesh follows the rotating arm bone.
