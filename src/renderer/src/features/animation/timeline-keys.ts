import type {
  Suwol2DAnimation,
  Suwol2DAttachmentKey,
  Suwol2DDeformKey,
  Suwol2DDocument,
  Suwol2DDrawOrderKey,
  Suwol2DEventKey,
  Suwol2DRotateKey,
  Suwol2DScaleKey,
  Suwol2DSlotColorKey,
  Suwol2DTranslateKey
} from '../../../../shared/suwol2d-format';
import { normalizeInterpolation } from '../../../../shared/interpolation';

export type TimelineKeyType =
  | 'boneTranslate'
  | 'boneRotate'
  | 'boneScale'
  | 'deform'
  | 'attachment'
  | 'drawOrder'
  | 'slotColor'
  | 'event';

export type TimelineKeyFilter = 'all' | 'bone' | 'deform' | 'attachment' | 'drawOrder' | 'slotColor' | 'event';

export interface TimelineKeySelection {
  type: TimelineKeyType;
  animation: string;
  target: string;
  keyIndex: number;
}

export interface TimelineKeyRow {
  id: string;
  selection: TimelineKeySelection;
  time: number;
  typeLabel: string;
  targetLabel: string;
  valueLabel: string;
  filter: TimelineKeyFilter;
  searchText: string;
}

export type TimelineClipboard = Omit<TimelineKeySelection, 'keyIndex'> & {
  key: TimelineKeyData;
};

export type TimelineKeyData =
  | Suwol2DTranslateKey
  | Suwol2DRotateKey
  | Suwol2DScaleKey
  | Suwol2DDeformKey
  | Suwol2DAttachmentKey
  | Suwol2DDrawOrderKey
  | Suwol2DSlotColorKey
  | Suwol2DEventKey;

export interface ResolvedTimelineKey {
  selection: TimelineKeySelection;
  animation: Suwol2DAnimation;
  key: TimelineKeyData;
  list: TimelineKeyData[];
}

export function collectTimelineKeyRows(animation: Suwol2DAnimation | undefined): TimelineKeyRow[] {
  if (!animation) {
    return [];
  }

  const rows: TimelineKeyRow[] = [];
  for (const timeline of animation.bones ?? []) {
    timeline.translate?.forEach((key, index) => rows.push(createRow(animation.name, 'boneTranslate', timeline.bone, index, key.time, 'Bone Translate', timeline.bone, withInterpolation(`${formatNumber(key.x)}, ${formatNumber(key.y)}`, key.interpolation), 'bone')));
    timeline.rotate?.forEach((key, index) => rows.push(createRow(animation.name, 'boneRotate', timeline.bone, index, key.time, 'Bone Rotate', timeline.bone, withInterpolation(`${formatNumber(key.rotation)} deg`, key.interpolation), 'bone')));
    timeline.scale?.forEach((key, index) => rows.push(createRow(animation.name, 'boneScale', timeline.bone, index, key.time, 'Bone Scale', timeline.bone, withInterpolation(`${formatNumber(key.scaleX)}, ${formatNumber(key.scaleY)}`, key.interpolation), 'bone')));
  }

  for (const timeline of animation.deforms ?? []) {
    timeline.keys?.forEach((key, index) => rows.push(createRow(animation.name, 'deform', `${timeline.slot}/${timeline.attachment}`, index, key.time, 'Deform', `${timeline.slot} / ${timeline.attachment}`, withInterpolation(`${key.offsets?.length ?? 0} offsets`, key.interpolation), 'deform')));
  }

  for (const timeline of animation.attachments ?? []) {
    timeline.keys?.forEach((key, index) => rows.push(createRow(animation.name, 'attachment', timeline.slot, index, key.time, 'Attachment', timeline.slot, key.attachment ?? 'Hide', 'attachment')));
  }

  (animation.drawOrders ?? []).forEach((key, index) => rows.push(createRow(animation.name, 'drawOrder', 'drawOrder', index, key.time, 'Draw Order', 'drawOrder', `${key.slots?.length ?? 0} slots`, 'drawOrder')));

  for (const timeline of animation.slots ?? []) {
    timeline.color?.forEach((key, index) => rows.push(createRow(animation.name, 'slotColor', timeline.slot, index, key.time, 'Slot Color', timeline.slot, withInterpolation(`rgba(${formatNumber(key.r)}, ${formatNumber(key.g)}, ${formatNumber(key.b)}, ${formatNumber(key.a)})`, key.interpolation), 'slotColor')));
  }

  (animation.events ?? []).forEach((key, index) => rows.push(createRow(animation.name, 'event', 'events', index, key.time, 'Event', key.name || '(unnamed)', [key.intValue, key.floatValue, key.stringValue].filter((value) => value !== undefined && value !== '').join(' / ') || 'event', 'event')));

  return rows.sort((a, b) => a.time - b.time || a.typeLabel.localeCompare(b.typeLabel) || a.targetLabel.localeCompare(b.targetLabel));
}

