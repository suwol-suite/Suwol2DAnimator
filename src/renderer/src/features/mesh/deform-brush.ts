import type {
  Suwol2DAnimation,
  Suwol2DDeformKey,
  Suwol2DDeformTimeline,
  Suwol2DMeshAttachment,
  Suwol2DVertexOffset
} from '../../../../shared/suwol2d-format';
import type { BrushVertexFalloff } from '../canvas/canvas-hit-test';

export interface DeformBrushKeyResult {
  timeline: Suwol2DDeformTimeline;
  key: Suwol2DDeformKey;
  createdTimeline: boolean;
  createdKey: boolean;
}

export function getOrCreateDeformBrushKey(
  animation: Suwol2DAnimation,
  attachment: Suwol2DMeshAttachment,
  time: number
): DeformBrushKeyResult {
  animation.deforms ??= [];
  let createdTimeline = false;
  let timeline = animation.deforms.find((candidate) => (
    candidate.slot === attachment.slot && candidate.attachment === attachment.name
  ));

  if (!timeline) {
    timeline = {
      slot: attachment.slot,
      attachment: attachment.name,
      keys: []
    };
    animation.deforms.push(timeline);
    animation.deforms.sort((a, b) => a.slot.localeCompare(b.slot) || a.attachment.localeCompare(b.attachment));
    createdTimeline = true;
  }

  const safeTime = Math.max(0, round(time));
  let createdKey = false;
  let key = timeline.keys.find((candidate) => Math.abs(candidate.time - safeTime) < 0.0001);
  if (!key) {
    key = {
      time: safeTime,
      offsets: createZeroOffsets(attachment.vertices.length)
    };
    timeline.keys.push(key);
    timeline.keys.sort((a, b) => a.time - b.time);
    createdKey = true;
  }

  ensureOffsetsForVertices(key, attachment.vertices.length);
  return { timeline, key, createdTimeline, createdKey };
}

export function applyDeformBrush(
  key: Suwol2DDeformKey,
  vertexFalloffs: BrushVertexFalloff[],
  deltaX: number,
  deltaY: number
): boolean {
  if ((!Number.isFinite(deltaX) && !Number.isFinite(deltaY)) || vertexFalloffs.length === 0) {
    return false;
  }

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  if (Math.hypot(safeDeltaX, safeDeltaY) <= 0.000001) {
    return false;
  }

  let changed = false;
  for (const { vertex, falloff } of vertexFalloffs) {
    if (vertex < 0 || falloff <= 0) {
      continue;
    }

    const offset = getOrCreateVertexOffset(key, vertex);
    offset.x = round(offset.x + safeDeltaX * falloff);
    offset.y = round(offset.y + safeDeltaY * falloff);
    changed = true;
  }

  key.offsets.sort((a, b) => a.vertex - b.vertex);
  return changed;
}

function createZeroOffsets(vertexCount: number): Suwol2DVertexOffset[] {
  return Array.from({ length: Math.max(0, vertexCount) }, (_, vertex) => ({ vertex, x: 0, y: 0 }));
}

function ensureOffsetsForVertices(key: Suwol2DDeformKey, vertexCount: number): void {
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    getOrCreateVertexOffset(key, vertex);
  }
  key.offsets = key.offsets.filter((offset) => offset.vertex >= 0 && offset.vertex < vertexCount);
  key.offsets.sort((a, b) => a.vertex - b.vertex);
}

function getOrCreateVertexOffset(key: Suwol2DDeformKey, vertex: number): Suwol2DVertexOffset {
  let offset = key.offsets.find((candidate) => candidate.vertex === vertex);
  if (!offset) {
    offset = { vertex, x: 0, y: 0 };
    key.offsets.push(offset);
  }

  return offset;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
