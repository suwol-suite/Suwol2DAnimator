# Skin / Attachment Swap v6

Skin / Attachment Swap v6 adds multiple skins and slot-based attachment
resolution to the Suwol2D Electron editor and the bundled Unity UPM package.

This repository remains a single long-term Electron project:

- Electron editor: `src/`
- Shared JSON format and validation: `src/shared/`
- Bundled Unity package: `unity/com.suwol.suwol2d/`

No separate Unity project is created. All Unity runtime/editor code lives inside
the UPM package folder under this repository.

## JSON Shape

The runtime JSON keeps array-based data so Unity `JsonUtility` can read it:

```json
{
  "skins": [
    {
      "name": "default",
      "attachments": []
    },
    {
      "name": "armor_01",
      "attachments": []
    }
  ]
}
```

The `default` skin is required. Skin attachments reuse the existing region,
mesh, weights, and deform-compatible attachment structures.

## Resolve Rule

For each slot, the editor preview and Unity runtime resolve attachments in this
order:

1. exact attachment name in the active skin
2. first attachment for that slot in the active skin
3. exact attachment name in the default skin
4. first attachment for that slot in the default skin
5. none

This lets a slot with setup attachment `body` display `body_armor` when
`armor_01` is active and the armor skin provides a different attachment for the
same slot.

## Electron Editor

The editor now includes a `Skins` section:

- add, rename, delete, and duplicate skins
- `default` skin cannot be deleted or renamed
- attachment creation targets the active skin
- active-skin attachments can be copied to another skin
- slot attachment options are resolved from the active and default skins
- preview uses the active skin

## Unity Runtime API

`Suwol2DCharacter` exposes:

```csharp
character.SetSkin("armor_01");
character.GetCurrentSkin();
character.HasSkin("default");
character.SetAttachment("body_slot", "body_armor");
character.ResetAttachments();
```

`SetSkin` keeps manual slot overrides. `ResetAttachments()` clears manual
overrides.

## Out Of Scope

v6 does not implement Spine compatibility, Spine import/export, linked mesh,
attachment timelines, draw-order timelines, slot color timelines, clipping,
path constraints, transform constraints, atlas packing, animation mixing, or an
animation state machine.
