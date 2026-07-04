# Weighted Mesh v2

Weighted Mesh v2 extends mesh attachments with per-vertex bone weights and Unity runtime deformation.

This milestone keeps the scope intentionally small: weights are edited with numeric controls in the Electron editor, exported in `.suwol2d.json`, and evaluated in the Unity runtime. Brush painting, deform timelines, IK, constraints, clipping, Spine compatibility, and advanced optimization paths are still out of scope.

## JSON Shape

Mesh attachments can include an optional `weights` array:

```json
{
  "type": "mesh",
  "name": "arm_weighted_mesh",
  "slot": "arm_slot",
  "vertices": [
    { "x": -0.08, "y": -0.11, "u": 0, "v": 0 },
    { "x": 0.18, "y": -0.09, "u": 0.35, "v": 0 }
  ],
  "triangles": [0, 1, 2],
  "weights": [
    {
      "vertex": 0,
      "bones": [{ "bone": "upper_arm", "weight": 1 }]
    },
    {
      "vertex": 1,
      "bones": [
        { "bone": "upper_arm", "weight": 0.5 },
        { "bone": "lower_arm", "weight": 0.5 }
      ]
    }
  ]
}
```

`weights` is optional. A mesh without weights continues to use the existing rigid mesh path.

Each `vertex` points to an index in `vertices`. Each `bone` must match a bone name in the document. Weight sums should be `1.0`; validation warns when the sum is off instead of silently changing authored data.

## Electron Editor

Use **Weighted Sample** to create a sample with:

- body region attachment
- weighted arm mesh attachment
- `upper_arm` and `lower_arm` bones
- `idle` and `walk` animations

When a mesh attachment is selected, the inspector shows vertex rows and a numeric weight editor for the selected vertex.

Available weight actions:

- **Add Weight** adds a bone weight to the selected vertex.
- **Normalize Selected Vertex** scales the selected vertex weights so their sum becomes `1`.
- **Normalize All Vertices** normalizes every authored vertex weight list.
- **Clear Weights** removes all weights from the mesh, returning it to rigid fallback.
- **Auto Rigid Weights** assigns all vertices to the slot bone when possible.

The canvas preview keeps the existing mesh wireframe and marks vertices that have weights. Unity Runtime is the authority for deformation behavior in this milestone.

## Export

The exporter keeps mesh weights only when a mesh has non-empty positive bone weights. It writes vertex entries sorted by `vertex` and bone weights sorted by bone name.

Validation checks:

- weight vertex index is inside the vertex array
- referenced bone exists
- weight is finite and not negative
- duplicate bone weights are reported
- vertex weight sums that are not `1.0` are reported
- partial weights are allowed but reported because unweighted vertices use their original bind position

## Unity Runtime

`Suwol2DMeshAttachmentRenderer` now has two paths:

- rigid mesh: no `weights`, same behavior as Mesh Attachment v1
- weighted mesh: mesh object stays at character-root local transform and vertices are updated from weighted bone transforms

`Suwol2DWeightedMeshSolver` captures setup-pose bind transforms, converts attachment vertices into bind space, applies each referenced bone transform, blends by weight, and updates `Mesh.vertices` every pose update.

This implementation favors clarity over optimization. It does not use Burst, Jobs, or compute shaders.

## Unity Test

Install the package with **Add package from disk**:

```text
C:/Project/Suwol2DAnimator/unity/com.suwol.suwol2d/package.json
```

To test the built-in sample:

1. Import the **Weighted Mesh v2** sample from Package Manager.
2. Run **Tools > Suwol2D > Create Weighted Mesh v2 Demo**.
3. Enter Play Mode.
4. Confirm the arm mesh bends between `upper_arm` and `lower_arm` during `walk`.

To test Electron export:

1. In the Electron editor, click **Weighted Sample**.
2. Click **Export JSON**.
3. Copy the exported JSON and `Textures/` folder into a Unity project's `Assets/` folder.
4. Select the JSON and textures.
5. Run **Tools > Suwol2D > Create Runtime MVP Demo From Selected Assets**.

## Verification

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
```

`verify:format` checks region, rigid mesh, and weighted mesh samples.
