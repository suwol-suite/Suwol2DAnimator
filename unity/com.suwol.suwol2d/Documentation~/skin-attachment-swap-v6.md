# Skin Attachment Swap v6

The Unity UPM package is bundled inside the Electron editor repository at
`unity/com.suwol.suwol2d/`. It is not a separate Unity project.

## Runtime API

Use `Suwol2DCharacter` after loading a `.suwol2d.json` TextAsset:

```csharp
var character = GetComponent<Suwol2DCharacter>();
character.Play("walk");
character.SetSkin("armor_01");
character.SetAttachment("body_slot", "body_armor");
character.ResetAttachments();
```

Available methods:

- `bool HasSkin(string skinName)`
- `string GetCurrentSkin()`
- `bool SetSkin(string skinName)`
- `bool SetAttachment(string slotName, string attachmentName)`
- `void ResetAttachments()`

`SetSkin` keeps manual attachment overrides. `ResetAttachments()` clears them.
Missing skins, slots, or attachments return `false` and log a warning.

## Resolution Order

For each slot, Unity resolves the active attachment as:

1. exact attachment name in the current skin
2. first attachment for that slot in the current skin
3. exact attachment name in the `default` skin
4. first attachment for that slot in the `default` skin
5. no renderer for that slot

Mesh, weighted mesh, deform, and IK playback remain compatible with the active
resolved attachment. Deform timelines apply only when the resolved attachment
name matches the timeline target.

## Sample

Import `SkinAttachmentSwapV6` from Package Manager samples, then run:

`Tools/Suwol2D/Create Skin Attachment Swap v6 Demo`

The sample includes:

- `default` skin: `body`, `arm`
- `armor_01` skin: `body_armor`, `arm_armor`

## Not Included

This package still does not include Spine import/export, linked mesh,
attachment timelines, draw order timelines, slot color timelines, clipping,
atlas packing, animation mixing, or a state machine.
