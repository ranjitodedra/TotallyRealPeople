import { GoogleGenAI, Modality } from "@google/genai";
import { env } from "@/lib/env";
import { grokVoiceToken } from "@/lib/grok";
import { buildReferenceInstruction } from "@/lib/instruction";
import { MANAGER } from "@/lib/manager";
import { resolveModel } from "@/lib/models";
import { getReference } from "@/lib/store";

export type VoiceGrant =
  | { provider: "gemini"; token: string; model: string; apiVersion: string; expiresAt: string; note?: string }
  | {
      provider: "grok";
      token: string;
      model: string;
      expiresAt: string;
      note?: string;
      /** Sent by the browser as session.update. xAI tokens can't lock the session, unlike Gemini's. */
      session: { instructions: string; voice: string };
    };

// Mints a short-lived voice token for Gemini Live or Grok realtime (whichever this reference uses).
// The browser never sees the API key. Called on start and on renew.
export async function POST(_req: Request, ctx: RouteContext<"/api/references/[id]/voice">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  const { using, note } = resolveModel(p, "voice");
  if (!using) return Response.json({ error: `${note} Add it to web/.env.local.`, code: "no_key" }, { status: 503 });

  try {
    const grant: VoiceGrant = using === "grok" ? await grokGrant(p) : await geminiGrant(p);
    return Response.json({ ...grant, note });
  } catch (e) {
    console.error(`${using} voice token failed`, e);
    return Response.json({ error: "Voice is unavailable right now.", code: "unavailable" }, { status: 503 });
  }
}

type Profile = NonNullable<Awaited<ReturnType<typeof getReference>>>;

async function grokGrant(p: Profile): Promise<VoiceGrant> {
  const token = await grokVoiceToken(5 * 60);
  return {
    provider: "grok",
    token: token.value,
    model: env.grokVoiceModel,
    expiresAt: token.expiresAt,
    session: { instructions: buildReferenceInstruction(p, "voice"), voice: env.grokVoice || MANAGER.grokVoice },
  };
}

// Single-use Gemini Live token with the model, voice and system instruction locked in, so the
// browser never sees the prompt either.
async function geminiGrant(p: Profile): Promise<VoiceGrant> {
  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: env.liveApiVersion } });
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: expiresAt,
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: env.liveModel,
        config: {
          systemInstruction: buildReferenceInstruction(p, "voice"),
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voice } } },
        },
      },
      lockAdditionalFields: [],
    },
  });
  if (!token.name) throw new Error("token has no name");
  return { provider: "gemini", token: token.name, model: env.liveModel, apiVersion: env.liveApiVersion, expiresAt };
}
