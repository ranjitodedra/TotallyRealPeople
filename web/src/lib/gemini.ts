import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env, hasGemini } from "./env";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI | null {
  if (!hasGemini()) return null;
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

/** One model call that must return JSON matching `schema`. */
export async function generateJson<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
): Promise<z.infer<T>> {
  const ai = gemini();
  if (!ai) throw new Error("no_gemini_key");
  const res = await ai.models.generateContent({
    model: env.textModel,
    contents: [{ role: "user", parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
      temperature: 0.2,
    },
  });
  return schema.parse(JSON.parse(res.text ?? "{}"));
}

export async function generateText(system: string, history: { role: "user" | "model"; text: string }[]) {
  const ai = gemini();
  if (!ai) throw new Error("no_gemini_key");
  const res = await ai.models.generateContent({
    model: env.textModel,
    contents: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    config: { systemInstruction: system, temperature: 0.5 },
  });
  return (res.text ?? "").trim();
}
