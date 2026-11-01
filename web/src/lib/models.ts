import { env, hasElevenLabs, hasGemini, hasGrok } from "./env";
import type { ReferenceProfile } from "./types";

/**
 * Which AI answers each kind of conversation.
 *   text  = chat, email replies, SMS answers
 *   voice = the browser "Call Dana" call and the Twilio phone bridge
 * Defaults come from TEXT_PROVIDER / VOICE_PROVIDER (Grok for text, ElevenLabs for voice), and each
 * reference can override them from the reference desk. Résumé extraction always uses Gemini.
 * ElevenLabs is voice only: it speaks what its agent's LLM (Grok) writes.
 */
export const TEXT_PROVIDERS = ["gemini", "grok"] as const;
export const VOICE_PROVIDERS = ["gemini", "grok", "elevenlabs"] as const;
export type Provider = (typeof VOICE_PROVIDERS)[number];
export type TextProvider = (typeof TEXT_PROVIDERS)[number];
export type ModelKind = "text" | "voice";
export type ModelChoice = { text?: TextProvider; voice?: Provider };

const OPTIONS: Record<ModelKind, readonly Provider[]> = { text: TEXT_PROVIDERS, voice: VOICE_PROVIDERS };
/** Who answers instead when the wanted provider has no key, in order. */
const FALLBACK: Provider[] = ["grok", "gemini", "elevenlabs"];

export const PROVIDER_LABEL: Record<Provider, string> = { gemini: "Gemini", grok: "Grok", elevenlabs: "ElevenLabs" };
const KEY_NAME: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  grok: "GROK_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID",
};

const asProvider = (s: string, kind: ModelKind, fallback: Provider): Provider =>
  OPTIONS[kind].includes(s as Provider) ? (s as Provider) : fallback;

export const DEFAULT_MODELS: Record<ModelKind, Provider> = {
  text: asProvider(env.textProvider, "text", "grok"),
  voice: asProvider(env.voiceProvider, "voice", "elevenlabs"),
};

export function hasProvider(p: Provider) {
  if (p === "gemini") return hasGemini();
  if (p === "grok") return hasGrok();
  return hasElevenLabs();
}

/** What a reference actually uses for one kind, after falling back when a key is missing. */
export interface ResolvedModel {
  /** What the reference (or the default) asks for. */
  wanted: Provider;
  /** What runs. Null means no key for any provider: fake mode for text, no voice. */
  using: Provider | null;
  /** Why `using` differs from `wanted`. Shown on the reference desk. */
  note?: string;
}

export function resolveModel(p: Pick<ReferenceProfile, "models"> | null, kind: ModelKind): ResolvedModel {
  const wanted = asProvider(p?.models?.[kind] ?? "", kind, DEFAULT_MODELS[kind]);
  if (hasProvider(wanted)) return { wanted, using: wanted };
  const other = FALLBACK.find((x) => x !== wanted && OPTIONS[kind].includes(x) && hasProvider(x));
  if (other) {
    return { wanted, using: other, note: `No ${KEY_NAME[wanted]} on the server, so ${PROVIDER_LABEL[other]} is answering.` };
  }
  return {
    wanted,
    using: null,
    note: kind === "text" ? "No AI keys on the server: fake mode." : `Voice needs ${KEY_NAME[wanted]} on the server.`,
  };
}

/** Sent to the browser with the reference so the picker can show the choice and any fallback. */
export function modelStatus(p: Pick<ReferenceProfile, "models">) {
  return {
    text: resolveModel(p, "text"),
    voice: resolveModel(p, "voice"),
    available: { gemini: hasGemini(), grok: hasGrok(), elevenlabs: hasElevenLabs() } as Record<Provider, boolean>,
  };
}
export type ModelStatus = ReturnType<typeof modelStatus>;
