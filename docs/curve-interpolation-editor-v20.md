# Curve / Interpolation Editor v20

v20 adds preset interpolation to continuous animation keyframes so Electron
preview and Unity runtime playback use the same timing.

## Supported Presets

- `stepped`: holds the current key value until the next key.
- `linear`: keeps the previous behavior.
- `easeIn`: accelerates into the next key.
- `easeOut`: decelerates toward the next key.
- `easeInOut`: eases both ends of the segment.

Missing or unknown interpolation values fall back to `linear` at runtime.
Export normalizes continuous keyframes and writes an explicit interpolation
value.

## Timeline Coverage

Interpolation applies to:

- bone translate
- bone rotate
- bone scale
- slot color and alpha
- deform timelines

Interpolation does not apply to discrete timelines:

- attachment keys
- draw order keys
- event keys
- state machine transition conditions
- IK constraints
- skin swaps

If a discrete key contains an interpolation field, validation warns that the
field will be ignored.

## Format Example

```json
{
  "time": 0.5,
  "x": 10,
  "y": 20,
  "interpolation": "easeInOut"
}
```

The `interpolation` field is valid on translate, rotate, scale, slot color, and
deform keys.

## Electron Editor

The selected key inspector shows an interpolation selector for supported key
types. Copy, paste, duplicate, and same-time replacement preserve the selected
interpolation value. The timeline key list includes the preset name for
continuous keys and omits it for discrete keys.

The sample menu includes `Interpolation Sample`, which creates
`sample_curve_interpolation` with `idle`, `walk`, and `curve_test` animations.

## Unity Runtime

Unity parses the interpolation field on continuous key data. Sampling uses the
same preset functions as the Electron preview:

- transform timelines sample through `Suwol2DAnimationSampler` and
  `Suwol2DAnimationMixer`
- slot colors sample through `Suwol2DSlotColorTimelineSampler`
- deform offsets sample through `Suwol2DDeformSampler`

Crossfade weights and state machine transition fade durations remain linear in
v20.

## Not Included

v20 does not add:

- custom bezier handles
- a graph curve editor
- animation layers
- blend trees
- Spine import/export/runtime compatibility
