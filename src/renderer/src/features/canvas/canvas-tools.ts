import type { Suwol2DClippingAttachment, Suwol2DMeshAttachment } from '../../../../shared/suwol2d-format';

export type CanvasToolMode = 'select' | 'moveVertex' | 'weightBrush' | 'deformBrush' | 'pan';

export interface CanvasVertexSelection {
  attachment: string;
  vertices: number[];
  targetType?: 'mesh' | 'clipping';
}

export interface CanvasBrushSettings {
  boneName: string;
  radius: number;
  strength: number;
  normalizeAfterPaint: boolean;
  eraseMode: boolean;
}

export const canvasToolModes: CanvasToolMode[] = ['select', 'moveVertex', 'weightBrush', 'deformBrush', 'pan'];

export const defaultCanvasBrushSettings: CanvasBrushSettings = {
  boneName: 'root',
  radius: 36,
  strength: 0.25,
  normalizeAfterPaint: true,
  eraseMode: false
};

export function sanitizeBrushRadius(value: number): number {
  return clampFinite(value, 4, 240);
}

export function sanitizeBrushStrength(value: number): number {
  return clampFinite(value, 0, 1);
}

export function normalizeCanvasVertexSelection(
  selection: CanvasVertexSelection | null,
  attachment: Suwol2DMeshAttachment | Suwol2DClippingAttachment | undefined
): CanvasVertexSelection | null {
  if (!selection || !attachment || selection.attachment !== attachment.name) {
    return null;
  }

  const targetType = attachment.type === 'clipping' ? 'clipping' : 'mesh';
  if ((selection.targetType ?? 'mesh') !== targetType) {
    return null;
  }

  const vertexCount = attachment.type === 'clipping'
    ? attachment.clippingVertices.length
    : attachment.vertices.length;
  const vertices = uniqueSortedIntegers(selection.vertices)
    .filter((vertex) => vertex >= 0 && vertex < vertexCount);
  return vertices.length > 0 ? { attachment: selection.attachment, vertices, targetType } : null;
}

export function updateCanvasVertexSelection(
  current: CanvasVertexSelection | null,
  attachmentName: string,
  vertex: number,
  additive: boolean,
  targetType: 'mesh' | 'clipping' = 'mesh'
): CanvasVertexSelection | null {
  if (!additive || current?.attachment !== attachmentName || (current.targetType ?? 'mesh') !== targetType) {
    return { attachment: attachmentName, vertices: [vertex], targetType };
  }

  const vertices = new Set(current.vertices);
  if (vertices.has(vertex)) {
    vertices.delete(vertex);
  } else {
    vertices.add(vertex);
  }

  const next = uniqueSortedIntegers([...vertices]);
  return next.length > 0 ? { attachment: attachmentName, vertices: next, targetType } : null;
}

function uniqueSortedIntegers(values: number[]): number[] {
  return [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b);
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}
