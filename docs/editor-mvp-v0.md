# Electron Editor MVP v0

This milestone turns the Electron app into a minimal Suwol2D authoring editor that can create `.suwol2d.json` v0 files for the bundled Unity Runtime MVP v0.

The Electron editor and Unity package live in the same repository:

```text
C:/Project/Suwol2DAnimator/
  src/                         Electron + React + TypeScript editor
  docs/                        repository-level documentation
  unity/com.suwol.suwol2d/     Unity UPM package
```

Unity code is not a separate Unity project. Unity Package Manager should consume `unity/com.suwol.suwol2d/package.json` with **Add package from disk**.

## Scope

Editor MVP v0 supports:

- creating a new Suwol2D editor project
- opening and saving `project.suwol2dproj.json`
- importing PNG/JPG/JPEG images into a project-local `images/` folder
- creating and editing bones
- creating and editing slots
- creating and editing region attachments
- creating and editing animations
- adding, editing, and deleting translate, rotate, and scale keyframes
- previewing region attachments and transform animation on an HTML canvas
- exporting pretty-printed `.suwol2d.json` v0 data for Unity Runtime MVP v0
- creating a sample character from the Unity package sample textures

Editor MVP v0 intentionally does not support:

- Spine compatibility
- Spine JSON import/export
- mesh attachments
- weighted mesh
- weight painting
- deform timelines
- IK
- constraints
- clipping
- atlas packing
- complex skin switching
- animation mixing
- state machines
- advanced drag-based viewport editing
- undo/redo systems

## Project File vs Export File

The editor stores work in a project folder:

```text
MyCharacter/
  project.suwol2dproj.json
  images/
    body.png
    arm.png
  exports/
    sample_character.suwol2d.json
```

`project.suwol2dproj.json` is the editor work file. It stores:

- `editorVersion`
- `document`
- `importedImages`
- `lastExportPath`

`.suwol2d.json` is the Unity Runtime export file. It stores only the runtime-facing v0 document data:

- `version`
- `name`
- `bones`
- `slots`
- `skins`
- `attachments`
- `animations`

The renderer does not read or write files directly with Node `fs` or `path`. File work is handled by Electron main-process IPC and exposed through the preload API.

## Creating a Project

1. Run the app with `npm.cmd run dev`.
2. Choose **New Project**.
3. Enter a project name.
4. Select the parent folder in the native dialog.

The editor creates:

- the project folder
- `project.suwol2dproj.json`
- `images/`
- `exports/`
- a default `root` bone

## Importing Images

Use **Import Image** to select a PNG, JPG, or JPEG file.

The main process copies the image into the project `images/` folder. If the target file name already exists, the import is renamed safely, for example `body_2.png`.

Imported images are returned to the renderer with:

- editor image id
- display name
- file name
- project-relative path
- pixel width and height
- MIME type
- a temporary data URL for canvas preview

The data URL is not persisted in `project.suwol2dproj.json`.

## Bones

Use the **Bones** list to add, select, edit, and delete bones.

Supported bone fields:

- `name`
- `parent`
- `x`
- `y`
- `rotation`
- `scaleX`
- `scaleY`

The default `root` bone uses an empty parent and cannot be deleted in this MVP.

## Slots and Region Attachments

Use the **Slots** list to add slots and assign them to bones.

Supported slot fields:

- `name`
- `bone`
- `attachment`
- `drawOrder`

Use the **Attachments** list to add region attachments.

Supported attachment fields:

- `name`
- `slot`
- `type: "region"`
- `image`
- `x`
- `y`
- `rotation`
- `width`
- `height`
- `scaleX`
- `scaleY`

Only region attachments are exported. Mesh attachments are outside the MVP v0 scope.

## Animations and Keyframes

Use the **Animations** list to add or select an animation. The toolbar animation selector chooses the animation used by preview playback.

Supported animation fields:

- `name`
- `loop`
- `bones`

The timeline panel supports keyframes for the currently selected bone:

- **Add Translate Key**
- **Add Rotate Key**
- **Add Scale Key**

Keyframes can be edited inline or deleted. Preview sampling uses linear interpolation:

- before the first key, the first key is held
- after the last key, the last key is held
- if a timeline has no keys, the setup pose remains active

## Canvas Preview

The center preview uses an HTML canvas.

Preview behavior:

- the canvas center is the root origin
- JSON `x` and `y` values are preserved as Unity-style local values
- the canvas handles the visual y-axis conversion only for display
- slots are drawn in `drawOrder`
- selected attachments get an outline
- selected bones are highlighted
- **Play** advances time at speed 1 for the selected animation

The preview is intentionally approximate. Its purpose is to verify basic placement and transform motion before export.

## Sample Character

Use **Sample** to create a simple `root/body/arm` character in the current project.

The editor copies the Unity package sample textures from:

```text
unity/com.suwol.suwol2d/Samples~/RuntimeMvp/Textures/
```

The generated sample includes:

- `root`, `body`, and `arm` bones
- `body_slot` and `arm_slot`
- `body` and `arm` region attachments
- `idle` animation
- `walk` animation

This gives an empty project an immediate exportable test character.

## Exporting JSON

Use **Export JSON** to write a `.suwol2d.json` v0 file.

The exporter also copies referenced imported images beside the JSON:

```text
exports/
  sample_character.suwol2d.json
  Textures/
    body.png
    arm.png
```

Export performs:

- document validation
- `version = 0`
- runtime-facing cleanup of finite number fields
- slot sorting by `drawOrder`
- region attachment filtering
- default-skin attachment population
- referenced texture copy to `exports/Textures/`
- keyframe sorting by ascending `time`
- pretty JSON writing

Validation blocks export for broken runtime references, duplicate names, invalid key times, non-finite numbers, and non-positive attachment sizes. Missing attachment images are shown as warnings.

## Unity Runtime MVP v0 Test

1. In Unity, open Package Manager.
2. Select **Add package from disk**.
3. Choose:

```text
C:/Project/Suwol2DAnimator/unity/com.suwol.suwol2d/package.json
```

4. Import or reference the exported `.suwol2d.json` and matching textures.
5. Use the Runtime MVP v0 components documented in:

```text
unity/com.suwol.suwol2d/Documentation~/runtime-mvp-v0.md
```

The exported data is array-based and compatible with the Unity Runtime MVP v0 `JsonUtility` data model.
