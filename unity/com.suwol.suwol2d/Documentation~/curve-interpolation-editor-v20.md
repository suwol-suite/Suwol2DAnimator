# Curve / Interpolation Editor v20

The Unity package supports the v20 keyframe interpolation presets exported by
the Electron editor.

## Presets

- `stepped`
- `linear`
- `easeIn`
- `easeOut`
- `easeInOut`

Missing or unknown values are treated as `linear`.

## Runtime Coverage

Interpolation is applied to continuous timelines:

- bone translate
- bone rotate
- bone scale
- slot color and alpha
- deform offsets

Discrete timelines remain stepped by design:

- attachment changes
- draw order changes
- event keys

State machine crossfade weights continue to use linear fade progress in v20.

## JSON Example

```json
{
  "time": 0.5,
  "rotation": 45,
  "interpolation": "easeInOut"
}
```

## Sample

Import `Samples~/CurveInterpolationV20` to inspect
`sample_curve_interpolation.suwol2d`. The `curve_test` animation includes all
five interpolation presets across transform, slot color, and deform keys.

## Not Included

The package does not include custom bezier handle editing, graph curve editing,
animation layers, blend trees, or Spine runtime integration.
