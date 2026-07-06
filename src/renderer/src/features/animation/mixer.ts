import type { Suwol2DAnimation, Suwol2DBone, Suwol2DDocument, Suwol2DSlot } from '../../../../shared/suwol2d-format';
import {
  type SampledSlotColor,
  type WorldBonePose,
  resolveDocumentWorldPose,
  sampleAttachmentOverrides,
  sampleDeformOffsets,
  sampleDocumentLocalPose,
  sampleDocumentPose,
  sampleDrawOrder,
  sampleSlotColor
} from './sampler';

export interface PreviewAnimationMix {
  fromAnimationName: string;
  fromTime: number;
  toAnimationName?: string;
  toTime?: number;
  weight: number;
}

export function isPreviewMixActive(mix: PreviewAnimationMix | null | undefined): mix is PreviewAnimationMix {
  return Boolean(mix?.toAnimationName && mix.weight > 0 && mix.weight < 1);
}

export function sampleMixedDocumentPose(document: Suwol2DDocument, mix: PreviewAnimationMix): Map<string, WorldBonePose> {
  if (!mix.toAnimationName || mix.weight <= 0) {
    return sampleDocumentPose(document, mix.fromAnimationName, mix.fromTime);
  }
  if (mix.weight >= 1) {
    return sampleDocumentPose(document, mix.toAnimationName, mix.toTime ?? 0);
  }

  const fromPose = sampleDocumentLocalPose(document, mix.fromAnimationName, mix.fromTime);
  const toPose = sampleDocumentLocalPose(document, mix.toAnimationName, mix.toTime ?? 0);
  const output = new Map<string, Suwol2DBone>();
  for (const bone of document.bones) {
    const from = fromPose.get(bone.name);
    const to = toPose.get(bone.name);
    if (!from && !to) {
      continue;
    }
    if (!from || !to) {
      output.set(bone.name, { ...(to ?? from) as WorldBonePose });
      continue;
    }

    output.set(bone.name, {
      ...from,
      x: lerp(from.x, to.x, mix.weight),
      y: lerp(from.y, to.y, mix.weight),
      rotation: lerpAngle(from.rotation, to.rotation, mix.weight),
      scaleX: lerp(from.scaleX, to.scaleX, mix.weight),
      scaleY: lerp(from.scaleY, to.scaleY, mix.weight)
    });
  }
  return resolveDocumentWorldPose(document, output);
}

export function sampleMixedDeformOffsets(
  document: Suwol2DDocument,
  mix: PreviewAnimationMix,
  slotName: string,
  attachmentName: string,
  vertexCount: number
): Array<{ x: number; y: number }> {
  const fromAnimation = findAnimation(document, mix.fromAnimationName);
  if (!mix.toAnimationName || mix.weight <= 0) {
    return sampleDeformOffsets(fromAnimation, slotName, attachmentName, vertexCount, mix.fromTime);
  }
  const toAnimation = findAnimation(document, mix.toAnimationName);
  if (mix.weight >= 1) {
    return sampleDeformOffsets(toAnimation, slotName, attachmentName, vertexCount, mix.toTime ?? 0);
  }

  const fromOffsets = sampleDeformOffsets(fromAnimation, slotName, attachmentName, vertexCount, mix.fromTime);
  const toOffsets = sampleDeformOffsets(toAnimation, slotName, attachmentName, vertexCount, mix.toTime ?? 0);
  return fromOffsets.map((offset, index) => ({
    x: lerp(offset.x, toOffsets[index]?.x ?? 0, mix.weight),
    y: lerp(offset.y, toOffsets[index]?.y ?? 0, mix.weight)
  }));
}

export function sampleMixedSlotColor(
  document: Suwol2DDocument,
  mix: PreviewAnimationMix,
  slotName: string
): SampledSlotColor {
  const fromAnimation = findAnimation(document, mix.fromAnimationName);
  if (!mix.toAnimationName || mix.weight <= 0) {
    return sampleSlotColor(fromAnimation, slotName, mix.fromTime);
  }
  const toAnimation = findAnimation(document, mix.toAnimationName);
  if (mix.weight >= 1) {
    return sampleSlotColor(toAnimation, slotName, mix.toTime ?? 0);
  }

  const from = sampleSlotColor(fromAnimation, slotName, mix.fromTime);
  const to = sampleSlotColor(toAnimation, slotName, mix.toTime ?? 0);
  return {
    r: lerp(from.r, to.r, mix.weight),
    g: lerp(from.g, to.g, mix.weight),
    b: lerp(from.b, to.b, mix.weight),
    a: lerp(from.a, to.a, mix.weight)
  };
}

export function sampleMixedAttachmentOverrides(document: Suwol2DDocument, mix: PreviewAnimationMix): Map<string, string | null> {
  const animation = getDiscreteAnimation(document, mix);
  const time = getDiscreteTime(mix);
  return sampleAttachmentOverrides(animation, time);
}

export function sampleMixedDrawOrder(document: Suwol2DDocument, mix: PreviewAnimationMix): Suwol2DSlot[] {
  const animation = getDiscreteAnimation(document, mix);
  const time = getDiscreteTime(mix);
  return sampleDrawOrder(document, animation, time);
}

export function getDiscreteAnimationName(mix: PreviewAnimationMix): string {
  return mix.toAnimationName && mix.weight >= 0.5 ? mix.toAnimationName : mix.fromAnimationName;
}

function getDiscreteAnimation(document: Suwol2DDocument, mix: PreviewAnimationMix): Suwol2DAnimation | undefined {
  return findAnimation(document, getDiscreteAnimationName(mix));
}

function getDiscreteTime(mix: PreviewAnimationMix): number {
  return mix.toAnimationName && mix.weight >= 0.5 ? mix.toTime ?? 0 : mix.fromTime;
}

function findAnimation(document: Suwol2DDocument, animationName: string | undefined): Suwol2DAnimation | undefined {
  return document.animations.find((animation) => animation.name === animationName);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const delta = normalizeDegrees(b - a);
  return normalizeDegrees(a + delta * t);
}

function normalizeDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
