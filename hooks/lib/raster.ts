// The sunset as terminal pixel art: a Raster of half-block cells, each cell two
// stacked pixels (▀ with the top pixel as foreground, the bottom as background).

import type { TimeOfDay } from './time'
import { scenePixels } from './tiles'

const HALF_BLOCK = 0x2580

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64 of bytes. */
export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]
    out += B64[(n >> 12) & 63]
    out += b === undefined ? '=' : B64[(n >> 6) & 63]
    out += c === undefined ? '=' : B64[n & 63]
  }
  return out
}

/** RasterProps cells for the scene: `columns` × `rows` half-block cells. */
export function sceneCells(tod: TimeOfDay, columns: number, rows: number): string {
  const px = scenePixels(tod, columns, rows * 2)
  const words = new Uint32Array(columns * rows * 3)
  let k = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      words[k++] = HALF_BLOCK
      words[k++] = px[row * 2]?.[col] ?? 0
      words[k++] = px[row * 2 + 1]?.[col] ?? 0
    }
  }
  const bytes = new Uint8Array(words.length * 4)
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? 0
    bytes[i * 4] = w & 255
    bytes[i * 4 + 1] = (w >>> 8) & 255
    bytes[i * 4 + 2] = (w >>> 16) & 255
    bytes[i * 4 + 3] = (w >>> 24) & 255
  }
  return base64(bytes)
}
