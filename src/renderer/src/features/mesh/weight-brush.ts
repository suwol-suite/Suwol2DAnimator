import type { Suwol2DBoneWeight, Suwol2DMeshAttachment, Suwol2DVertexWeight } from '../../../../shared/suwol2d-format';
import type { BrushVertexFalloff } from '../canvas/canvas-hit-test';

export interface ApplyWeightBrushOptions {
  boneName: string;
  vertexFalloffs: BrushVertexFalloff[];
  strength: number;
  erase: boolean;
  normalizeAfterPaint: boolean;
}

export function applyWeightBrush(attachment: Suwol2DMeshAttachment, options: ApplyWeightBrushOptions): boolean {
  const boneName = options.boneName.trim();
  const strength = clamp(options.strength, 0, 1);
  if (!boneName || strength <= 0 || options.vertexFalloffs.length === 0) {
    return false;
  }

  let changed = false;
  for (const { vertex, falloff } of options.vertexFalloffs) {
    if (vertex < 0 || vertex >= attachment.vertices.length || falloff <= 0) {
      continue;
    }

    const vertexWeight = getOrCreateVertexWeight(attachment, vertex);
    let boneWeight = vertexWeight.bones.find((candidate) => candidate.bone === boneName);
    if (!boneWeight && options.erase) {
      continue;
    }

    if (!boneWeight) {
      boneWeight = { bone: boneName, weight: 0 };
      vertexWeight.bones.push(boneWeight);
    }

    const wasOnlyBone = options.erase && vertexWeight.bones.length === 1 && vertexWeight.bones[0]?.bone === boneName;
    const nextWeight = clamp(boneWeight.weight + (options.erase ? -1 : 1) * strength * falloff, 0, 1);
    if (Math.abs(nextWeight - boneWeight.weight) > 0.000001) {
      changed = true;
      boneWeight.weight = nextWeight;
    }

    if (wasOnlyBone && options.normalizeAfterPaint && nextWeight < 0.9999) {
      boneWeight.weight = 0;
      changed = true;
    }

    removeEmptyBoneWeights(vertexWeight.bones);
    if (options.normalizeAfterPaint && vertexWeight.bones.length > 0) {
      normalizeBoneWeights(vertexWeight.bones);
    }
  }

  cleanupEmptyVertexWeights(attachment);
  return changed;
}

function getOrCreateVertexWeight(attachment: Suwol2DMeshAttachment, vertex: number): Suwol2DVertexWeight {
  attachment.weights ??= [];
  let vertexWeight = attachment.weights.find((candidate) => candidate.vertex === vertex);
  if (!vertexWeight) {
    vertexWeight = { vertex, bones: [] };
    attachment.weights.push(vertexWeight);
    attachment.weights.sort((a, b) => a.vertex - b.vertex);
  }

  return vertexWeight;
}

function removeEmptyBoneWeights(weights: Suwol2DBoneWeight[]): void {
  for (let index = weights.length - 1; index >= 0; index -= 1) {
    const weight = weights[index];
    if (!Number.isFinite(weight.weight) || weight.weight <= 0.0001 || !weight.bone.trim()) {
      weights.splice(index, 1);
    }
  }
}

function cleanupEmptyVertexWeights(attachment: Suwol2DMeshAttachment): void {
  attachment.weights = (attachment.weights ?? []).filter((weight) => weight.bones.length > 0);
  if (attachment.weights.length === 0) {
    attachment.weights = undefined;
  }
}

function normalizeBoneWeights(weights: Suwol2DBoneWeight[]): void {
  const positive = weights.filter((weight) => Number.isFinite(weight.weight) && weight.weight > 0);
  const sum = positive.reduce((total, weight) => total + weight.weight, 0);
  if (sum <= 0) {
    return;
  }

  for (const weight of weights) {
    weight.weight = clamp(weight.weight, 0, Number.POSITIVE_INFINITY) / sum;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}
