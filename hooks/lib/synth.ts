// Original sounds, synthesized at run time so the plugin ships no audio files:
// "Neon Drive", the radio loop (Am - F - C - G synthwave), a police siren and a medkit chime.
// Output is a 16-bit mono WAV as base64, for $.audio.play({ base64, mime: 'audio/wav' }).

import { base64 } from './raster'

const RATE = 22050

/** Deterministic noise, so the loop sounds the same on every machine. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function table(harmonics: number, oddOnly: boolean): Float32Array {
  const size = 2048
  const t = new Float32Array(size)
  let peak = 0
  for (let i = 0; i < size; i++) {
    const x = (2 * Math.PI * i) / size
    let v = 0
    for (let k = 1; k <= harmonics; k += oddOnly ? 2 : 1) v += Math.sin(k * x) / k
    t[i] = v
    peak = Math.max(peak, Math.abs(v))
  }
  for (let i = 0; i < size; i++) t[i] = (t[i] ?? 0) / peak
  return t
}

const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12)

/** PCM floats → WAV bytes (16-bit mono), normalized to -1 dBFS with soft saturation. */
export function wavBytes(mix: Float32Array, rate = RATE): Uint8Array {
  let peak = 0
  const out = new Float32Array(mix.length)
  for (let i = 0; i < mix.length; i++) {
    const v = Math.tanh((mix[i] ?? 0) * 1.4)
    out[i] = v
    peak = Math.max(peak, Math.abs(v))
  }
  const scale = peak > 0 ? 10 ** (-1 / 20) / peak : 1
  const bytes = new Uint8Array(44 + out.length * 2)
  const dv = new DataView(bytes.buffer)
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i)
  }
  text(0, 'RIFF')
  dv.setUint32(4, 36 + out.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate * 2, true)
  dv.setUint16(32, 2, true)
  dv.setUint16(34, 16, true)
  text(36, 'data')
  dv.setUint32(40, out.length * 2, true)
  for (let i = 0; i < out.length; i++) {
    const v = Math.max(-1, Math.min(1, (out[i] ?? 0) * scale))
    dv.setInt16(44 + i * 2, Math.round(v * 32767), true)
  }
  return bytes
}

