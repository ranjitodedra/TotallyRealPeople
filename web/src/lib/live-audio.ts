// Browser-side audio helpers for Gemini Live.
// Uplink: 16 kHz mono PCM16 little-endian, base64. Downlink: 24 kHz mono PCM16, base64.

export const UPLINK_RATE = 16000;
export const DOWNLINK_RATE = 24000;

export function downsample(input: Float32Array, inRate: number, outRate = UPLINK_RATE): Float32Array {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // Average the source samples that fall in this output slot (cheap low-pass).
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function floatToPcm16Base64(f: Float32Array): string {
  const buf = new ArrayBuffer(f.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytesToBase64(new Uint8Array(buf));
}

export function pcm16Base64ToFloat(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

export function rms(f: Float32Array) {
  let s = 0;
  for (let i = 0; i < f.length; i++) s += f[i] * f[i];
  return Math.sqrt(s / Math.max(1, f.length));
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Gapless playback queue with instant flush on barge-in. */
export class Player {
  private nextAt = 0;
  private sources = new Set<AudioBufferSourceNode>();
  constructor(private ctx: AudioContext) {}

  /** `rate` is the samples' rate: 24 kHz for Gemini and Grok, 16 or 24 kHz for ElevenLabs. */
  play(samples: Float32Array, rate = DOWNLINK_RATE) {
    const buf = this.ctx.createBuffer(1, samples.length, rate);
    buf.getChannelData(0).set(samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.03, this.nextAt);
    src.start(at);
    this.nextAt = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  get playing() {
    return this.sources.size > 0;
  }

  flush() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextAt = 0;
  }
}
