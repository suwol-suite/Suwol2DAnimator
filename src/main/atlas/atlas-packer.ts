import type { Suwol2DAtlas, Suwol2DAtlasRegion } from '../../shared/suwol2d-format';

export interface AtlasSourceImage {
  name: string;
  sourcePath: string;
  width: number;
  height: number;
}

export interface PackAtlasOptions {
  name: string;
  image: string;
  maxSize: number;
  padding: number;
}

export interface PackedAtlas {
  atlas: Suwol2DAtlas;
  placements: PackedAtlasPlacement[];
}

export interface PackedAtlasPlacement {
  source: AtlasSourceImage;
  region: Suwol2DAtlasRegion;
}

interface Shelf {
  y: number;
  height: number;
  x: number;
}

const maxSupportedAtlasSize = 4096;

export function packAtlasImages(images: AtlasSourceImage[], options: PackAtlasOptions): PackedAtlas {
  const padding = sanitizeInteger(options.padding, 2, 0, 128);
  const requestedMaxSize = sanitizeInteger(options.maxSize, 2048, 64, maxSupportedAtlasSize);
  const requiredMinSize = Math.max(
    64,
    ...images.flatMap((image) => [image.width + padding * 2, image.height + padding * 2])
  );
  const firstSize = nextPowerOfTwo(requiredMinSize);
  const candidateSizes = buildCandidateSizes(firstSize, requestedMaxSize);

  for (const size of candidateSizes) {
    const placements = tryPack(images, size, padding);
    if (placements) {
      return {
        atlas: {
          name: options.name,
          image: options.image,
          width: size,
          height: size,
          regions: placements.map((placement) => placement.region)
        },
        placements
      };
    }
  }

  throw new Error(`Atlas packing failed: ${images.length} image(s) do not fit within ${maxSupportedAtlasSize}x${maxSupportedAtlasSize}.`);
}

function tryPack(images: AtlasSourceImage[], size: number, padding: number): PackedAtlasPlacement[] | null {
  const shelves: Shelf[] = [];
  const placements: PackedAtlasPlacement[] = [];
  const sortedImages = [...images].sort((left, right) => (
    right.height - left.height ||
    right.width - left.width ||
    left.name.localeCompare(right.name)
  ));

  for (const image of sortedImages) {
    if (image.width <= 0 || image.height <= 0 || image.width + padding * 2 > size || image.height + padding * 2 > size) {
      return null;
    }

    let shelf = shelves.find((candidate) => (
      image.height + padding * 2 <= candidate.height &&
      candidate.x + image.width + padding <= size
    ));

    if (!shelf) {
      const y = shelves.length === 0 ? padding : shelves[shelves.length - 1].y + shelves[shelves.length - 1].height;
      const shelfHeight = image.height + padding * 2;
      if (y + shelfHeight > size) {
        return null;
      }

      shelf = { y, height: shelfHeight, x: padding };
      shelves.push(shelf);
    }

    const x = shelf.x;
    const y = shelf.y;
    shelf.x += image.width + padding;

    placements.push({
      source: image,
      region: {
        name: image.name,
        x,
        y,
        width: image.width,
        height: image.height,
        u: roundUv(x / size),
        v: roundUv(y / size),
        u2: roundUv((x + image.width) / size),
        v2: roundUv((y + image.height) / size)
      }
    });
  }

  placements.sort((left, right) => left.region.name.localeCompare(right.region.name));
  return placements;
}

function sanitizeInteger(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
}

function buildCandidateSizes(firstSize: number, requestedMaxSize: number): number[] {
  const sizes: number[] = [];
  for (let size = firstSize; size <= maxSupportedAtlasSize; size *= 2) {
    sizes.push(size);
    if (size >= requestedMaxSize && requestedMaxSize >= firstSize) {
      break;
    }
  }

  if (!sizes.includes(maxSupportedAtlasSize)) {
    sizes.push(maxSupportedAtlasSize);
  }

  return [...new Set(sizes)].sort((left, right) => left - right);
}

function roundUv(value: number): number {
  return Number(value.toFixed(6));
}
