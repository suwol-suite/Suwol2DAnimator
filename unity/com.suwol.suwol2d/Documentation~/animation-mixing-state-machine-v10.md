# Animation Mixing / State Machine v10

Suwol2D v10 adds single-layer crossfade playback and a small bool/trigger state machine runtime.

## Runtime API

```csharp
var character = GetComponent<Suwol2DCharacter>();

character.Play("idle");
character.Play("walk", 0.15f);
character.CrossFade("attack", 0.05f);

character.PlayStateMachine("default");
character.SetBool("moving", true);
character.SetTrigger("attack");
```

Additional query APIs:

- `IsTransitioning()`
- `GetCurrentAnimationName()`
- `GetNextAnimationName()`
- `GetTransitionProgress()`
- `HasStateMachine(name)`
- `GetCurrentStateName()`
- `ResetTrigger(name)`

## Blend Behavior

- Bone translate and scale blend linearly.
- Bone rotation uses shortest angle lerp.
- Slot color and alpha blend linearly.
- Mesh deform offsets blend linearly.
- Attachment and draw order timelines switch to the target animation when fade weight is `>= 0.5`.
- Events come from the target animation only while fading.

## State Machine Format

State machines live in the top-level `stateMachines` array. v10 supports only:

- `bool` parameters with `equals` conditions
- `trigger` parameters with `triggered` conditions
- ordered transitions from a state name or `"*"`

The first matching transition runs. A transition does not interrupt an active transition.

## Demo

Import the `Animation Mixing State Machine v10` package sample, then run:

```text
Tools/Suwol2D/Create Animation Mixing State Machine v10 Demo
```

Enter Play Mode. The attached `Suwol2DStateMachineDemoController` toggles `moving` and fires `attack`.

## Out Of Scope

v10 does not implement animation layers, blend trees, additive animation, graph node editing, curve editing, nested state machines, clipping, atlas packing, Spine import/export, or Spine runtime compatibility.
