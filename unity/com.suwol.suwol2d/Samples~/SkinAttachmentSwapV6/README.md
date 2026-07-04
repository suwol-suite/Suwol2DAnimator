# Skin Attachment Swap v6 Sample

This sample contains a minimal Suwol2D character with two skins:

- `default`: `body`, `arm`
- `armor_01`: `body_armor`, `arm_armor`

Import the sample through Unity Package Manager, create a demo object with
`Tools/Suwol2D/Create Skin Attachment Swap v6 Demo`, then call:

```csharp
character.SetSkin("armor_01");
character.SetSkin("default");
character.SetAttachment("body_slot", "body_armor");
character.ResetAttachments();
```

The sample is intentionally limited to skin and slot attachment resolution. It
does not include Spine compatibility, attachment timelines, clipping, atlas
packing, or animation state machines.
