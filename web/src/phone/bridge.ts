// One phone call: Twilio Media Stream (WebSocket) ⇄ Gemini Live, Grok realtime or ElevenLabs (the reference's
// Voice choice, lib/models.ts), using the real API key on the server.
// The voice webhook (src/app/twiml/voice/route.ts) signed a token naming the reference; the stream's
// "start" event carries that token.

import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { WebSocket } from "ws";
import { elevenLabsSignedUrl } from "../lib/elevenlabs";
import { elevenLabsFormatProblem, elevenLabsInit, elevenLabsOutputRate, type ElevenLabsMessage } from "../lib/elevenlabs-live";
import { env } from "../lib/env";
import { buildReferenceInstruction, PHONE_GREETING } from "../lib/instruction";
import { MANAGER } from "../lib/manager";
import { resolveModel } from "../lib/models";
import { readReferenceFromDisk } from "../lib/store";
import { checkStreamToken } from "../lib/twilio";
import type { ReferenceProfile } from "../lib/types";
import { Downlink, twilioToGemini } from "./audio";

type TwilioEvent =
  | { event: "connected" }
  | { event: "start"; start: { streamSid: string; callSid: string; customParameters?: Record<string, string> } }
  | { event: "media"; media: { payload: string } }
  | { event: "mark" | "dtmf" }
  | { event: "stop" };

// Twilio sends 20 ms frames; batch a few so the model gets ~100 ms blocks like the browser path.
const FRAMES_PER_SEND = 5;

/** The model side of a call. `send` takes Twilio's own payload (8 kHz μ-law, base64). */
type Upstream = { send(mulaw: string): void; close(): void };

/** What the model side tells the call. `audio` is already a Twilio payload. */
type CallEvents = { audio(mulaw: string): void; interrupted(): void; closed(why: string): void };

export function handleTwilioStream(ws: WebSocket) {
  let streamSid = "";
  let session: Upstream | null = null;
  let ended = false;
  let frames: string[] = [];

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

  const events: CallEvents = {
    audio: (payload) => toTwilio({ event: "media", streamSid, media: { payload } }),
    // Barge-in: drop what Twilio has queued so the caller stops hearing the old reply.
    interrupted: () => toTwilio({ event: "clear", streamSid }),
    closed: end,
  };

  const start = async (token: string | undefined) => {
    const id = token ? checkStreamToken(token) : null;
    if (!id) return end("bad or expired stream token");
    const p = await readReferenceFromDisk(id);
    if (!p) return end(`reference ${id} not found`);
    const { using } = resolveModel(p, "voice");
    if (!using) return end("no voice API key");

    const s =
      using === "grok" ? await openGrok(p, events) : using === "elevenlabs" ? await openElevenLabs(p, events) : await openGemini(p, events);
    if (ended) return s.close();
    session = s;
    console.log(`[phone] connected call to reference ${p.id} (${p.manager.name}) on ${using}`);
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
          console.error("[phone] could not start the voice model", e);
          end("voice model connect failed");
        });
        break;
      case "media":
        // Audio before the model is ready is dropped.
        if (!session) break;
        frames.push(msg.media.payload);
        if (frames.length >= FRAMES_PER_SEND) {
          const joined = Buffer.concat(frames.map((f) => Buffer.from(f, "base64"))).toString("base64");
          frames = [];
          session.send(joined);
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

// Gemini Live: 16 kHz PCM in, 24 kHz PCM out, so audio.ts converts both ways.
async function openGemini(p: ReferenceProfile, on: CallEvents): Promise<Upstream> {
  const down = new Downlink();
  const onMessage = (m: LiveServerMessage) => {
    const sc = m.serverContent;
    if (m.goAway) console.log("[phone] Gemini goAway; the call ends when the session closes");
    if (!sc) return;
    if (sc.interrupted) {
      down.reset();
      on.interrupted();
    }
    if (sc.inputTranscription?.text) console.log(`[phone] caller: ${sc.inputTranscription.text}`);
    if (sc.outputTranscription?.text) console.log(`[phone] reference: ${sc.outputTranscription.text}`);
    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data || !part.inlineData?.mimeType?.startsWith("audio/")) continue;
      const payload = down.convert(data);
      if (payload) on.audio(payload);
    }
  };

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
      onmessage: onMessage,
      onerror: (e) => {
        console.error("[phone] Gemini error", e.message);
        on.closed("Gemini error");
      },
      onclose: () => on.closed("Gemini closed"),
    },
  });
  s.sendClientContent({ turns: [{ role: "user", parts: [{ text: PHONE_GREETING }] }], turnComplete: true });
  return {
    send: (mulaw) => s.sendRealtimeInput({ audio: { data: twilioToGemini(mulaw), mimeType: "audio/pcm;rate=16000" } }),
    close: () => s.close(),
  };
}

