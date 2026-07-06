import type {
  Suwol2DAnimation,
  Suwol2DBone,
  Suwol2DDeformKey,
  Suwol2DDocument,
  Suwol2DDrawOrderKey,
  Suwol2DEventKey,
  Suwol2DRotateKey,
  Suwol2DScaleKey,
  Suwol2DSlot,
  Suwol2DSlotColorKey,
  Suwol2DTransformConstraint,
  Suwol2DTranslateKey
} from '../../../../shared/suwol2d-format';
import { interpolateFactor, lerpAngleShortest, lerpNumber } from '../../../../shared/interpolation';
import { getEffectiveAnimationDuration } from './timeline-duration';

export interface WorldBonePose extends Suwol2DBone {
  worldX: number;
  worldY: number;
  worldRotation: number;
  worldScaleX: number;
  worldScaleY: number;
}

export interface SampledSlotColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function getAnimationDuration(animation: Suwol2DAnimation | undefined): number {
  return getEffectiveAnimationDuration(animation);
}

export function sampleDocumentPose(document: Suwol2DDocument, animationName: string, time: number): Map<string, WorldBonePose> {
  return resolveDocumentWorldPose(document, sampleDocumentLocalPose(document, animationName, time));
}

export function sampleDocumentLocalPose(document: Suwol2DDocument, animationName: string, time: number): Map<string, Suwol2DBone> {
  const localBones = new Map<string, Suwol2DBone>();
  const animation = document.animations.find((candidate) => candidate.name === animationName);
  const duration = getAnimationDuration(animation);
  const sampleTime = animation && animation.loop && duration > 0 ? positiveModulo(time, duration) : Math.min(time, duration);

  for (const bone of document.bones) {
    localBones.set(bone.name, { ...bone });
  }

  if (animation) {
    for (const timeline of animation.bones) {
      const bone = localBones.get(timeline.bone);
      if (!bone) {
        continue;
      }

      const translate = sampleTranslate(timeline.translate, sampleTime);
      const rotate = sampleRotate(timeline.rotate, sampleTime);
      const scale = sampleScale(timeline.scale, sampleTime);

      if (translate) {
        bone.x = translate.x;
        bone.y = translate.y;
      }
      if (rotate !== null) {
        bone.rotation = rotate;
      }
      if (scale) {
        bone.scaleX = scale.scaleX;
        bone.scaleY = scale.scaleY;
      }
    }
  }

  return localBones;
}

