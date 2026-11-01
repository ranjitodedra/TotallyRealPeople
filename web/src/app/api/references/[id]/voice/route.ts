import { GoogleGenAI, Modality } from "@google/genai";
import { env, hasGemini } from "@/lib/env";
import { buildReferenceInstruction } from "@/lib/instruction";
import { getReference } from "@/lib/store";

export interface VoiceGrant {
  token: string;
  model: string;
  apiVersion: string;
  expiresAt: string;
}

// Mints a single-use Gemini Live token with the model, voice and system instruction locked in.
// The browser never sees the API key or the prompt. Called on start and on renew.
export async function POST(_req: Request, ctx: RouteContext<"/api/references/[id]/voice">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  if (!hasGemini()) {
    return Response.json({ error: "Voice needs GEMINI_API_KEY in web/.env.local.", code: "no_key" }, { status: 503 });
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: env.liveApiVersion } });
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  try {
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
    const grant: VoiceGrant = { token: token.name, model: env.liveModel, apiVersion: env.liveApiVersion, expiresAt };
    return Response.json(grant);
  } catch (e) {
    console.error("live token failed", e);
    return Response.json({ error: "Voice is unavailable right now.", code: "unavailable" }, { status: 503 });
  }
}
