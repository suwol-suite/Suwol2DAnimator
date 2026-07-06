import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const workflow = await read(' .github/workflows/release-linux-zip.yml'.trim());
const packageJson = JSON.parse(await read('package.json'));
const en = JSON.parse(await read('src/shared/i18n/locales/en.json'));
const ko = JSON.parse(await read('src/shared/i18n/locales/ko.json'));
const docs = await read('docs/linux-zip-auto-update-v19.md');
const docsLower = docs.toLowerCase();
const service = await read('src/main/update/linux-update-service.ts');
const preload = await read('src/preload/index.ts');
const app = await read('src/renderer/src/App.tsx');

assert.ok(workflow.includes('Create Linux update manifest'), 'Linux ZIP workflow should create an update manifest.');
assert.ok(workflow.includes('suwol2d-linux-x64-update.json'), 'Linux ZIP workflow should reference the update manifest asset.');
assert.ok(workflow.includes('release/suwol2d-linux-x64-update.json'), 'Artifact upload should include the update manifest.');
assert.ok(workflow.includes("github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')"), 'Release upload should be limited to tag pushes.');
assert.ok(workflow.includes('checksums-linux-x64.txt'), 'Linux checksum artifact should remain included.');

assert.equal(packageJson.dependencies?.['extract-zip'] !== undefined, true, 'extract-zip should be a runtime dependency.');
assert.equal(packageJson.scripts?.['verify:linux-update'], 'node scripts/verify-linux-update.mjs', 'verify:linux-update script should be registered.');
assert.ok(packageJson.scripts?.['release:check']?.includes('verify:linux-update'), 'release:check should include verify:linux-update.');

for (const key of [
  'update.title',
  'update.currentVersion',
  'update.autoCheckOnStart',
  'update.checkNow',
  'update.checking',
  'update.noUpdate',
  'update.available',
  'update.download',
  'update.downloading',
  'update.downloaded',
  'update.installAndRestart',
  'update.openDownloadFolder',
  'update.unsupportedPlatform',
  'update.notPackaged',
  'update.checkFailed',
  'update.downloadFailed',
  'update.checksumFailed',
  'update.installFailed',
  'update.releasePage',
  'update.writableInstallRequired'
]) {
  assert.equal(typeof resolveKey(en, key), 'string', `en locale should include ${key}.`);
  assert.equal(typeof resolveKey(ko, key), 'string', `ko locale should include ${key}.`);
}

for (const marker of [
  'GitHub Releases',
  'suwol2d-linux-x64-update.json',
  'checksum',
  'download-only',
  'workflow_dispatch',
  'tag release',
  'No code signing secrets'
]) {
  assert.ok(docsLower.includes(marker.toLowerCase()), `v19 docs should mention ${marker}.`);
}

for (const marker of [
  'latestReleaseApiUrl',
  'app.isPackaged',
  "process.platform !== 'linux'",
  'checksumFailed',
  'extractZip',
  'install-restart',
  'download-only',
  'GitHub'
]) {
  assert.ok(service.includes(marker), `Linux update service should include ${marker}.`);
}

for (const marker of [
  'checkForUpdates',
  'downloadUpdate',
  'installUpdateAndRestart',
  'openDownloadedUpdateFolder',
  'getUpdateSettings',
  'saveUpdateSettings'
]) {
  assert.ok(preload.includes(marker), `preload should expose ${marker}.`);
  assert.ok(app.includes(marker) || marker === 'getUpdateSettings' || marker === 'saveUpdateSettings', `renderer should use ${marker}.`);
}

console.log('Linux ZIP update verification passed.');
console.log('- manifest workflow: suwol2d-linux-x64-update.json');
console.log('- runtime dependency: extract-zip');
console.log('- locale keys: ko, en');

async function read(relativePath) {
  return readFile(join(repoRoot, relativePath), 'utf8');
}

function resolveKey(dictionary, key) {
  let current = dictionary;
  for (const segment of key.split('.')) {
    current = current?.[segment];
  }
  return current;
}
