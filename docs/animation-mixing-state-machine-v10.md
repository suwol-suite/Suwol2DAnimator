# Animation Mixing / State Machine v10

This milestone adds the first single-layer animation mixing path to Suwol 2D Animator.

## Scope

Implemented:

- Unity `Play(animationName, fadeDuration)` and `CrossFade(animationName, fadeDuration)`
- Single current -> next animation transition
- Linear translate and scale blending
- Shortest-path rotation blending
- Slot color and alpha blending
- Mesh deform offset blending
- Attachment and draw order source switch at fade weight `>= 0.5`
- Target-animation-only event dispatch during fades
- A simple state machine format with `bool` and `trigger` parameters
- Electron editor controls for state machines, states, parameters, transitions, and preview
- Unity runtime state machine APIs
- Importer summary counts and validation for state machine data
- `AnimationMixingStateMachineV10` Unity package sample

Not implemented in v10:

- Animation layers
- Blend trees
- Additive animation
- Avatar masks
- Graph node editor
- Curve editor
- Nested state machines
- Exit time rules
- Spine import/export or Spine runtime compatibility

## Blend Rule

The runtime samples the setup pose, applies the current animation, samples the next animation, and blends by fade weight.

Blend targets:

- Bone translate: linear
- Bone scale: linear
- Bone rotation: shortest angle lerp
- Slot color/alpha: linear
- Deform offsets: linear

Discrete timelines:

- Attachment timeline uses the current animation while fade weight is below `0.5`.
- Attachment timeline uses the target animation when fade weight is `0.5` or higher.
- Draw order follows the same threshold rule.
- Events are dispatched from the target animation only during a fade.

## State Machine JSON

`stateMachines` is a top-level array in exported `.suwol2d` and `.suwol2d.json` files.

```json
{
  "stateMachines": [
    {
      "name": "default",
      "initialState": "idle",
      "states": [
        { "name": "idle", "animation": "idle", "loop": true, "speed": 1 },
        { "name": "walk", "animation": "walk", "loop": true, "speed": 1 },
        { "name": "attack", "animation": "attack", "loop": false, "speed": 1 }
      ],
      "parameters": [
        { "name": "moving", "type": "bool", "defaultBool": false },
        { "name": "attack", "type": "trigger" }
      ],
      "transitions": [
        {
          "from": "idle",
          "to": "walk",
          "fadeDuration": 0.15,
          "conditions": [{ "parameter": "moving", "mode": "equals", "boolValue": true }]
        },
        {
          "from": "walk",
          "to": "idle",
          "fadeDuration": 0.15,
          "conditions": [{ "parameter": "moving", "mode": "equals", "boolValue": false }]
        },
        {
          "from": "*",
          "to": "attack",
          "fadeDuration": 0.05,
          "conditions": [{ "parameter": "attack", "mode": "triggered" }]
        }
      ]
    }
  ]
}
```

Transition order is significant. The first matching transition runs. A transition does not interrupt an already-running transition.

## Unity API

```csharp
var character = GetComponent<Suwol2DCharacter>();

character.Play("idle");
character.Play("walk", 0.15f);
character.CrossFade("attack", 0.05f);

Debug.Log(character.IsTransitioning());
Debug.Log(character.GetCurrentAnimationName());
Debug.Log(character.GetNextAnimationName());
Debug.Log(character.GetTransitionProgress());

character.PlayStateMachine("default");
character.SetBool("moving", true);
character.SetTrigger("attack");
```

Direct `Play` or `CrossFade` calls stop state machine control. `PlayStateMachine` starts control again from the state machine initial state.

## Electron Workflow

Use the `State Machines` section in the left panel to add or select a state machine. The inspector edits:

- State machine name and initial state
- States and their animation, loop, and speed values
- Bool and trigger parameters
- Ordered transitions and their conditions

The `State Machine Preview` panel can start/stop preview, toggle bool parameters, fire triggers, and show current state, next state, and transition progress.

The toolbar also includes `Mixing State Sample`, which creates an editor sample matching the Unity package sample.

## Unity Sample

Import the `Animation Mixing State Machine v10` sample from Unity Package Manager. Then run:

```text
Tools/Suwol2D/Create Animation Mixing State Machine v10 Demo
```

The demo object includes `Suwol2DStateMachineDemoController`, which toggles `moving` and fires `attack` in Play Mode.
