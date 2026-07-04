import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const packageRoot = join(repoRoot, 'unity', 'com.suwol.suwol2d');
const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const releaseDir = join(repoRoot, 'release');
const stagingRoot = join(releaseDir, '_unity-package-staging');
const stagingPackage = join(stagingRoot, packageJson.name);
const outputZip = join(releaseDir, `${packageJson.name}-${packageJson.version}.zip`);

await assertInsideWorkspace(stagingRoot);
await rm(stagingRoot, { recursive: true, force: true });
await mkdir(stagingPackage, { recursive: true });

const entries = [
  'package.json',
  'package.json.meta',
  'README.md',
  'README.md.meta',
  'Runtime',
  'Runtime.meta',
  'Editor',
  'Editor.meta',
  'Samples~',
  'Documentation~'
];

for (const entry of entries) {
  const source = join(packageRoot, entry);
  if (!existsSync(source)) {
    continue;
  }
  await cp(source, join(stagingPackage, entry), { recursive: true });
}

await rm(outputZip, { force: true });
await compressArchive(stagingPackage, outputZip);
await rm(stagingRoot, { recursive: true, force: true });
console.log(`Wrote ${outputZip}`);

async function assertInsideWorkspace(targetPath) {
  const resolvedRoot = resolve(repoRoot);
  const resolvedTarget = resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`Refusing to write outside workspace: ${resolvedTarget}`);
  }
}

function compressArchive(sourceDirectory, destinationZip) {
  const command = [
    '$ErrorActionPreference = "Stop"',
    `$source = ${toPowerShellString(join(sourceDirectory, '*'))}`,
    `$destination = ${toPowerShellString(destinationZip)}`,
    'Compress-Archive -Path $source -DestinationPath $destination -Force'
  ].join('; ');

  return new Promise((resolvePromise, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`Compress-Archive failed with exit code ${code}`));
      }
    });
  });
}

function toPowerShellString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
