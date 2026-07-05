import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const brandDir = join(repoRoot, 'assets', 'brand');
const buildDir = join(repoRoot, 'build');
const sourceIconPath = join(brandDir, 'icon-source.png');
const pngSizes = [16, 32, 48, 64, 128, 256, 512];
const icoSizes = [16, 32, 48, 64, 128, 256];

await mkdir(brandDir, { recursive: true });
await mkdir(buildDir, { recursive: true });

if (!existsSync(sourceIconPath)) {
  throw new Error(`Missing source icon: ${sourceIconPath}`);
}

await rm(join(brandDir, 'icon.svg'), { force: true });
generatePngSizes();
const icoPngs = await Promise.all(icoSizes.map((size) => readFile(join(brandDir, `icon-${size}.png`))));
await writeFile(join(buildDir, 'icon.ico'), createIco(icoPngs));
console.log(`Generated ${pngSizes.length} PNG icons and build/icon.ico from assets/brand/icon-source.png.`);

function generatePngSizes() {
  const script = `
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile('${escapePowerShellString(sourceIconPath)}')
try {
  foreach ($size in @(${pngSizes.join(',')})) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $size, $size)
      } finally {
        $graphics.Dispose()
      }

      $brandPath = '${escapePowerShellString(brandDir)}\\icon-' + $size + '.png'
      $bitmap.Save($brandPath, [System.Drawing.Imaging.ImageFormat]::Png)
      if ($size -eq 512) {
        $bitmap.Save('${escapePowerShellString(join(buildDir, 'icon.png'))}', [System.Drawing.Imaging.ImageFormat]::Png)
      }
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $source.Dispose()
}
`;

  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`PowerShell icon resize failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function createIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const directory = Buffer.alloc(16 * pngs.length);
  let offset = header.length + directory.length;
  for (let index = 0; index < pngs.length; index += 1) {
    const png = pngs[index];
    const size = icoSizes[index];
    const base = index * 16;
    directory[base] = size >= 256 ? 0 : size;
    directory[base + 1] = size >= 256 ? 0 : size;
    directory[base + 2] = 0;
    directory[base + 3] = 0;
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += png.length;
  }

  return Buffer.concat([header, directory, ...pngs]);
}

function escapePowerShellString(value) {
  return value.replace(/'/g, "''");
}
