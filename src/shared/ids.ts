export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueName(baseName: string, existingNames: Iterable<string>): string {
  const existing = new Set(existingNames);
  if (!existing.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (existing.has(`${baseName}_${index}`)) {
    index += 1;
  }

  return `${baseName}_${index}`;
}

export function normalizeImageName(value: string): string {
  const normalized = value.replace(/\\/g, '/').split('/').pop() ?? value;
  return normalized.replace(/\.[^.]+$/, '');
}
