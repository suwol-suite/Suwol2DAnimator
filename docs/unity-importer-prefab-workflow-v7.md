# Unity Importer / Prefab Workflow v7

v7 adds a Unity asset workflow for `.suwol2d` files. The file contents are the
same JSON data used by `.suwol2d.json`, but Unity imports `.suwol2d` through the
package `ScriptedImporter`.

The Unity package still lives inside this Electron editor repository:

`unity/com.suwol.suwol2d/`

No separate Unity project is created.

## Electron Export

The existing `Export JSON` button still writes `.suwol2d.json`.

The new `Export .suwol2d` button writes:

```text
exports/
  character.suwol2d
  character.suwol2d.json
  Textures/
    body.png
    arm.png
```

Use `character.suwol2d` in Unity. The `.suwol2d.json` copy is kept as a readable
debug companion.

## Unity Import

Import a `.suwol2d` file into a Unity project that has the UPM package installed.
The importer:

- parses the JSON
- validates bones, slots, skins, attachments, deforms, IK, and textures
- searches nearby texture folders
- creates a JSON TextAsset subasset
- creates a default material subasset
- creates an import report subasset
- creates a generated prefab with `Suwol2DCharacter`

Texture search order:

```text
same folder
Textures/
textures/
../Textures/
../textures/
```

Attachment image names match texture asset names case-insensitively, with or
without file extensions.

## Runtime API

Generated prefabs use the existing `Suwol2DCharacter` API plus v7 JSON loaders:

```csharp
var character = GetComponent<Suwol2DCharacter>();
character.Play("walk");
character.SetSkin("armor_01");
character.SetAnimationSpeed(1.2f);
```

Additional loading APIs:

```csharp
character.LoadFromJson(json);
character.LoadFromData(data);
```

## Inspector

Selecting a `.suwol2d` asset shows:

- source name and version
- bone, slot, skin, attachment, animation, and IK counts
- animation, skin, slot, and attachment names
- found and missing textures
- warnings and errors
- generated prefab reference

Use `Rebuild Prefab` to force reimport and `Ping Generated Prefab` to locate the
generated object.

## Not Included

v7 does not add atlas packing, linked mesh, attachment timelines, draw order
timelines, slot color timelines, animation mixing, state machines, Spine
compatibility, brush editing, or custom shader authoring.
