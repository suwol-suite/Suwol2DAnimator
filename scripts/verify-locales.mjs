import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const localesRoot = join(repoRoot, 'src', 'shared', 'i18n', 'locales');
const manifestPath = join(repoRoot, 'src', 'shared', 'i18n', 'locale-manifest.ts');

const manifestSource = await readFile(manifestPath, 'utf8');
const localeCodes = [...manifestSource.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1]);
const fallbackLocale = manifestSource.match(/fallbackLocale[^=]*=\s*'([^']+)'/)?.[1];

assert.ok(localeCodes.length > 0, 'locale manifest should define at least one locale.');
assert.ok(fallbackLocale, 'locale manifest should define fallbackLocale.');
assert.ok(localeCodes.includes(fallbackLocale), `fallback locale should be listed in supportedLocales: ${fallbackLocale}`);

const dictionaries = new Map();
for (const locale of localeCodes) {
  const filePath = join(localesRoot, `${locale}.json`);
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(typeof parsed, 'object', `${locale}.json should contain an object.`);
  assert.ok(parsed !== null && !Array.isArray(parsed), `${locale}.json should contain a dictionary object.`);
  dictionaries.set(locale, parsed);
}

const fallbackDictionary = dictionaries.get(fallbackLocale);
const fallbackEntries = flattenDictionary(fallbackDictionary);
assert.ok(fallbackEntries.length > 0, `${fallbackLocale}.json should contain translations.`);

for (const [locale, dictionary] of dictionaries) {
  const entries = flattenDictionary(dictionary);
  const keys = entries.map((entry) => entry.key).sort();
  const fallbackKeys = fallbackEntries.map((entry) => entry.key).sort();
  assert.deepEqual(keys, fallbackKeys, `${locale}.json should match fallback locale key set.`);
  assert.deepEqual(structureOf(dictionary), structureOf(fallbackDictionary), `${locale}.json should match fallback locale nested structure.`);

  for (const entry of entries) {
    assert.equal(typeof entry.value, 'string', `${locale}.${entry.key} should be a string.`);
    assert.ok(entry.value.trim().length > 0, `${locale}.${entry.key} should not be empty.`);
  }
}

console.log('Suwol2D locale verification passed.');
console.log(`- locales: ${localeCodes.join(', ')}`);
console.log(`- fallback: ${fallbackLocale}`);
console.log(`- keys: ${fallbackEntries.length}`);

function flattenDictionary(value, prefix = '') {
  const output = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      output.push({ key: path, value: child });
      continue;
    }

    assert.ok(child && typeof child === 'object' && !Array.isArray(child), `${path} should be a string or nested dictionary.`);
    output.push(...flattenDictionary(child, path));
  }
  return output;
}

function structureOf(value) {
  if (typeof value === 'string') {
    return 'string';
  }

  const structure = {};
  for (const [key, child] of Object.entries(value)) {
    structure[key] = structureOf(child);
  }
  return structure;
}