export function resolveDocumentWorldPose(document: Suwol2DDocument, localBones: Map<string, Suwol2DBone>): Map<string, WorldBonePose> {
  let worldBones = calculateWorldBones(document, localBones);
  const transformConstraints = [...(document.transformConstraints ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const constraint of transformConstraints) {
    if (constraint.enabled === false || Math.max(constraint.translateMix, constraint.rotateMix, constraint.scaleMix) <= 0) {
      continue;
    }

    if (applyTransformConstraint(localBones, worldBones, constraint)) {
      worldBones = calculateWorldBones(document, localBones);
    }
  }

  const constraints = [...(document.ikConstraints ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const constraint of constraints) {
    if (constraint.enabled === false || constraint.mix <= 0) {
      continue;
    }

    if (applyTwoBoneIk(document, localBones, worldBones, constraint)) {
      worldBones = calculateWorldBones(document, localBones);
    }
  }

  return worldBones;
}

export function sampleDeformOffsets(
  animation: Suwol2DAnimation | undefined,
  slotName: string,
  attachmentName: string,
  vertexCount: number,
  time: number
): Array<{ x: number; y: number }> {
  const zeroOffsets = createZeroOffsets(vertexCount);
  if (!animation || vertexCount <= 0) {
    return zeroOffsets;
  }

  const timeline = (animation.deforms ?? []).find((candidate) => (
    candidate.slot === slotName && candidate.attachment === attachmentName
  ));
  if (!timeline || timeline.keys.length === 0) {
    return zeroOffsets;
  }

  const duration = getAnimationDuration(animation);
  const sampleTime = animation.loop && duration > 0 ? positiveModulo(time, duration) : Math.min(time, duration);
  const keys = [...timeline.keys].sort((a, b) => a.time - b.time);

  if (keys.length === 1 || sampleTime <= keys[0].time) {
    return offsetsForKey(keys[0], vertexCount);
  }

  const last = keys[keys.length - 1];
  if (sampleTime >= last.time) {
    return offsetsForKey(last, vertexCount);
  }

  for (let index = 0; index < keys.length - 1; index += 1) {
    const previous = keys[index];
    const next = keys[index + 1];
    if (sampleTime <= next.time) {
      const t = interpolateFactor(previous.interpolation, inverseLerp(previous.time, next.time, sampleTime));
      return interpolateOffsets(previous, next, vertexCount, t);
    }
  }

  return offsetsForKey(last, vertexCount);
}

export function sampleAttachmentOverrides(
  animation: Suwol2DAnimation | undefined,
  time: number
): Map<string, string | null> {
  const overrides = new Map<string, string | null>();
  if (!animation) {
    return overrides;
  }

  const sampleTime = getSampleTime(animation, time);
  for (const timeline of animation.attachments ?? []) {
    const keys = [...(timeline.keys ?? [])].sort((a, b) => a.time - b.time);
    if (!timeline.slot || keys.length === 0) {
      continue;
    }

    const key = lastKeyAtOrBefore(keys, sampleTime);
    if (key) {
      overrides.set(timeline.slot, key.attachment?.trim() || null);
    }
  }

  return overrides;
}

export function sampleDrawOrder(document: Suwol2DDocument, animation: Suwol2DAnimation | undefined, time: number): Suwol2DSlot[] {
  const setupSlots = [...document.slots].sort((a, b) => a.drawOrder - b.drawOrder || a.name.localeCompare(b.name));
  if (!animation || (animation.drawOrders ?? []).length === 0) {
    return setupSlots;
  }

  const sampleTime = getSampleTime(animation, time);
  const key = lastKeyAtOrBefore([...(animation.drawOrders ?? [])].sort((a, b) => a.time - b.time), sampleTime);
  if (!key) {
    return setupSlots;
  }

  const setupOrder = new Map(setupSlots.map((slot, index) => [slot.name, index]));
  const order = new Map(setupSlots.map((slot, index) => [slot.name, slot.drawOrder ?? index]));
  for (const entry of key.slots ?? []) {
    if (setupOrder.has(entry.slot) && Number.isFinite(entry.drawOrder)) {
      order.set(entry.slot, entry.drawOrder);
    }
  }

  return [...document.slots].sort((a, b) => (
    (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0)
    || (setupOrder.get(a.name) ?? 0) - (setupOrder.get(b.name) ?? 0)
    || a.name.localeCompare(b.name)
  ));
}

export function sampleSlotColor(animation: Suwol2DAnimation | undefined, slotName: string, time: number): SampledSlotColor {
  const white = { r: 1, g: 1, b: 1, a: 1 };
  if (!animation) {
    return white;
  }

  const timeline = (animation.slots ?? []).find((candidate) => candidate.slot === slotName);
  const keys = [...(timeline?.color ?? [])].sort((a, b) => a.time - b.time);
  if (keys.length === 0) {
    return white;
  }

  const sampleTime = getSampleTime(animation, time);
  if (keys.length === 1 || sampleTime <= keys[0].time) {
    return colorForKey(keys[0]);
  }

  const last = keys[keys.length - 1];
  if (sampleTime >= last.time) {
    return colorForKey(last);
  }

  for (let index = 0; index < keys.length - 1; index += 1) {
    const previous = keys[index];
    const next = keys[index + 1];
    if (sampleTime <= next.time) {
      const t = interpolateFactor(previous.interpolation, inverseLerp(previous.time, next.time, sampleTime));
      return {
        r: lerpNumber(previous.r, next.r, t),
        g: lerpNumber(previous.g, next.g, t),
        b: lerpNumber(previous.b, next.b, t),
        a: lerpNumber(previous.a, next.a, t)
      };
    }
  }

  return colorForKey(last);
}

export function collectEventsBetween(
  animation: Suwol2DAnimation | undefined,
  previousTime: number,
  currentTime: number
): Suwol2DEventKey[] {
  if (!animation || (animation.events ?? []).length === 0 || currentTime < previousTime) {
    return [];
  }

  const events = [...(animation.events ?? [])]
    .filter((event) => event.name.trim())
    .sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
  if (events.length === 0) {
    return [];
  }

  const duration = getAnimationDuration(animation);
  if (!animation.loop || duration <= 0) {
    return events.filter((event) => event.time > previousTime && event.time <= currentTime);
  }

  const output: Suwol2DEventKey[] = [];
  let cursor = previousTime;
  while (cursor < currentTime) {
    const loopStart = Math.floor(cursor / duration) * duration;
    const loopEnd = loopStart + duration;
    const segmentEnd = Math.min(currentTime, loopEnd);
    const from = cursor - loopStart;
    const to = segmentEnd - loopStart;
    for (const event of events) {
      if (event.time > from && event.time <= to) {
        output.push(event);
      }
    }
    cursor = segmentEnd;
    if (Math.abs(cursor - loopEnd) < 0.000001) {
      for (const event of events) {
        if (event.time === 0) {
          output.push(event);
        }
      }
      cursor += 0.000001;
    }
  }

  return output;
}

function computeWorldBone(
  boneName: string,
  localBones: Map<string, Suwol2DBone>,
  worldBones: Map<string, WorldBonePose>
): WorldBonePose | null {
  const existing = worldBones.get(boneName);
  if (existing) {
    return existing;
  }

  const bone = localBones.get(boneName);
  if (!bone) {
    return null;
  }

  const parent = bone.parent ? computeWorldBone(bone.parent, localBones, worldBones) : null;
  let worldBone: WorldBonePose;
  if (!parent) {
    worldBone = {
      ...bone,
      worldX: bone.x,
      worldY: bone.y,
      worldRotation: bone.rotation,
      worldScaleX: bone.scaleX,
      worldScaleY: bone.scaleY
    };
  } else {
    const scaledX = bone.x * parent.worldScaleX;
    const scaledY = bone.y * parent.worldScaleY;
    const rotated = rotatePoint(scaledX, scaledY, parent.worldRotation);
    worldBone = {
      ...bone,
      worldX: parent.worldX + rotated.x,
      worldY: parent.worldY + rotated.y,
      worldRotation: parent.worldRotation + bone.rotation,
      worldScaleX: parent.worldScaleX * bone.scaleX,
      worldScaleY: parent.worldScaleY * bone.scaleY
    };
  }

  worldBones.set(boneName, worldBone);
  return worldBone;
}

function calculateWorldBones(document: Suwol2DDocument, localBones: Map<string, Suwol2DBone>): Map<string, WorldBonePose> {
  const worldBones = new Map<string, WorldBonePose>();
  for (const bone of document.bones) {
    computeWorldBone(bone.name, localBones, worldBones);
  }
  return worldBones;
}

function applyTransformConstraint(
  localBones: Map<string, Suwol2DBone>,
  worldBones: Map<string, WorldBonePose>,
  constraint: Suwol2DTransformConstraint
): boolean {
  const local = localBones.get(constraint.bone);
  const world = worldBones.get(constraint.bone);
  const target = worldBones.get(constraint.targetBone);
  if (!local || !world || !target || constraint.bone === constraint.targetBone) {
    return false;
  }

  const translateMix = clamp(safeNumber(constraint.translateMix, 1), 0, 1);
  const rotateMix = clamp(safeNumber(constraint.rotateMix, 1), 0, 1);
  const scaleMix = clamp(safeNumber(constraint.scaleMix, 1), 0, 1);
  if (translateMix <= 0 && rotateMix <= 0 && scaleMix <= 0) {
    return false;
  }

  const desiredWorldX = lerpNumber(world.worldX, target.worldX + safeNumber(constraint.offsetX, 0), translateMix);
  const desiredWorldY = lerpNumber(world.worldY, target.worldY + safeNumber(constraint.offsetY, 0), translateMix);
  const desiredWorldRotation = lerpAngle(world.worldRotation, target.worldRotation + safeNumber(constraint.offsetRotation, 0), rotateMix);
  const desiredWorldScaleX = lerpNumber(world.worldScaleX, target.worldScaleX + safeNumber(constraint.offsetScaleX, 0), scaleMix);
  const desiredWorldScaleY = lerpNumber(world.worldScaleY, target.worldScaleY + safeNumber(constraint.offsetScaleY, 0), scaleMix);

  const parent = local.parent ? worldBones.get(local.parent) : null;
  if (!parent) {
    local.x = desiredWorldX;
    local.y = desiredWorldY;
    local.rotation = normalizeDegrees(desiredWorldRotation);
    local.scaleX = sanitizeScale(desiredWorldScaleX);
    local.scaleY = sanitizeScale(desiredWorldScaleY);
    return true;
  }

  const delta = {
    x: desiredWorldX - parent.worldX,
    y: desiredWorldY - parent.worldY
  };
  const unrotated = rotatePoint(delta.x, delta.y, -parent.worldRotation);
  local.x = safeDivide(unrotated.x, parent.worldScaleX, local.x);
  local.y = safeDivide(unrotated.y, parent.worldScaleY, local.y);
  local.rotation = normalizeDegrees(desiredWorldRotation - parent.worldRotation);
  local.scaleX = sanitizeScale(safeDivide(desiredWorldScaleX, parent.worldScaleX, local.scaleX));
  local.scaleY = sanitizeScale(safeDivide(desiredWorldScaleY, parent.worldScaleY, local.scaleY));
  return true;
}

function applyTwoBoneIk(
  document: Suwol2DDocument,
  localBones: Map<string, Suwol2DBone>,
  worldBones: Map<string, WorldBonePose>,
  constraint: NonNullable<Suwol2DDocument['ikConstraints']>[number]
): boolean {
  const parentLocal = localBones.get(constraint.parentBone);
  const childLocal = localBones.get(constraint.childBone);
  const parentWorld = worldBones.get(constraint.parentBone);
  const targetWorld = worldBones.get(constraint.targetBone);
  if (!parentLocal || !childLocal || !parentWorld || !targetWorld) {
    return false;
  }

  const parentLength = resolveIkBoneLength(document, parentLocal, localBones);
  const childLength = resolveIkBoneLength(document, childLocal, localBones);
  if (parentLength <= 0 || childLength <= 0) {
    return false;
  }

  const start = { x: parentWorld.worldX, y: parentWorld.worldY };
  const target = { x: targetWorld.worldX, y: targetWorld.worldY };
  const toTarget = { x: target.x - start.x, y: target.y - start.y };
  const rawDistance = Math.hypot(toTarget.x, toTarget.y);
  if (!Number.isFinite(rawDistance) || rawDistance <= 0.00001) {
    return false;
  }

  const minDistance = Math.max(0.0001, Math.abs(parentLength - childLength) + 0.0001);
  const maxDistance = Math.max(minDistance, parentLength + childLength - 0.0001);
  const distance = Math.max(minDistance, Math.min(maxDistance, rawDistance));
  const angleToTarget = Math.atan2(toTarget.y, toTarget.x);
  const bend = constraint.bendDirection === -1 ? -1 : 1;
  const parentAngleOffset = Math.acos(clamp((distance * distance + parentLength * parentLength - childLength * childLength) / (2 * distance * parentLength), -1, 1));
  const desiredParentWorldRotation = radiansToDegrees(angleToTarget - bend * parentAngleOffset);

  const elbow = {
    x: start.x + Math.cos(degreesToRadians(desiredParentWorldRotation)) * parentLength,
    y: start.y + Math.sin(degreesToRadians(desiredParentWorldRotation)) * parentLength
  };
  const desiredChildWorldRotation = radiansToDegrees(Math.atan2(target.y - elbow.y, target.x - elbow.x));
  const parentParentWorldRotation = parentWorld.parent ? worldBones.get(parentWorld.parent)?.worldRotation ?? 0 : 0;
  const desiredParentLocalRotation = normalizeDegrees(desiredParentWorldRotation - parentParentWorldRotation);
  const desiredChildLocalRotation = normalizeDegrees(desiredChildWorldRotation - desiredParentWorldRotation);
  const mix = clamp(constraint.mix, 0, 1);

  parentLocal.rotation = lerpAngle(parentLocal.rotation, desiredParentLocalRotation, mix);
  childLocal.rotation = lerpAngle(childLocal.rotation, desiredChildLocalRotation, mix);
  return true;
}

function resolveIkBoneLength(document: Suwol2DDocument, bone: Suwol2DBone, localBones: Map<string, Suwol2DBone>): number {
  if (Number.isFinite(bone.length) && (bone.length ?? 0) > 0) {
    return bone.length ?? 0;
  }

  const child = document.bones.map((candidate) => localBones.get(candidate.name) ?? candidate).find((candidate) => candidate.parent === bone.name);
  if (child) {
    const distance = Math.hypot(child.x, child.y);
    if (distance > 0) {
      return distance;
    }
  }

  return 50;
}

function sampleTranslate(keys: Suwol2DTranslateKey[], time: number): { x: number; y: number } | null {
  if (keys.length === 0) return null;
  if (keys.length === 1 || time <= keys[0].time) return { x: keys[0].x, y: keys[0].y };
  const last = keys[keys.length - 1];
  if (time >= last.time) return { x: last.x, y: last.y };

  for (let index = 0; index < keys.length - 1; index += 1) {
    const previous = keys[index];
    const next = keys[index + 1];
    if (time <= next.time) {
      const t = interpolateFactor(previous.interpolation, inverseLerp(previous.time, next.time, time));
      return {
        x: lerpNumber(previous.x, next.x, t),
        y: lerpNumber(previous.y, next.y, t)
      };
    }
  }

  return { x: last.x, y: last.y };
}

function sampleRotate(keys: Suwol2DRotateKey[], time: number): number | null {
  if (keys.length === 0) return null;
  if (keys.length === 1 || time <= keys[0].time) return keys[0].rotation;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.rotation;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const previous = keys[index];
    const next = keys[index + 1];
    if (time <= next.time) {
      const t = interpolateFactor(previous.interpolation, inverseLerp(previous.time, next.time, time));
      return lerpAngleShortest(previous.rotation, next.rotation, t);
    }
  }

  return last.rotation;
}

function sampleScale(keys: Suwol2DScaleKey[], time: number): { scaleX: number; scaleY: number } | null {
  if (keys.length === 0) return null;
  if (keys.length === 1 || time <= keys[0].time) return { scaleX: keys[0].scaleX, scaleY: keys[0].scaleY };
  const last = keys[keys.length - 1];
  if (time >= last.time) return { scaleX: last.scaleX, scaleY: last.scaleY };

  for (let index = 0; index < keys.length - 1; index += 1) {
    const previous = keys[index];
    const next = keys[index + 1];
    if (time <= next.time) {
      const t = interpolateFactor(previous.interpolation, inverseLerp(previous.time, next.time, time));
      return {
        scaleX: lerpNumber(previous.scaleX, next.scaleX, t),
        scaleY: lerpNumber(previous.scaleY, next.scaleY, t)
      };
    }
  }

  return { scaleX: last.scaleX, scaleY: last.scaleY };
}

function getSampleTime(animation: Suwol2DAnimation, time: number): number {
  const duration = getAnimationDuration(animation);
  return animation.loop && duration > 0 ? positiveModulo(time, duration) : Math.min(time, duration);
}

function lastKeyAtOrBefore<T extends { time: number }>(keys: T[], time: number): T | null {
  let selected: T | null = null;
  for (const key of keys) {
    if (key.time <= time) {
      selected = key;
    } else {
      break;
    }
  }
  return selected ?? keys[0] ?? null;
}

function colorForKey(key: Suwol2DSlotColorKey): SampledSlotColor {
  return {
    r: clamp(key.r, 0, 1),
    g: clamp(key.g, 0, 1),
    b: clamp(key.b, 0, 1),
    a: clamp(key.a, 0, 1)
  };
}

function createZeroOffsets(vertexCount: number): Array<{ x: number; y: number }> {
  return Array.from({ length: Math.max(0, vertexCount) }, () => ({ x: 0, y: 0 }));
}

function offsetsForKey(key: Suwol2DDeformKey, vertexCount: number): Array<{ x: number; y: number }> {
  const offsets = createZeroOffsets(vertexCount);
  for (const offset of key.offsets ?? []) {
    if (Number.isInteger(offset.vertex) && offset.vertex >= 0 && offset.vertex < vertexCount) {
      offsets[offset.vertex] = { x: offset.x, y: offset.y };
    }
  }
  return offsets;
}

function interpolateOffsets(previous: Suwol2DDeformKey, next: Suwol2DDeformKey, vertexCount: number, t: number): Array<{ x: number; y: number }> {
  const previousOffsets = offsetsForKey(previous, vertexCount);
  const nextOffsets = offsetsForKey(next, vertexCount);
  return previousOffsets.map((offset, index) => ({
    x: lerpNumber(offset.x, nextOffsets[index].x, t),
    y: lerpNumber(offset.y, nextOffsets[index].y, t)
  }));
}

export function rotatePoint(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
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

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function safeDivide(value: number, divisor: number, fallback: number): number {
  return Number.isFinite(divisor) && Math.abs(divisor) > 0.000001 ? value / divisor : fallback;
}

function sanitizeScale(value: number): number {
  return Number.isFinite(value) && Math.abs(value) > 0.000001 ? value : 0.000001;
}

function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 1;
  return Math.max(0, Math.min(1, (value - a) / (b - a)));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
