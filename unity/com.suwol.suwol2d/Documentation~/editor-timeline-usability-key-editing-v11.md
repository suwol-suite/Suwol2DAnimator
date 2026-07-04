# Editor Timeline Usability / Key Editing v11

v11 keeps the Unity integration inside the existing UPM package and adds compatibility for explicit animation duration exported by the Electron editor.

## Runtime Data

`Suwol2DAnimationData` now includes:

```csharp
public float duration;
```

When `duration` is greater than zero, `Suwol2DAnimationSampler.GetDuration` returns it. Otherwise the runtime keeps the previous fallback behavior and calculates duration from the latest timeline key.

## Validation

Runtime and importer validation reject NaN, Infinity, and negative duration values. Keys beyond an explicit duration are still serialized by the editor; the editor validation reports them as warnings.

## Sample

The package includes:

```text
Samples~/TimelineUsabilityV11/
  sample_timeline_editing.suwol2d
  sample_timeline_editing.suwol2d.json
  Textures/
```

This sample covers explicit duration, bone keys, attachment keys, draw order keys, slot color keys, event keys, and a simple deform timeline.
