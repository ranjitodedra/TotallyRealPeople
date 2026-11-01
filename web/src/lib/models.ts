import { env, hasGemini, hasGrok } from "./env";
import type { ReferenceProfile } from "./types";

/**
 * Which AI answers each kind of conversation.
 *   text  = chat, email replies, SMS answers
 *   voice = the browser "Call Dana" call and the Twilio phone bridge
 * Defaults come from TEXT_PROVIDER / VOICE_PROVIDER (Gemini for text, Grok for voice), and each
 * reference can override them from the reference desk. Résumé extraction always uses Gemini.
 */
export const PROVIDERS = ["gemini", "grok"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type ModelKind = "text" | "voice";
export type ModelChoice = Partial<Record<ModelKind, Provider>>;

export const PROVIDER_LABEL: Record<Provider, string> = { gemini: "Gemini", grok: "Grok" };
const KEY_NAME: Record<Provider, string> = { gemini: "GEMINI_API_KEY", grok: "GROK_API_KEY" };

const asProvider = (s: string, fallback: Provider): Provider => (PROVIDERS.includes(s as Provider) ? (s as Provider) : fallback);

export const DEFAULT_MODELS: Record<ModelKind, Provider> = {
  text: asProvider(env.textProvider, "gemini"),
  voice: asProvider(env.voiceProvider, "grok"),
};

export const hasProvider = (p: Provider) => (p === "gemini" ? hasGemini() : hasGrok());

/** What a reference actually uses for one kind, after falling back when a key is missing. */
export interface ResolvedModel {
  /** What the reference (or the default) asks for. */
  wanted: Provider;
  /** What runs. Null means no key for either provider: fake mode for text, no voice. */
  using: Provider | null;
  /** Why `using` differs from `wanted`. Shown on the reference desk. */
  note?: string;
}

export function resolveModel(p: Pick<ReferenceProfile, "models"> | null, kind: ModelKind): ResolvedModel {
  const wanted = p?.models?.[kind] ?? DEFAULT_MODELS[kind];
  if (hasProvider(wanted)) return { wanted, using: wanted };
  const other: Provider = wanted === "gemini" ? "grok" : "gemini";
  if (hasProvider(other)) {
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
    available: { gemini: hasGemini(), grok: hasGrok() } as Record<Provider, boolean>,
  };
}
export type ModelStatus = ReturnType<typeof modelStatus>;
