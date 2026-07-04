# Unity Importer / Prefab Workflow v7

The Suwol2D Unity package includes a `ScriptedImporter` for `.suwol2d` files.
The imported file is JSON with the same structure as `.suwol2d.json`.

## Import Output

Importing a `.suwol2d` file creates:

- generated prefab main asset
- `Suwol2DImportedAsset` report subasset
- JSON TextAsset subasset
- default material subasset

The prefab has a `Suwol2DCharacter` component with the generated JSON TextAsset,
resolved textures, default material, and initial animation assigned.

## Texture Search

The importer searches for textures in:

```text
same folder
Textures/
textures/
../Textures/
../textures/
```

Attachment image names can include or omit file extensions. Matching is
case-insensitive.

## Validation

The importer reports errors and warnings for:

- JSON parse failures
- unsupported version
- missing bones
- missing `default` skin
- attachments referencing missing slots
- unsupported attachment types
- invalid mesh triangle indices
- missing weight bones
- missing or non-mesh deform targets
- IK references to missing bones
- missing textures

Fatal errors skip prefab generation and leave the import report as the main
asset.

## Demo

Import the `ImporterPrefabWorkflowV7` package sample, then select
`sample_importer_character.suwol2d`. Unity should generate a prefab-like main
asset with a `Suwol2DCharacter`.

You can instantiate it with:

`Tools/Suwol2D/Create Demo From Imported Suwol2D Asset`

Runtime usage:

```csharp
var character = GetComponent<Suwol2DCharacter>();
character.Play("walk");
character.SetSkin("armor_01");
character.SetAttachment("body_slot", "body_armor");
```

## Out Of Scope

This workflow does not include atlas packing, linked mesh, attachment timelines,
draw order timelines, slot color timelines, clipping, animation mixing, state
machines, Spine compatibility, brush editing, or custom shader authoring.