export function filterTimelineKeyRows(rows: TimelineKeyRow[], filter: TimelineKeyFilter, search: string): TimelineKeyRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter !== 'all' && row.filter !== filter) {
      return false;
    }
    return !needle || row.searchText.includes(needle);
  });
}

export function resolveTimelineKey(document: Suwol2DDocument, selection: TimelineKeySelection | null): ResolvedTimelineKey | null {
  if (!selection) {
    return null;
  }

  const animation = document.animations.find((candidate) => candidate.name === selection.animation);
  if (!animation) {
    return null;
  }

  const list = getTimelineKeyList(animation, selection);
  if (!list || selection.keyIndex < 0 || selection.keyIndex >= list.length) {
    return null;
  }

  return {
    selection,
    animation,
    key: list[selection.keyIndex],
    list
  };
}

export function normalizeTimelineKeySelection(document: Suwol2DDocument, selection: TimelineKeySelection | null): TimelineKeySelection | null {
  return resolveTimelineKey(document, selection) ? selection : null;
}

export function timelineSelectionEquals(a: TimelineKeySelection | null, b: TimelineKeySelection | null): boolean {
  return Boolean(a && b && a.type === b.type && a.animation === b.animation && a.target === b.target && a.keyIndex === b.keyIndex);
}

export function copyTimelineKey(document: Suwol2DDocument, selection: TimelineKeySelection | null): TimelineClipboard | null {
  const resolved = resolveTimelineKey(document, selection);
  if (!resolved) {
    return null;
  }

  return {
    type: resolved.selection.type,
    animation: resolved.selection.animation,
    target: resolved.selection.target,
    key: cloneTimelineKey(resolved.key)
  };
}

export function pasteTimelineKey(
  document: Suwol2DDocument,
  animationName: string,
  clipboard: TimelineClipboard | null,
  time: number
): TimelineKeySelection | null {
  if (!clipboard) {
    return null;
  }

  const animation = document.animations.find((candidate) => candidate.name === animationName);
  if (!animation) {
    return null;
  }

  const selection: TimelineKeySelection = {
    type: clipboard.type,
    animation: animation.name,
    target: clipboard.target,
    keyIndex: 0
  };
  const list = getOrCreateTimelineKeyList(animation, selection);
  if (!list) {
    return null;
  }

  const key = cloneTimelineKey(clipboard.key);
  key.time = time;
  const index = replaceOrPushKey(list, key);
  selection.keyIndex = index;
  cleanupEmptyTimelines(animation);
  return selection;
}

export function duplicateTimelineKey(document: Suwol2DDocument, selection: TimelineKeySelection | null, time: number): TimelineKeySelection | null {
  const copied = copyTimelineKey(document, selection);
  if (!copied || !selection) {
    return null;
  }

  return pasteTimelineKey(document, selection.animation, copied, time);
}

export function deleteTimelineKey(document: Suwol2DDocument, selection: TimelineKeySelection | null): boolean {
  const resolved = resolveTimelineKey(document, selection);
  if (!resolved) {
    return false;
  }

  resolved.list.splice(resolved.selection.keyIndex, 1);
  cleanupEmptyTimelines(resolved.animation);
  return true;
}

export function updateTimelineKeyTime(document: Suwol2DDocument, selection: TimelineKeySelection, time: number): TimelineKeySelection | null {
  const resolved = resolveTimelineKey(document, selection);
  if (!resolved) {
    return null;
  }

  resolved.key.time = time;
  resolved.list.sort(sortByTime);
  const nextIndex = resolved.list.findIndex((candidate) => candidate === resolved.key);
  return {
    ...selection,
    keyIndex: Math.max(0, nextIndex)
  };
}

export function getTimelineModeForKey(type: TimelineKeyType): TimelineKeyFilter {
  if (type === 'boneTranslate' || type === 'boneRotate' || type === 'boneScale') {
    return 'bone';
  }
  return type;
}

function createRow(
  animation: string,
  type: TimelineKeyType,
  target: string,
  keyIndex: number,
  time: number,
  typeLabel: string,
  targetLabel: string,
  valueLabel: string,
  filter: TimelineKeyFilter
): TimelineKeyRow {
  const id = `${animation}:${type}:${target}:${keyIndex}`;
  const searchText = `${animation} ${typeLabel} ${targetLabel} ${valueLabel}`.toLowerCase();
  return {
    id,
    selection: { type, animation, target, keyIndex },
    time,
    typeLabel,
    targetLabel,
    valueLabel,
    filter,
    searchText
  };
}

