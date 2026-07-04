# Animation Timelines v8

This Unity package supports Suwol2D v8 animation timelines:

- attachment timelines
- draw order timelines
- slot color and alpha timelines
- event timelines

It intentionally does not include animation mixing, state machines, curve editors, clipping, path constraints, transform constraints, atlas packing, or Spine compatibility.

## Runtime Event API

```csharp
var character = GetComponent<Suwol2DCharacter>();

character.AnimationEvent += evt =>
{
    Debug.Log($"{evt.AnimationName}:{evt.EventName} {evt.StringValue}");
};

character.Play("attack");
```

`Play()` resets the event cursor. `Stop()` prevents further dispatch. Looping animations dispatch events across loop boundaries.

## Importer Test

Import the `Animation Timelines v8` sample through Package Manager, then select:

```text
sample_animation_timelines.suwol2d
```

The importer generates a prefab and report. The report includes counts for attachment timelines, draw order keys, slot color keys, and event keys.

You can also run:

```text
Tools/Suwol2D/Create Animation Timelines v8 Demo
```

The demo adds `Suwol2DAnimationEventLogger` so event callbacks are visible in the Unity Console during Play Mode.

## Playback Rules

Attachment priority:

```text
1. animation attachment timeline hide/null
2. animation attachment timeline attachment
3. manual SetAttachment override
4. current skin slot attachment
5. default skin slot attachment
6. hidden
```

Runtime update order:

```text
animation time update
setup pose reset
bone timelines
skeleton world transform
IK solve
attachment timeline resolve
draw order resolve
slot color resolve
deform timeline sample
renderer rebuild if attachment changed
renderer update
event dispatch
```

Slot color uses renderer-specific material instances, so color and alpha changes do not leak across slots.
