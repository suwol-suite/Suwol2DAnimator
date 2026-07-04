# Electron Export to Unity Runtime MVP v0

This document describes the end-to-end check from the Electron editor to Unity Runtime MVP v0.

The repository contains both sides:

```text
C:/Project/Suwol2DAnimator/
  src/                         Electron editor
  unity/com.suwol.suwol2d/     Unity UPM package
```

Do not create a separate Unity package or Unity runtime project inside this repository. Unity should consume the existing UPM package from `unity/com.suwol.suwol2d/package.json`.

## 1. Run the Electron Editor

From `C:/Project/Suwol2DAnimator`:

```powershell
npm.cmd run dev
```

Use the editor toolbar to create and export a sample:

1. Click **New Project**.
2. Enter a project name, for example `sample_character`.
3. Choose a parent folder in the native dialog.
4. Click **Sample**.
5. Click **Save**.
6. Select `idle` or `walk` in the animation selector.
7. Click **Play** to confirm that the canvas preview moves.
8. Click **Export JSON**.

The sample button copies these textures into the project `images/` folder:

```text
unity/com.suwol.suwol2d/Samples~/RuntimeMvp/Textures/body.png
unity/com.suwol.suwol2d/Samples~/RuntimeMvp/Textures/arm.png
```

## 2. Exported Project Layout

An editor project looks like this:

```text
MyCharacter/
  project.suwol2dproj.json
  images/
    body.png
    arm.png
  exports/
    sample_character.suwol2d.json
    Textures/
      body.png
      arm.png
```

`project.suwol2dproj.json` is the editor working file.

`exports/sample_character.suwol2d.json` is the Unity Runtime data file.

`exports/Textures/` is copied during export and contains only imported images referenced by region attachments.

## 3. Format Guarantees

The exported `.suwol2d.json` v0 file is array-based for Unity `JsonUtility`.

Top-level fields:

- `version`
- `name`
- `bones`
- `slots`
- `skins`
- `attachments`
- `animations`

Runtime-facing guarantees:

- `version` is `0`
- `name` is not empty
- bones are emitted parent-before-child when possible
- slots are sorted by `drawOrder`
- default skin includes the exported region attachments
- top-level `attachments` also contains the same region attachments for Runtime MVP v0 compatibility
- attachment `image` names are normalized to texture-friendly names such as `body`
- keyframe times are sorted ascending
- numeric fields are finite JSON numbers
- width and height are greater than `0`
- rotation values are degrees

The Runtime MVP v0 intentionally does not support mesh, weights, deform, IK, constraints, clipping, Spine compatibility, animation mixing, or state machines.

## 4. Add the Unity Package

In Unity:

1. Open Package Manager.
2. Choose **Add package from disk**.
3. Select:

```text
C:/Project/Suwol2DAnimator/unity/com.suwol.suwol2d/package.json
```

The package contains Runtime, Editor, Samples, and Documentation folders. It is not a standalone Unity project.

## 5. Bring Exported Assets into Unity

Copy or drag the exported files into your Unity project's `Assets/` folder:

```text
sample_character.suwol2d.json
Textures/body.png
Textures/arm.png
```

Unity imports the JSON as a `TextAsset` and the textures as `Texture2D` assets.

The runtime texture lookup accepts both extensionless and extension-included image names:

- attachment image `body` can match `Texture2D.name == "body"`
- attachment image `body.png` can also match `Texture2D.name == "body"`
- matching is case-insensitive

If a texture is missing, the warning includes slot name, attachment name, and image name.

## 6. Create a Demo from Selected Assets

In Unity's Project window:

1. Select the exported `.suwol2d.json` TextAsset.
2. Select the matching `body` and `arm` Texture2D assets.
3. Optionally select a Material.
4. Run **Tools > Suwol2D > Create Runtime MVP Demo From Selected Assets**.

The menu creates or reuses a `Suwol2D Runtime MVP Demo` GameObject and assigns:

- `jsonAsset`
- `textures`
- `defaultMaterial`
- `playOnAwake = true`
- `initialAnimation`
- `animationSpeed = 1`

If the JSON contains an `idle` animation, `initialAnimation` is set to `idle`. Otherwise, the first animation name is used.

The older sample menu still exists:

```text
Tools > Suwol2D > Create Runtime MVP Demo
```

That menu targets the package's built-in Runtime MVP sample assets.

## 7. Confirm idle/walk Playback

Enter Play Mode.

Expected result:

- the character's region attachments are visible
- `idle` plays automatically if it exists
- textures are assigned without lookup warnings

To test `walk`, call this from a small MonoBehaviour, the Inspector debug flow, or another temporary Unity script:

```csharp
var character = FindObjectOfType<Suwol.Suwol2D.Suwol2DCharacter>();
character.Play("walk");
```

You can also change the serialized `initialAnimation` field to `walk` before entering Play Mode.

## 8. Confirm JSON Changes Affect Runtime

To verify that Unity is using the exported JSON:

1. Open the exported `.suwol2d.json` file.
2. Change a visible value, for example `arm` attachment `rotation` or the `walk` rotate key values.
3. Save the JSON.
4. Let Unity reimport the asset.
5. Recreate or reload the demo object.
6. Enter Play Mode again.

The character pose or animation should reflect the edited value.

## 9. Automated Format Verification

From the repository root:

```powershell
npm.cmd run verify:format
```

This script:

- creates the Electron sample document
- runs the actual TypeScript runtime export function
- parses the generated JSON
- checks Runtime MVP v0 field names and array structure
- compares the generated sample with the Unity package sample JSON
- verifies keyframe sorting
- verifies attachment image names against sample texture names
- checks that the C# data model contains the expected v0 fields

Required Electron checks:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit
```

## 10. Common Issues

**JSON is not selectable as a TextAsset**

Make sure the file is inside the Unity project's `Assets/` folder and has a `.json` extension, for example `sample_character.suwol2d.json`.

**Textures are not visible**

Select the exported textures when running **Create Runtime MVP Demo From Selected Assets**, or assign them manually to the `textures` array on `Suwol2DCharacter`.

**Texture lookup warning appears**

Check that attachment `image` values match texture names after removing extension and ignoring case. For example, `body`, `body.png`, and `Body.PNG` all resolve to `body`.

**Animation does not play**

Confirm the JSON contains an animation with the selected name. The sample provides `idle` and `walk`.

**Character appears but draw order is wrong**

Check slot `drawOrder` values in the exported JSON. The exporter sorts slots by `drawOrder` and rewrites them to `0..n`.

**Runtime logs duplicate attachment warnings**

Runtime MVP v0 accepts top-level attachments and default-skin attachments. Exact duplicates from the default skin are ignored after the top-level attachments are loaded. If this warning appears, check for duplicate names inside the top-level `attachments` array.
