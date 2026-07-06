import { readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import type { PackedAtlas } from './atlas-packer';

export async function writeAtlasPng(atlas: PackedAtlas, outputPath: string): Promise<void> {
  const target = new PNG({
    width: atlas.atlas.width,
    height: atlas.atlas.height,
    colorType: 6
  });

  for (const placement of atlas.placements) {
    const source = PNG.sync.read(await readFile(placement.source.sourcePath));
    if (source.width !== placement.region.width || source.height !== placement.region.height) {
      throw new Error(`Atlas source size changed while packing: ${placement.source.name}`);
    }

    blitBottomLeft(source, target, placement.region.x, placement.region.y);
  }

  await writeFile(outputPath, PNG.sync.write(target));
}

function blitBottomLeft(source: PNG, target: PNG, destinationX: number, destinationY: number): void {
  const targetTopY = target.height - destinationY - source.height;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (source.width * y + x) << 2;
      const targetIndex = (target.width * (targetTopY + y) + destinationX + x) << 2;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
}
