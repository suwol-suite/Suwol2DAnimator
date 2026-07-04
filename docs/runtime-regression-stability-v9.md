# Runtime Regression / Stability Pack v9

Runtime Regression / Stability Pack v9 is a stabilization pass for the existing Electron editor, Suwol2D format, Unity runtime, importer, samples, and verification scripts. It does not add new animation features.

## Scope

This version keeps v0-v8 behavior intact and focuses on runtime order, renderer cache lifetime, malformed data handling, importer reimport stability, and smoke automation.

Not supported in v9:

- Spine compatibility, import, export, or runtime
- animation mixing, state machines, or curve editors
- clipping, path constraints, transform constraints, or linked mesh
- atlas packing
- brush painting or visual weight painting
- physics or audio events
- a separate Unity project committed to this repository

## Runtime Update Order

The Unity runtime update order is:

1. Load or setup data.
2. Reset skeleton to setup pose.
3. Advance animation time.
4. Apply bone timelines.
5. Recalculate skeleton world transforms.
6. Solve IK.
7. Recalculate skeleton world transforms again.
8. Resolve attachment timelines.
9. Resolve manual attachment overrides and active skin attachments.
10. Apply draw order.
11. Apply slot color and alpha.
12. Apply deform timelines.
13. Rebuild renderer views only when attachment type, attachment identity, texture, or visibility changes.
14. Update renderer transforms, mesh vertices, and materials.
15. Dispatch animation events.

`Suwol2DAnimationPlayer` owns time, bone timeline sampling, world transform calculation, and IK. `Suwol2DCharacter` then applies attachment, skin, draw order, color, deform, renderer, and event work.

## Attachment Priority

Attachment resolution priority is:

1. animation attachment timeline hide/null
2. animation attachment timeline attachment
3. manual `SetAttachment()`
4. current skin slot attachment
5. default skin slot attachment
6. setup slot attachment fallback
7. hidden

## Renderer Cache And Lifecycle

Region and mesh renderers now sync per slot instead of clearing every generated object on each sampled frame.

Renderer views are recreated only when the slot cache key changes. The practical key includes:

```text
slotName, skinName, attachmentName, attachmentType, visibility, textureName
```

Expected behavior:

- Same attachment on the same slot does not recreate GameObject, Mesh, or Material every frame.
- Hidden slots clear the generated renderer view for that slot.
- Hidden to visible creates the needed view again.
- Region to mesh or mesh to region clears the old view and creates the correct new view.
- Generated Mesh and Material instances are destroyed by the runtime.
- External shared materials assigned on `Suwol2DCharacter` are never destroyed directly. Renderer views use generated material copies.
- `OnDestroy` clears generated renderer GameObjects, Meshes, Materials, and caches.
- Runtime code does not depend on `UnityEditor`.

## Malformed Data Handling

Runtime APIs keep the existing public surface:

- `Load`
- `LoadFromJson`
- `LoadFromData`
- `Play`
- `Stop`
- `SetAnimationSpeed`
- `HasAnimation`
- `SetSkin`
- `HasSkin`
- `GetCurrentSkin`
- `SetAttachment`
- `ResetAttachments`
- `AnimationEvent`

`LoadFromJson` catches JSON parse failures. `LoadFromData` validates version, bones, slots, skins, attachments, mesh indices, weighted bone references, timeline key times, and finite numeric values before creating the runtime skeleton.

The importer also catches malformed JSON, records errors in the import report, and avoids generating a prefab when fatal errors exist. Reimporting the same `.suwol2d` asset with valid JSON should recover cleanly without duplicate report, JSON, or prefab subassets.

## Verification

Run the standard Electron and format checks:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
npm.cmd run verify:format
```

Run the Unity smoke check:

```powershell
npm.cmd run verify:unity
```

`verify:unity` uses `UNITY_EXE` when set. If it is not set, the script tries common Unity Hub install paths, including Unity `6000.5.2f1`. If no Unity executable is found, it prints a skip message and exits successfully.

When Unity is available, the script:

1. Creates a temporary Unity project under the system temp directory.
2. Adds the local UPM package using `file:C:/Project/Suwol2DAnimator/unity/com.suwol.suwol2d`.
3. Runs `Suwol.Suwol2D.Editor.Tests.Suwol2DRuntimeSmokeTests.RunAll` in batchmode.
4. Copies package samples into the temporary project.
5. Parses all sample JSON files.
6. Imports `.suwol2d` assets and validates generated prefabs.
7. Tests malformed importer recovery.
8. Tests runtime load, skin, attachment, event, transform, and renderer view count behavior.
9. Deletes the temporary Unity project.

## Manual Play Mode Checklist

In a Unity project with the package added from disk:

1. Import the Runtime MVP, Mesh, Weighted Mesh, Deform, IK, Skin Swap, Importer Prefab, and Animation Timelines samples.
2. Add or open the generated `Suwol2DCharacter` prefab.
3. Enter Play Mode.
4. Confirm no exceptions are logged.
5. Play `idle`, `walk`, and `attack` where present.
6. Toggle `SetSkin("default")` and `SetSkin("armor_01")` on the skin sample.
7. Call `SetAttachment` and `ResetAttachments` on a visible slot.
8. Confirm hidden attachment timeline keys remove the renderer, then later visible keys restore it.
9. Confirm repeated playback does not grow child renderer objects.
