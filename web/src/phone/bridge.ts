// One phone call: Twilio Media Stream (WebSocket) ⇄ Gemini Live, using the real API key on the server.
// The voice webhook (src/app/twiml/voice/route.ts) already spoke the AI disclosure and signed a token
// naming the reference; the stream's "start" event carries that token.

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { WebSocket } from "ws";
import { env } from "../lib/env";
import { buildReferenceInstruction, phoneGreeting } from "../lib/instruction";
import { readReferenceFromDisk } from "../lib/store";
import { checkStreamToken } from "../lib/twilio";
import { Downlink, twilioToGemini } from "./audio";

type TwilioEvent =
  | { event: "connected" }
  | { event: "start"; start: { streamSid: string; callSid: string; customParameters?: Record<string, string> } }
  | { event: "media"; media: { payload: string } }
  | { event: "mark" | "dtmf" }
  | { event: "stop" };

// Twilio sends 20 ms frames; batch a few so Gemini gets ~100 ms blocks like the browser path.
const FRAMES_PER_SEND = 5;

export function handleTwilioStream(ws: WebSocket) {
  let streamSid = "";
  let session: Session | null = null;
  let ended = false;
  let frames: string[] = [];
  const down = new Downlink();

  const end = (why: string) => {
    if (ended) return;
    ended = true;
    console.log(`[phone] call ended: ${why}`);
    try {
      session?.close();
    } catch {}
    if (ws.readyState === ws.OPEN) ws.close();
  };

  const toTwilio = (msg: object) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const onGemini = (m: LiveServerMessage) => {
    const sc = m.serverContent;
    if (m.goAway) console.log("[phone] Gemini goAway; the call ends when the session closes");
    if (!sc) return;
    if (sc.interrupted) {
      // Barge-in: drop what Twilio has queued so the caller stops hearing the old reply.
      down.reset();
      toTwilio({ event: "clear", streamSid });
    }
    if (sc.inputTranscription?.text) console.log(`[phone] caller: ${sc.inputTranscription.text}`);
    if (sc.outputTranscription?.text) console.log(`[phone] reference: ${sc.outputTranscription.text}`);
    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data || !part.inlineData?.mimeType?.startsWith("audio/")) continue;
      const payload = down.convert(data);
      if (payload) toTwilio({ event: "media", streamSid, media: { payload } });
    }
  };

  const start = async (token: string | undefined) => {
    const id = token ? checkStreamToken(token) : null;
    if (!id) return end("bad or expired stream token");
    const p = await readReferenceFromDisk(id);
    if (!p) return end(`reference ${id} not found`);
    if (!env.geminiApiKey) return end("no GEMINI_API_KEY");

    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: env.liveApiVersion } });
    const s = await ai.live.connect({
      model: env.liveModel,
      config: {
        systemInstruction: buildReferenceInstruction(p, "phone"),
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voice } } },
      },
      callbacks: {
        onmessage: onGemini,
        onerror: (e) => {
          console.error("[phone] Gemini error", e.message);
          end("Gemini error");
        },
        onclose: () => end("Gemini closed"),
      },
    });
    if (ended) return s.close();
    session = s;
    console.log(`[phone] connected call to reference ${p.id} (${p.manager.name})`);
    s.sendClientContent({ turns: [{ role: "user", parts: [{ text: phoneGreeting(p) }] }], turnComplete: true });
  };

  ws.on("message", (raw) => {
    let msg: TwilioEvent;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start":
        streamSid = msg.start.streamSid;
        console.log(`[phone] call ${msg.start.callSid} started`);
        start(msg.start.customParameters?.token).catch((e) => {
          console.error("[phone] could not start Gemini", e);
          end("Gemini connect failed");
        });
        break;
      case "media":
        // Audio before Gemini is ready (during the greeting) is dropped.
        if (!session) break;
        frames.push(msg.media.payload);
        if (frames.length >= FRAMES_PER_SEND) {
          const joined = Buffer.concat(frames.map((f) => Buffer.from(f, "base64"))).toString("base64");
          frames = [];
          session.sendRealtimeInput({ audio: { data: twilioToGemini(joined), mimeType: "audio/pcm;rate=16000" } });
        }
        break;
      case "stop":
        end("caller hung up");
        break;
    }
  });
  ws.on("close", () => end("stream closed"));
  ws.on("error", (e) => {
    console.error("[phone] stream error", e.message);
    end("stream error");
  });
}
