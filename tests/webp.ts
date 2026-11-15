/** WebP header info: canvas size, encoding and whether the file carries alpha. */
export interface WebpInfo {
  readonly width: number;
  readonly height: number;
  readonly encoding: "lossy" | "lossless" | "extended";
  readonly hasAlpha: boolean;
}

/**
 * Minimal WebP reader for asset tests: RIFF container and the `VP8 `, `VP8L`
 * and `VP8X` headers. Only the header is parsed, pixels are never decoded.
 */
export function readWebpInfo(source: Buffer): WebpInfo {
  if (source.length < 20) throw new Error("truncated WebP file");
  if (source.toString("latin1", 0, 4) !== "RIFF") throw new Error("not a RIFF file");
  if (source.toString("latin1", 8, 12) !== "WEBP") throw new Error("not a WebP file");

  const chunk = source.toString("latin1", 12, 16);
  const data = source.subarray(20);

  if (chunk === "VP8 ") {
    // Three bytes of frame tag, then the 0x9d012a start code and 14-bit dimensions.
    if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) {
      throw new Error("bad VP8 start code");
    }
    return {
      width: data.readUInt16LE(6) & 0x3fff,
      height: data.readUInt16LE(8) & 0x3fff,
      encoding: "lossy",
      hasAlpha: false,
    };
  }

  if (chunk === "VP8L") {
    if (data[0] !== 0x2f) throw new Error("bad VP8L signature");
    const bits = data.readUInt32LE(1);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      encoding: "lossless",
      hasAlpha: ((bits >>> 28) & 1) === 1,
    };
  }

  if (chunk === "VP8X") {
    // Canvas size is stored as 24-bit `size - 1`; alpha is bit 4 of the flags.
    return {
      width: data.readUIntLE(4, 3) + 1,
      height: data.readUIntLE(7, 3) + 1,
      encoding: "extended",
      hasAlpha: (data[0] & 0x10) !== 0,
    };
  }

  throw new Error(`unknown WebP chunk ${JSON.stringify(chunk)}`);
}
