# Brush Editing / Canvas Direct Editing v16

v16 makes mesh editing less dependent on numeric inspector fields. The Electron
editor can now select and move mesh vertices directly on the preview canvas, and
can paint existing weight/deform data with lightweight brushes.

Unity Runtime data compatibility is intentionally unchanged. The editor still
writes the same mesh `vertices`, mesh `weights`, and animation `deforms`
structures that the existing exporter and Unity runtime already consume.

## Canvas Tool Modes

The preview canvas exposes these modes from the canvas overlay:

```text
Select
Move Vertex
Weight Brush
Deform Brush
Pan
```

Keyboard shortcuts are available when focus is not inside an input, textarea, or
select:

```text
V      Select
M      Move Vertex
W      Weight Brush
D      Deform Brush
Space  Temporary pan
```

Middle drag and right drag also pan the canvas.

## Vertex Selection And Movement

Select or Move Vertex mode can click visible mesh vertices on the canvas.

- Click selects one vertex.
- Shift+click toggles vertices in the current mesh selection.
- Selected vertices are highlighted on the mesh wireframe.
- Move Vertex mode drags the selected vertices in attachment-local coordinates.
- The move writes to `mesh.vertices[].x/y`.
- Triangle indices, UVs, weights, and deform offsets are not rewritten by a
  vertex move.

The coordinate conversion uses the same preview pose, attachment transform,
zoom, and pan state used for drawing, so hit testing stays aligned while the
canvas is zoomed or panned.

## Weight Brush

Weight Brush mode edits the active mesh attachment selected in the inspector or
canvas.

Options:

```text
Brush Bone
Brush Radius
Brush Strength
Normalize
Erase
```

Behavior:

- Dragging paints vertices within the brush radius.
- Falloff is `1 - distance / radius`.
- Paint mode increases the selected bone weight.
- Erase mode decreases or removes the selected bone weight.
- When Normalize is enabled, each touched vertex weight list is normalized after
  painting.
- Vertices with no weights keep the existing rigid fallback behavior.

The existing numeric weight editor, Auto Rigid Weights, Normalize Selected
Vertex, Normalize All Vertices, and Clear Weights controls remain available.

## Deform Brush

Deform Brush mode edits the active mesh attachment at the current animation time.

Behavior:

- An active animation is required.
- The current time is snapped through the existing timeline snap setting.
- If the current animation has no deform timeline for the active mesh, one is
  created.
- If there is no deform key at the snapped current time, one is created.
- Drag delta is applied to vertex offsets inside the brush radius.
- Base mesh vertices are not modified by the deform brush.

The existing Reset Selected Deform Key and Clear Deform Timeline controls remain
available.

## Undo / Redo And Dirty State

Each canvas stroke creates one undo step. Continuous pointer movement inside the
same stroke updates the project without adding additional undo entries. Canvas
edits mark the project dirty and continue through the existing validation and
export flow.

## Localization And UI Dogfooding

v16 adds `canvas.*` and mesh editing keys to both locale files:

```text
src/shared/i18n/locales/ko.json
src/shared/i18n/locales/en.json
```

`npm.cmd run verify:locales` checks that both languages keep the same key
structure.

The Electron toolbar keeps the language selector visible and groups sample
creation into a dropdown so export actions and preview controls remain usable
in packaged builds. The native Electron menu follows the selected app locale;
production packaged builds do not show development-only reload/devtools menu
items.

## Limitations

- Brush radius is screen-space pixels, not texture pixels.
- Weight color visualization is intentionally minimal.
- Deform brush edits one key at the current snapped time; graph editor workflows
  are still out of scope.
- The Unity package UI is not localized in this step.
- User-authored data names are not auto-translated.
- OS-owned file dialogs, security prompts, and development overlays are outside
  the app localization scope.
- Spine import/export/runtime compatibility, atlas packing, clipping,
  path/transform constraints, animation layers, and blend trees are not included.
