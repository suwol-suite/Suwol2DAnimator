# Runtime Regression / Stability Pack v9

This package is managed inside the Suwol 2D Animator Electron repository. v9 is a stability pack for the Unity runtime, importer, samples, and verification scripts. It does not add Spine compatibility, mixing, state machines, clipping, path constraints, atlas packing, brush editing, physics, audio, or a separate Unity project.

## Runtime Order

The runtime order is:

1. Load or setup data.
2. Reset setup pose.
3. Advance animation time.
4. Apply bone timelines.
5. Recalculate world transforms.
6. Solve IK.
7. Recalculate world transforms again.
8. Resolve attachment timelines.
9. Resolve manual attachment overrides and skin attachments.
10. Apply draw order.
11. Apply slot color and alpha.
12. Apply deform timelines.
13. Rebuild renderer views only when attachment type, attachment identity, texture, or visibility changes.
14. Update renderer transform, mesh, and material state.
15. Dispatch animation events.

Attachment priority is animation hide/null, animation attachment, manual `SetAttachment`, current skin, default skin, setup slot fallback, then hidden.

## Renderer Cache

Region and mesh renderers sync per slot. The cache key includes slot name, skin name, attachment name, attachment type, visibility, and texture name.

- Same visible attachment does not recreate generated renderer objects every frame.
- Hidden slots clear their generated renderer view.
- Hidden to visible creates the view again.
- Region to mesh and mesh to region clear the old view.
- Generated Mesh and Material instances are destroyed by the runtime.
- External shared materials assigned on `Suwol2DCharacter` are copied and not destroyed directly.
- `OnDestroy` clears generated objects and caches.
- Runtime assemblies do not reference `UnityEditor`.

## Malformed JSON And Reimport

`LoadFromJson` catches parse failures, and `LoadFromData` validates required runtime structure before creating a skeleton.

The `.suwol2d` importer records malformed JSON and validation errors in `Suwol2DImportReport`. Fatal errors prevent prefab generation. Reimporting a corrected `.suwol2d` file should recover without duplicate report, JSON, or prefab subassets.

## Smoke Tests

From the repository root:

```powershell
npm.cmd run verify:format
npm.cmd run verify:unity
```

`verify:unity` uses `UNITY_EXE` first, then common Unity Hub paths. If Unity is unavailable, it skips without failing. When Unity is available it creates a temporary project, references this package with a local `file:` dependency, runs `Suwol2DRuntimeSmokeTests.RunAll`, and deletes the temporary project.

## Manual Checklist

Import the package samples, enter Play Mode, and check that:

- sample JSON loads without exceptions
- generated importer prefabs include `Suwol2DCharacter`
- `LoadFromJson`, `LoadFromData`, `Play`, `Stop`, `SetSkin`, `SetAttachment`, and `ResetAttachments` work
- v8 events dispatch
- transforms remain finite
- renderer child object count does not grow during repeated playback
