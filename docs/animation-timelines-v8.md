# Animation Timelines v8

Animation Timelines v8 extends the Suwol2D format with four focused timeline types:

- attachment timelines
- draw order timelines
- slot color and alpha timelines
- event timelines

This version does not add animation mixing, state machines, curve editors, clipping, path constraints, transform constraints, atlas packing, or Spine compatibility.

## Format

Each animation may now contain these optional fields:

```json
{
  "attachments": [],
  "drawOrders": [],
  "slots": [],
  "events": []
}
```

Empty timeline arrays may be omitted from export.

## Attachment Timeline

Attachment timelines swap or hide the visible attachment for a slot.

```json
{
  "slot": "weapon_slot",
  "keys": [
    { "time": 0, "attachment": "sword" },
    { "time": 0.5, "attachment": "axe" },
    { "time": 1, "attachment": null }
  ]
}
```

Runtime priority:

1. animation attachment timeline hide/null
2. animation attachment timeline attachment
3. manual `SetAttachment()`
4. current skin slot attachment
5. default skin slot attachment
6. hidden

## Draw Order Timeline

Draw order keys are stepped. The last key at or before the current time is applied.

```json
{
  "time": 0.5,
  "slots": [
    { "slot": "weapon_slot", "drawOrder": 1 },
    { "slot": "arm_slot", "drawOrder": 2 }
  ]
}
```

Missing slots keep their setup order, then the final order is normalized.

## Slot Color / Alpha Timeline

Slot color keys are linearly interpolated and clamped to `0..1` on export.

```json
{
  "slot": "body_slot",
  "color": [
    { "time": 0, "r": 1, "g": 1, "b": 1, "a": 1 },
    { "time": 0.5, "r": 1, "g": 0.5, "b": 0.5, "a": 0.7 }
  ]
}
```

Unity uses renderer-specific material instances, so one slot color does not tint another slot.

## Event Timeline

Events are dispatched when playback crosses the event time. Loop boundaries are handled so events are not skipped.

```json
{
  "time": 0.2,
  "name": "attack",
  "intValue": 1,
  "floatValue": 0,
  "stringValue": "slash"
}
```

Unity runtime usage:

```csharp
var character = GetComponent<Suwol2DCharacter>();

character.AnimationEvent += evt =>
{
    Debug.Log($"{evt.AnimationName}:{evt.EventName} {evt.StringValue}");
};

character.Play("attack");
```

## Electron Workflow

Use the timeline type selector in the bottom timeline panel:

- `Attachment`: select a slot, add attachment or hide keys, edit time/attachment, delete keys.
- `Draw Order`: add a key at the current time, move slots up/down, reset to setup order, delete keys.
- `Slot Color`: select a slot, add color keys, edit `r/g/b/a`, use White/Half Alpha/Hidden Alpha/Reset.
- `Event`: add event keys, edit name/time/int/float/string values, delete keys.

All edits go through the same undo/redo and dirty-state pipeline as earlier editor changes.

## Unity Importer Workflow

Import the `Animation Timelines v8` sample from Package Manager or add a `.suwol2d` file exported from Electron. The importer report shows:

- attachment timeline count
- draw order key count
- slot color key count
- event key count
- texture found/missing information
- warnings and errors

The sample contains both `sample_animation_timelines.suwol2d` and `sample_animation_timelines.suwol2d.json`; they intentionally contain identical JSON.

## Runtime Order

Unity playback applies:

```text
animation time update
setup pose reset
bone timelines
skeleton world transforms
IK solve
attachment timeline resolve
draw order resolve
slot color resolve
deform timeline sample
renderer rebuild if attachment changed
renderer update
event dispatch
```

## Manual Checks

In Unity, import `Samples~/AnimationTimelinesV8` and run:

```text
Tools/Suwol2D/Create Animation Timelines v8 Demo
```

Enter Play Mode and verify:

- `weapon_slot` changes `sword` to `axe` to hidden during `walk`.
- draw order changes are reflected by renderer sorting order.
- body/weapon alpha and color change during playback.
- `Suwol2DAnimationEventLogger` logs `footstep` and `attack` events.
