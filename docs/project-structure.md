# Project Structure

Suwol 2D Animator keeps the Electron editor and the Unity UPM package in one repository.

```text
Suwol2DAnimator/
  package.json
  src/
    main/
    preload/
    renderer/
  assets/
  docs/
  samples/
  unity/
    com.suwol.suwol2d/
      package.json
      Runtime/
        Data/
        Core/
        Animation/
        Rendering/
      Editor/
      Samples~/
      Documentation~/
```

## Electron Editor

The root `package.json` belongs to the Electron app. The app is built with Electron, React, TypeScript, and electron-vite.

- `src/main/`: Electron main process
- `src/preload/`: limited preload API exposed to the renderer
- `src/renderer/`: React + TypeScript renderer app
- `assets/`: editor app static assets
- `samples/`: editor-side sample data

Editor MVP v0 adds a functional React editor surface for project create/open/save, image import, bone/slot/region attachment editing, transform keyframes, canvas preview, and `.suwol2d.json` export.

## Unity UPM Package

Unity code is not a separate Unity project. The folder `unity/com.suwol.suwol2d/` is the Unity Package Manager package.

In Unity Package Manager, use **Add package from disk** and select:

```text
unity/com.suwol.suwol2d/package.json
```

The package is organized as:

- `Runtime/Data/`: `.suwol2d.json` v0 serializable data models
- `Runtime/Core/`: skeleton, bone, slot, and attachment runtime objects
- `Runtime/Animation/`: transform timeline sampling and playback
- `Runtime/Rendering/`: MeshFilter/MeshRenderer region quad rendering
- `Editor/`: Editor-only importer placeholder, inspector, and demo menu
- `Samples~/RuntimeMvp/`: sample JSON and textures
- `Documentation~/`: Unity package documentation

## Runtime MVP v0

Runtime MVP v0 supports:

- loading array-based `.suwol2d.json` data with Unity `JsonUtility`
- bone parent-child hierarchy
- local and world transform calculation
- slot to bone references
- slot to region attachment references
- region attachment rendering with generated quad meshes
- translate, rotate, and scale animation timelines
- `Suwol2DCharacter.Play("idle")` and `Suwol2DCharacter.Play("walk")`

Runtime MVP v0 intentionally does not support:

- Spine compatibility
- Spine import/export
- mesh attachments
- weighted mesh
- deform timelines
- IK
- constraints
- clipping
- advanced skin switching
- animation mixing
- state machines
- atlas packing

## Next Milestones

1. Unity importer MVP for editor-exported `.suwol2d.json` files
2. Runtime and editor refinements after round-trip testing
3. Mesh, weight, deform, IK, and constraint expansion
