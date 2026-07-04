# Importer Prefab Workflow v7 Sample

This sample contains the same Suwol2D JSON data in two forms:

- `sample_importer_character.suwol2d`
- `sample_importer_character.suwol2d.json`

Use the `.suwol2d` file to test the Unity ScriptedImporter. Importing it creates
a generated `Suwol2DCharacter` prefab, an import report, a JSON TextAsset
subasset, and a default material subasset.

Textures are placed in `Textures/` so the importer can resolve them
automatically.
