import { env, hasGrok } from "./env";

// xAI's REST API is OpenAI-compatible, so plain fetch is enough (no SDK).
const API = "https://api.x.ai/v1";

/** Same shape as generateText in gemini.ts, so answer.ts can pick either. */
export async function grokText(system: string, history: { role: "user" | "model"; text: string }[]) {
  if (!hasGrok()) throw new Error("no_grok_key");
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.grokApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.grokTextModel,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role === "model" ? "assistant" : "user", content: h.text })),
      ],
    }),
  });
  if (!res.ok) throw new Error(`grok ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (body.choices?.[0]?.message?.content ?? "").trim();
}

/** A short-lived token the browser uses to open a Grok realtime voice socket. The key stays here. */
export async function grokVoiceToken(seconds = 300): Promise<{ value: string; expiresAt: string }> {
  if (!hasGrok()) throw new Error("no_grok_key");
  const res = await fetch(`${API}/realtime/client_secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.grokApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expires_after: { seconds } }),
  });
  if (!res.ok) throw new Error(`grok token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { value: string; expires_at: number };
  return { value: body.value, expiresAt: new Date(body.expires_at * 1000).toISOString() };
}
