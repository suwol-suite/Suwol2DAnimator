import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const releaseDir = join(repoRoot, 'release');
const outputPath = join(releaseDir, 'checksums.txt');
const includedExtensions = new Set(['.exe', '.zip', '.7z', '.blockmap', '.yml', '.yaml']);

let files;
try {
  files = await walk(releaseDir);
} catch {
  console.error('release directory was not found. Run a packaging command before release:checksums.');
  process.exit(1);
}

const releaseFiles = files
  .filter((file) => !file.endsWith('checksums.txt'))
  .filter((file) => !file.endsWith('builder-debug.yml'))
  .filter((file) => includedExtensions.has(file.slice(file.lastIndexOf('.')).toLowerCase()))
  .sort((a, b) => a.localeCompare(b));

if (releaseFiles.length === 0) {
  console.error('No release artifacts were found for checksums.');
  process.exit(1);
}

await mkdir(releaseDir, { recursive: true });
const lines = [];
for (const file of releaseFiles) {
  const hash = await sha256(file);
  lines.push(`${hash}  ${relative(releaseDir, file).replace(/\\/g, '/')}`);
}

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${relative(repoRoot, outputPath).replace(/\\/g, '/')} with ${lines.length} checksums.`);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walk(fullPath));
    } else if (entry.isFile()) {
      output.push(fullPath);
    }
  }
  return output;
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
