import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

export interface PngImageSize {
  width: number;
  height: number;
}

export async function readPngImageSize(filePath: string): Promise<PngImageSize> {
  const file = await readFile(filePath);
  const png = PNG.sync.read(file);
  return {
    width: png.width,
    height: png.height
  };
}