/** "Neon Drive": 8 bars at 100 BPM, about 19 seconds, loops seamlessly. */
export function neonDrive(): Uint8Array {
  const beat = 60 / 100
  const bars = 8
  const length = Math.floor(RATE * beat * 4 * bars)
  const mix = new Float32Array(length)
  const rnd = prng(1986)
  const SAW = table(10, false)
  const SQUARE = table(9, true)
  const size = SAW.length

  const note = (wt: Float32Array, hz: number, start: number, dur: number, gain: number, attack: number, release: number, detune: number, cutoff: number) => {
    const n0 = Math.floor(start * RATE)
    const total = Math.floor((dur + release) * RATE)
    let pa = rnd() * size
    let pb = rnd() * size
    const sa = (hz * size) / RATE
    const sb = (hz * (1 + detune) * size) / RATE
    const aN = Math.max(1, Math.floor(attack * RATE))
    const susEnd = Math.floor(dur * RATE)
    const relN = Math.max(1, Math.floor(release * RATE))
    let lp = 0
    for (let i = 0; i < total; i++) {
      const env = i < aN ? i / aN : i < susEnd ? 1 : Math.max(0, 1 - (i - susEnd) / relN)
      let v = wt[Math.floor(pa) % size] ?? 0
      if (detune) {
        v = 0.5 * (v + (wt[Math.floor(pb) % size] ?? 0))
        pb += sb
      }
      pa += sa
      lp += cutoff * (v - lp)
      const idx = (n0 + i) % length
      mix[idx] = (mix[idx] ?? 0) + lp * env * gain
    }
  }
  const kick = (start: number) => {
    const n0 = Math.floor(start * RATE)
    let ph = 0
    for (let i = 0; i < Math.floor(0.35 * RATE); i++) {
      const t = i / RATE
      ph += (2 * Math.PI * (45 + 90 * Math.exp(-t * 28))) / RATE
      const idx = (n0 + i) % length
      mix[idx] = (mix[idx] ?? 0) + Math.sin(ph) * Math.exp(-t * 7) * 0.9
    }
  }
  const snare = (start: number) => {
    const n0 = Math.floor(start * RATE)
    let lp = 0
    for (let i = 0; i < Math.floor(0.42 * RATE); i++) {
      const t = i / RATE
      lp += 0.55 * (rnd() * 2 - 1 - lp)
      const body = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30)
      const gate = t < 0.18 ? 1 : Math.max(0, 1 - (t - 0.18) / 0.06)
      const idx = (n0 + i) % length
      mix[idx] = (mix[idx] ?? 0) + (lp * Math.exp(-t * 9) * 0.9 + body * 0.5) * gate * 0.45
    }
  }
  const hat = (start: number, open: boolean) => {
    const n0 = Math.floor(start * RATE)
    let prev = 0
    const decay = open ? 18 : 60
    for (let i = 0; i < Math.floor((open ? 0.2 : 0.06) * RATE); i++) {
      const noise = rnd() * 2 - 1
      const hp = noise - prev
      prev = noise
      const idx = (n0 + i) % length
      mix[idx] = (mix[idx] ?? 0) + hp * Math.exp(-(i / RATE) * decay) * 0.12
    }
  }

  const chords: [number, number[]][] = [
    [57, [57, 60, 64]],
    [53, [53, 57, 60]],
    [48, [52, 55, 60]],
    [55, [55, 59, 62]],
  ]
  const bar = beat * 4
  for (let b = 0; b < bars; b++) {
    const [root, tones] = chords[b % 4] ?? [57, [57, 60, 64]]
    const t0 = b * bar
    for (const n of tones) note(SAW, midiHz(n + 12), t0, bar - 0.05, 0.06, 0.35, 0.4, 0.006, 0.12)
    for (let k = 0; k < 8; k++) note(SAW, midiHz(root - 24 + (k % 2 ? 12 : 0)), t0 + (k * beat) / 2, beat / 2 - 0.02, 0.22, 0.005, 0.04, 0, 0.2)
    const pattern = b >= 4 ? [0, 2, 1, 2, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 0, 2] : [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1]
    pattern.forEach((p, k) => {
      const n = (tones[p] ?? 60) + 24
      const st = t0 + (k * beat) / 4
      note(SQUARE, midiHz(n), st, beat / 4 - 0.03, 0.07, 0.003, 0.06, 0, 0.35)
      note(SQUARE, midiHz(n), st + beat * 0.75, beat / 4 - 0.03, 0.03, 0.003, 0.06, 0, 0.25)
    })
    for (let k = 0; k < 4; k++) {
      kick(t0 + k * beat)
      if (k === 1 || k === 3) snare(t0 + k * beat)
    }
    for (let k = 0; k < 8; k++) hat(t0 + (k * beat) / 2, k === 7 && b % 2 === 1)
  }
  return wavBytes(mix)
}

/** A two-tone siren, 1.6 seconds. */
export function siren(): Uint8Array {
  const length = Math.floor(RATE * 1.6)
  const mix = new Float32Array(length)
  let ph = 0
  for (let i = 0; i < length; i++) {
    const t = i / RATE
    const hz = Math.floor(t / 0.4) % 2 ? 960 : 720
    ph += (2 * Math.PI * hz) / RATE
    const env = Math.min(1, t / 0.05, (1.6 - t) / 0.15)
    // A square-ish wave through a soft clip, like a speaker horn.
    mix[i] = Math.tanh(Math.sin(ph) * 3) * 0.35 * env
  }
  return wavBytes(mix)
}

/** A rising medkit chime, 0.6 seconds. */
export function medkit(): Uint8Array {
  const length = Math.floor(RATE * 0.6)
  const mix = new Float32Array(length)
  const notes = [76, 81, 88]
  notes.forEach((n, k) => {
    const start = Math.floor(k * 0.09 * RATE)
    let ph = 0
    for (let i = start; i < length; i++) {
      const t = (i - start) / RATE
      ph += (2 * Math.PI * midiHz(n)) / RATE
      mix[i] = (mix[i] ?? 0) + Math.sin(ph) * Math.exp(-t * 7) * 0.3
    }
  })
  return wavBytes(mix)
}

const cache = new Map<string, string>()

/** A sound as base64, synthesized once per module load. */
export function sound(name: 'radio' | 'siren' | 'medkit'): string {
  const hit = cache.get(name)
  if (hit) return hit
  const bytes = name === 'radio' ? neonDrive() : name === 'siren' ? siren() : medkit()
  const b64 = base64(bytes)
  cache.set(name, b64)
  return b64
}
