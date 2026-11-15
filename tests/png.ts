import { inflateSync } from "node:zlib";

/** Decoded 8-bit PNG: row-major RGBA, four bytes per pixel. */
export interface PngImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const COLOR_CHANNELS: Record<number, number> = { 2: 3, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Minimal PNG reader for asset tests: signature, IHDR, IDAT and the five
 * scanline filters, colour types 2 (RGB) and 6 (RGBA), 8 bits per channel.
 * Interlaced images and palette colour types are rejected instead of guessed.
 */
export function decodePng(source: Buffer): PngImage {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (source[i] !== SIGNATURE[i]) throw new Error("not a PNG file");
  }

  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];

  let offset = SIGNATURE.length;
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString("latin1", offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
      if (interlace !== 0) throw new Error("interlaced PNG is not supported");
      channels = COLOR_CHANNELS[colorType] ?? 0;
      if (!channels) throw new Error(`unsupported colour type ${colorType}`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height || !channels) throw new Error("PNG has no usable IHDR");
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  const previous = new Uint8Array(stride);
  const row = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const source0 = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const value = raw[source0 + x];
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      switch (filter) {
        case 0: row[x] = value; break;
        case 1: row[x] = (value + left) & 0xff; break;
        case 2: row[x] = (value + up) & 0xff; break;
        case 3: row[x] = (value + ((left + up) >> 1)) & 0xff; break;
        case 4: row[x] = (value + paeth(left, up, upLeft)) & 0xff; break;
        default: throw new Error(`unknown filter ${filter} on row ${y}`);
      }
    }

    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      const source1 = x * channels;
      rgba[target] = row[source1];
      rgba[target + 1] = row[source1 + 1];
      rgba[target + 2] = row[source1 + 2];
      rgba[target + 3] = channels === 4 ? row[source1 + 3] : 0xff;
    }

    previous.set(row);
  }

  return { width, height, rgba };
}
