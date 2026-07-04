# Weighted Mesh v2

Weighted Mesh v2 adds optional bone weights to mesh attachments and evaluates them in the Unity runtime.

Supported:

- `weights` on `type: "mesh"` attachments
- vertex-to-bone weight arrays compatible with Unity `JsonUtility`
- weighted mesh deformation from setup-pose bind transforms
- rigid mesh fallback when `weights` is null or empty
- existing region and rigid mesh render paths

Not supported:

- brush weight painting
- deform timelines
- IK
- constraints
- clipping
- Spine import/export or runtime compatibility
- Burst, Jobs, or compute shader optimization

## Data Model

Mesh weights are stored on `Suwol2DAttachmentData`:

```csharp
public Suwol2DVertexWeightData[] weights;
```

Each vertex weight stores the vertex index and an array of bone weights:

```csharp
public sealed class Suwol2DVertexWeightData
{
    public int vertex;
    public Suwol2DBoneWeightData[] bones;
}

public sealed class Suwol2DBoneWeightData
{
    public string bone;
    public float weight;
}
```

## Rendering

`Suwol2DMeshAttachmentRenderer` chooses one of two paths per mesh attachment:

- no weights: keep the Mesh Attachment v1 rigid transform path
- weights present: keep the mesh object at character-root local transform and update vertex positions from weighted bone transforms

`Suwol2DWeightedMeshSolver` captures setup-pose bind transforms when the mesh renderer is built. On pose updates, it converts attachment vertices from bind space to each weighted bone's local bind space, transforms them by the current bone world transform, blends by weight, and writes the solved root-local vertex positions to the Unity mesh.

Missing bones or non-positive weights are ignored. If a vertex has no usable weights, its bind-pose vertex position is used.

## Sample

Import the **Weighted Mesh v2** sample from Package Manager, then run:

```text
Tools > Suwol2D > Create Weighted Mesh v2 Demo
```

Enter Play Mode to test `walk`. The arm mesh should bend as `upper_arm` and `lower_arm` rotate.
