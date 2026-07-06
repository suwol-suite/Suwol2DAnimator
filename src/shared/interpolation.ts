import type { Suwol2DInterpolation } from './suwol2d-format';

export const suwol2DInterpolationValues = ['stepped', 'linear', 'easeIn', 'easeOut', 'easeInOut'] as const;

export function isSuwol2DInterpolation(value: unknown): value is Suwol2DInterpolation {
  return (
    value === 'stepped' ||
    value === 'linear' ||
    value === 'easeIn' ||
    value === 'easeOut' ||
    value === 'easeInOut'
  );
}

export function normalizeInterpolation(value: unknown): Suwol2DInterpolation {
  return isSuwol2DInterpolation(value) ? value : 'linear';
}

export function applyInterpolation(type: Suwol2DInterpolation, t: number): number {
  const x = clamp01(t);

  switch (type) {
    case 'stepped':
      return 0;
    case 'easeIn':
      return x * x;
    case 'easeOut':
      return 1 - (1 - x) * (1 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'linear':
    default:
      return x;
  }
}

export function interpolateFactor(type: unknown, t: number): number {
  return applyInterpolation(normalizeInterpolation(type), t);
}

export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngleShortest(a: number, b: number, t: number): number {
  const delta = normalizeDegrees(b - a);
  return normalizeDegrees(a + delta * t);
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