// Grok realtime speaks G.711 μ-law at 8 kHz natively, so Twilio's payloads pass straight through.
// Server-side, so it uses the API key in a header (no ephemeral token).
function openGrok(p: ReferenceProfile, on: CallEvents): Promise<Upstream> {
  const url = `wss://api.x.ai/v1/realtime?model=${encodeURIComponent(env.grokVoiceModel)}`;
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${env.grokApiKey}` } });
  const send = (msg: object) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  let ready = false;

  return new Promise((resolve, reject) => {
    ws.on("open", () =>
      send({
        type: "session.update",
        session: {
          instructions: buildReferenceInstruction(p, "phone"),
          voice: env.grokVoice || MANAGER.grokVoice,
          turn_detection: { type: "server_vad" },
          audio: { input: { format: { type: "audio/pcmu" } }, output: { format: { type: "audio/pcmu" } } },
        },
      }),
    );
    ws.on("message", (raw) => {
      let m: { type: string; delta?: string; transcript?: string; error?: { message?: string } };
      try {
        m = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (m.type) {
        case "session.updated":
          if (ready) break;
          ready = true;
          // Makes the model speak first; its opening line (the AI disclosure) comes from "## Phone" in the prompt file.
          send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: PHONE_GREETING }] } });
          send({ type: "response.create" });
          resolve({ send: (mulaw) => send({ type: "input_audio_buffer.append", audio: mulaw }), close: () => ws.close() });
          break;
        case "response.output_audio.delta":
        case "response.audio.delta":
          if (m.delta) on.audio(m.delta);
          break;
        case "input_audio_buffer.speech_started":
          on.interrupted();
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (m.transcript) console.log(`[phone] caller: ${m.transcript}`);
          break;
        case "response.output_audio_transcript.done":
          if (m.transcript) console.log(`[phone] reference: ${m.transcript}`);
          break;
        case "error":
          console.error("[phone] Grok error", m.error?.message);
          if (!ready) reject(new Error(m.error?.message || "Grok refused the session"));
          break;
      }
    });
    ws.on("error", (e) => {
      console.error("[phone] Grok socket error", e.message);
      if (!ready) reject(e);
      else on.closed("Grok error");
    });
    ws.on("close", () => {
      if (!ready) reject(new Error("Grok closed before the session started"));
      else on.closed("Grok closed");
    });
  });
}

// ElevenLabs agent (its custom LLM is Grok): 16 kHz PCM in, 24 kHz PCM out like Gemini, so audio.ts
// converts both ways. Our prompt goes in as the system prompt override.
async function openElevenLabs(p: ReferenceProfile, on: CallEvents): Promise<Upstream> {
  const ws = new WebSocket(await elevenLabsSignedUrl());
  let down = new Downlink();
  const send = (msg: object) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  let ready = false;

  return new Promise((resolve, reject) => {
    ws.on("open", () => send(elevenLabsInit(buildReferenceInstruction(p, "phone"))));
    ws.on("message", (raw) => {
      let m: ElevenLabsMessage;
      try {
        m = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (m.type) {
        case "conversation_initiation_metadata": {
          const problem = elevenLabsFormatProblem(m);
          if (problem) {
            ws.close();
            return reject(new Error(problem));
          }
          down = new Downlink(elevenLabsOutputRate(m) / 8000);
          ready = true;
          // Makes the agent speak first; its opening line (the AI disclosure) comes from "## Phone" in the prompt file.
          send({ type: "user_message", text: PHONE_GREETING });
          resolve({ send: (mulaw) => send({ user_audio_chunk: twilioToGemini(mulaw) }), close: () => ws.close() });
          break;
        }
        case "audio": {
          const payload = m.audio_event?.audio_base_64 ? down.convert(m.audio_event.audio_base_64) : "";
          if (payload) on.audio(payload);
          break;
        }
        case "interruption":
          down.reset();
          on.interrupted();
          break;
        case "user_transcript":
          if (m.user_transcription_event?.user_transcript) console.log(`[phone] caller: ${m.user_transcription_event.user_transcript}`);
          break;
        case "agent_response":
          if (m.agent_response_event?.agent_response) console.log(`[phone] reference: ${m.agent_response_event.agent_response}`);
          break;
        case "ping":
          send({ type: "pong", event_id: m.ping_event?.event_id });
          break;
      }
    });
    ws.on("error", (e) => {
      console.error("[phone] ElevenLabs socket error", e.message);
      if (!ready) reject(e);
      else on.closed("ElevenLabs error");
    });
    ws.on("close", (_code, reason) => {
      if (!ready) reject(new Error(`ElevenLabs closed before the conversation started${reason.length ? `: ${reason}` : ""}`));
      else on.closed("ElevenLabs closed");
    });
  });
}
