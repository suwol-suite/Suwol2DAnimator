# Animation Mixing State Machine v10 Sample

This sample demonstrates the first Suwol2D single-layer animation mixing path.

Contents:

- `sample_animation_mixing_state_machine.suwol2d`
- `sample_animation_mixing_state_machine.suwol2d.json`
- `Textures/body.png`
- `Textures/arm.png`
- `Textures/sword.png`
- `Textures/axe.png`

The document contains `idle`, `walk`, and `attack` animations plus one state machine named `default`.

State machine parameters:

- `moving` bool
- `attack` trigger

Transitions:

- `idle` to `walk` when `moving == true`, fade `0.15`
- `walk` to `idle` when `moving == false`, fade `0.15`
- `*` to `attack` when `attack` is triggered, fade `0.05`

Import the sample through Unity Package Manager, then run:

```text
Tools/Suwol2D/Create Animation Mixing State Machine v10 Demo
```

Enter Play Mode to see the demo controller toggle `moving` and fire `attack`.

This sample intentionally does not include animation layers, blend trees, additive animation, graph editing, clipping, atlas packing, or Spine compatibility.
