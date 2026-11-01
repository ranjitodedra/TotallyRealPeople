// Audio conversion between Twilio Media Streams and Gemini Live.
// Twilio: 8 kHz mono G.711 μ-law, base64. Gemini: 16 kHz PCM16 LE in, 24 kHz PCM16 LE out, base64.

const BIAS = 0x84;
const CLIP = 32635;

const DECODE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  const exponent = (u >> 4) & 7;
  const sample = (((u & 0x0f) << 3) + BIAS) << exponent;
  DECODE[i] = u & 0x80 ? BIAS - sample : sample - BIAS;
}

export function mulawDecode(u: number) {
  return DECODE[u & 0xff];
}

export function mulawEncode(sample: number) {
  let s = Math.max(-32768, Math.min(32767, Math.round(sample)));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  s = Math.min(s, CLIP) + BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Twilio payload (8 kHz μ-law) → Gemini input (16 kHz PCM16), both base64. Linear interpolation. */
export function twilioToGemini(b64: string): string {
  const mu = Buffer.from(b64, "base64");
  const out = Buffer.alloc(mu.length * 4);
  for (let i = 0; i < mu.length; i++) {
    const a = DECODE[mu[i]];
    const b = i + 1 < mu.length ? DECODE[mu[i + 1]] : a;
    out.writeInt16LE(a, i * 4);
    out.writeInt16LE((a + b) >> 1, i * 4 + 2);
  }
  return out.toString("base64");
}

/**
 * Gemini output (24 kHz PCM16) → Twilio payload (8 kHz μ-law). Averages each 3 samples (cheap low-pass).
 * Keeps leftover samples between chunks so nothing clicks; call reset() on barge-in.
 */
export class Downlink {
  private carry: number[] = [];
  /** Input samples per 8 kHz output sample: 3 for 24 kHz (Gemini), 2 for 16 kHz (ElevenLabs can be either). */
  constructor(private ratio = 3) {}

  convert(b64: string): string {
    const pcm = Buffer.from(b64, "base64");
    const samples = this.carry;
    const k = this.ratio;
    for (let i = 0; i + 1 < pcm.length; i += 2) samples.push(pcm.readInt16LE(i));
    const n = Math.floor(samples.length / k);
    const out = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < k; j++) sum += samples[k * i + j];
      out[i] = mulawEncode(sum / k);
    }
    this.carry = samples.slice(n * k);
    return out.toString("base64");
  }

  reset() {
    this.carry = [];
  }
}
