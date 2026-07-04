import type { Suwol2DAnimation } from '../../../../shared/suwol2d-format';

export const defaultTimelineSnapStep = 0.05;

export function getExplicitAnimationDuration(animation: Suwol2DAnimation | undefined): number | null {
  if (!animation || animation.duration === undefined) {
    return null;
  }

  return Number.isFinite(animation.duration) && animation.duration > 0 ? animation.duration : null;
}

export function getAnimationKeyDuration(animation: Suwol2DAnimation | undefined): number {
  if (!animation) {
    return 0;
  }

  let duration = 0;
  for (const timeline of animation.bones ?? []) {
    for (const key of timeline.translate ?? []) duration = Math.max(duration, key.time);
    for (const key of timeline.rotate ?? []) duration = Math.max(duration, key.time);
    for (const key of timeline.scale ?? []) duration = Math.max(duration, key.time);
  }
  for (const timeline of animation.deforms ?? []) {
    for (const key of timeline.keys ?? []) duration = Math.max(duration, key.time);
  }
  for (const timeline of animation.attachments ?? []) {
    for (const key of timeline.keys ?? []) duration = Math.max(duration, key.time);
  }
  for (const key of animation.drawOrders ?? []) {
    duration = Math.max(duration, key.time);
  }
  for (const timeline of animation.slots ?? []) {
    for (const key of timeline.color ?? []) duration = Math.max(duration, key.time);
  }
  for (const key of animation.events ?? []) {
    duration = Math.max(duration, key.time);
  }

  return duration;
}

export function getEffectiveAnimationDuration(animation: Suwol2DAnimation | undefined): number {
  return getExplicitAnimationDuration(animation) ?? getAnimationKeyDuration(animation);
}

export function sanitizePlaybackSpeed(speed: number): number {
  return Number.isFinite(speed) && speed >= 0 ? speed : 1;
}

export function sanitizeSnapStep(step: number): number {
  return Number.isFinite(step) && step > 0 ? step : defaultTimelineSnapStep;
}

export function snapTime(time: number, step: number): number {
  const safeStep = sanitizeSnapStep(step);
  const safeTime = Number.isFinite(time) ? time : 0;
  return roundTime(Math.round(safeTime / safeStep) * safeStep);
}

export function clampCurrentTime(time: number, duration: number): number {
  const safeTime = Number.isFinite(time) ? time : 0;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return roundTime(Math.max(0, safeDuration > 0 ? Math.min(safeTime, safeDuration) : safeTime));
}

export function clampKeyTime(time: number): number {
  return roundTime(Math.max(0, Number.isFinite(time) ? time : 0));
}

export function advancePlaybackTime(
  time: number,
  delta: number,
  duration: number,
  loop: boolean,
  speed: number
): { time: number; playing: boolean } {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const nextTime = Math.max(0, (Number.isFinite(time) ? time : 0) + Math.max(0, delta) * sanitizePlaybackSpeed(speed));

  if (safeDuration <= 0) {
    return { time: roundTime(nextTime), playing: true };
  }

  if (loop) {
    return { time: roundTime(positiveModulo(nextTime, safeDuration)), playing: true };
  }

  return {
    time: roundTime(Math.min(nextTime, safeDuration)),
    playing: nextTime < safeDuration
  };
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function roundTime(value: number): number {
  return Number(value.toFixed(4));
}
