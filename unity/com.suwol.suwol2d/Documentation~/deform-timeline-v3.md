# Deform Timeline v3

Deform Timeline v3 adds animation-driven mesh vertex offsets to the Unity runtime.

Supported:

- `animation.deforms`
- mesh attachment deform timelines
- linear interpolation between deform keys
- zero offset fallback for missing vertices
- rigid mesh plus deform
- weighted mesh plus deform

Not supported:

- brush deform editing
- brush weight painting
- IK
- constraints
- clipping
- Spine compatibility
- Burst, Jobs, or compute shader optimization

## Data Model

Animations can include:

```csharp
public Suwol2DDeformTimelineData[] deforms;
```

Each timeline targets one mesh attachment:

```csharp
public sealed class Suwol2DDeformTimelineData
{
    public string slot;
    public string attachment;
    public Suwol2DDeformKeyData[] keys;
}
```

Each key contains vertex offsets:

```csharp
public sealed class Suwol2DDeformKeyData
{
    public float time;
    public Suwol2DVertexOffsetData[] offsets;
}
```

## Runtime

`Suwol2DDeformSampler` samples the current animation, slot, attachment, and time into a `Vector2[]` offset array.

`Suwol2DMeshAttachmentRenderer` applies offsets before rendering:

- rigid mesh: writes `base vertex + deform offset` to `Mesh.vertices`, then applies the slot bone transform
- weighted mesh: passes `base vertex + deform offset` to `Suwol2DWeightedMeshSolver`

## Sample

Import the **Deform Timeline v3** sample from Package Manager, then run:

```text
Tools > Suwol2D > Create Deform Timeline v3 Demo
```

Enter Play Mode to test `walk`. The arm mesh should combine bone motion, weights, and vertex offsets.
