import type { Suwol2DMeshAttachment } from '../../../../shared/suwol2d-format';

export type CanvasToolMode = 'select' | 'moveVertex' | 'weightBrush' | 'deformBrush' | 'pan';

export interface CanvasVertexSelection {
  attachment: string;
  vertices: number[];
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
  attachment: Suwol2DMeshAttachment | undefined
): CanvasVertexSelection | null {
  if (!selection || !attachment || selection.attachment !== attachment.name) {
    return null;
  }

  const vertices = uniqueSortedIntegers(selection.vertices)
    .filter((vertex) => vertex >= 0 && vertex < attachment.vertices.length);
  return vertices.length > 0 ? { attachment: selection.attachment, vertices } : null;
}

export function updateCanvasVertexSelection(
  current: CanvasVertexSelection | null,
  attachmentName: string,
  vertex: number,
  additive: boolean
): CanvasVertexSelection | null {
  if (!additive || current?.attachment !== attachmentName) {
    return { attachment: attachmentName, vertices: [vertex] };
  }

  const vertices = new Set(current.vertices);
  if (vertices.has(vertex)) {
    vertices.delete(vertex);
  } else {
    vertices.add(vertex);
  }

  const next = uniqueSortedIntegers([...vertices]);
  return next.length > 0 ? { attachment: attachmentName, vertices: next } : null;
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