function getTimelineKeyList(animation: Suwol2DAnimation, selection: TimelineKeySelection): TimelineKeyData[] | null {
  if (selection.type === 'boneTranslate' || selection.type === 'boneRotate' || selection.type === 'boneScale') {
    const timeline = animation.bones.find((candidate) => candidate.bone === selection.target);
    if (!timeline) return null;
    if (selection.type === 'boneTranslate') return timeline.translate;
    if (selection.type === 'boneRotate') return timeline.rotate;
    return timeline.scale;
  }

  if (selection.type === 'deform') {
    const [slot, attachment] = splitTarget(selection.target);
    return animation.deforms?.find((timeline) => timeline.slot === slot && timeline.attachment === attachment)?.keys ?? null;
  }

  if (selection.type === 'attachment') {
    return animation.attachments?.find((timeline) => timeline.slot === selection.target)?.keys ?? null;
  }

  if (selection.type === 'drawOrder') {
    return animation.drawOrders ?? null;
  }

  if (selection.type === 'slotColor') {
    return animation.slots?.find((timeline) => timeline.slot === selection.target)?.color ?? null;
  }

  return animation.events ?? null;
}

function getOrCreateTimelineKeyList(animation: Suwol2DAnimation, selection: TimelineKeySelection): TimelineKeyData[] | null {
  if (selection.type === 'boneTranslate' || selection.type === 'boneRotate' || selection.type === 'boneScale') {
    let timeline = animation.bones.find((candidate) => candidate.bone === selection.target);
    if (!timeline) {
      timeline = { bone: selection.target, translate: [], rotate: [], scale: [] };
      animation.bones.push(timeline);
    }
    if (selection.type === 'boneTranslate') return timeline.translate;
    if (selection.type === 'boneRotate') return timeline.rotate;
    return timeline.scale;
  }

  if (selection.type === 'deform') {
    const [slot, attachment] = splitTarget(selection.target);
    animation.deforms ??= [];
    let timeline = animation.deforms.find((candidate) => candidate.slot === slot && candidate.attachment === attachment);
    if (!timeline) {
      timeline = { slot, attachment, keys: [] };
      animation.deforms.push(timeline);
    }
    return timeline.keys;
  }

  if (selection.type === 'attachment') {
    animation.attachments ??= [];
    let timeline = animation.attachments.find((candidate) => candidate.slot === selection.target);
    if (!timeline) {
      timeline = { slot: selection.target, keys: [] };
      animation.attachments.push(timeline);
    }
    return timeline.keys;
  }

  if (selection.type === 'drawOrder') {
    animation.drawOrders ??= [];
    return animation.drawOrders;
  }

  if (selection.type === 'slotColor') {
    animation.slots ??= [];
    let timeline = animation.slots.find((candidate) => candidate.slot === selection.target);
    if (!timeline) {
      timeline = { slot: selection.target, color: [] };
      animation.slots.push(timeline);
    }
    timeline.color ??= [];
    return timeline.color;
  }

  animation.events ??= [];
  return animation.events;
}

function replaceOrPushKey(list: TimelineKeyData[], key: TimelineKeyData): number {
  const existingIndex = list.findIndex((candidate) => Math.abs(candidate.time - key.time) < 0.0001);
  if (existingIndex >= 0) {
    list[existingIndex] = key;
    list.sort(sortByTime);
    return list.findIndex((candidate) => candidate === key);
  }

  list.push(key);
  list.sort(sortByTime);
  return list.findIndex((candidate) => candidate === key);
}

function cleanupEmptyTimelines(animation: Suwol2DAnimation): void {
  animation.bones = animation.bones.filter((timeline) => timeline.translate.length > 0 || timeline.rotate.length > 0 || timeline.scale.length > 0);
  animation.deforms = animation.deforms?.filter((timeline) => timeline.keys.length > 0);
  if (animation.deforms?.length === 0) animation.deforms = undefined;
  animation.attachments = animation.attachments?.filter((timeline) => timeline.keys.length > 0);
  if (animation.attachments?.length === 0) animation.attachments = undefined;
  if (animation.drawOrders?.length === 0) animation.drawOrders = undefined;
  animation.slots = animation.slots?.filter((timeline) => (timeline.color ?? []).length > 0);
  if (animation.slots?.length === 0) animation.slots = undefined;
  if (animation.events?.length === 0) animation.events = undefined;
}

function cloneTimelineKey<T extends TimelineKeyData>(key: T): T {
  return JSON.parse(JSON.stringify(key)) as T;
}

function splitTarget(target: string): [string, string] {
  const separator = target.indexOf('/');
  if (separator < 0) {
    return [target, ''];
  }
  return [target.slice(0, separator), target.slice(separator + 1)];
}

function sortByTime<T extends { time: number }>(a: T, b: T): number {
  return a.time - b.time;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0';
}

function withInterpolation(valueLabel: string, interpolation: unknown): string {
  return `${valueLabel} | ${normalizeInterpolation(interpolation)}`;
}
