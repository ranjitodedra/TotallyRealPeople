import { env, hasElevenLabs } from "./env";

// ElevenLabs Agents (voice only). The agent itself is set up in the ElevenLabs dashboard:
// custom LLM = Grok (xAI), voice, PCM 16000 Hz in / PCM 24000 Hz out, auth on, System prompt override on.
// Each call sends our prompt (buildReferenceInstruction) as that override, so referencev2.md stays the one source.
// The socket protocol is in elevenlabs-live.ts (browser) and phone/bridge.ts (phone).

/** A short-lived URL that opens one conversation with the private agent. The API key stays here. */
export async function elevenLabsSignedUrl(): Promise<string> {
  if (!hasElevenLabs()) throw new Error("no_elevenlabs_key");
  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
  url.searchParams.set("agent_id", env.elevenLabsAgentId);
  const res = await fetch(url, { headers: { "xi-api-key": env.elevenLabsApiKey } });
  if (!res.ok) throw new Error(`elevenlabs signed url ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { signed_url?: string };
  if (!body.signed_url) throw new Error("elevenlabs signed url missing");
  return body.signed_url;
}
