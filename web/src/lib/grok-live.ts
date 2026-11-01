// Browser client for xAI's Grok realtime Voice Agent API (wss://api.x.ai/v1/realtime).
// Auth is the short-lived token from /api/references/[id]/voice, passed as a WebSocket subprotocol
// because browsers can't set headers. Audio: 16 kHz PCM16 up and 24 kHz PCM16 down (same as Gemini
// Live, so live-audio.ts works unchanged). Server VAD does turn-taking and barge-in.

export interface GrokEvents {
  onAudio(b64: string): void;
  /** The caller started talking: stop playing the old reply. */
  onInterrupted(): void;
  onCallerText(text: string): void;
  onReferenceText(text: string): void;
  onTurnComplete(): void;
  /** Conversation id for resuming after a reconnect. */
  onConversation(id: string): void;
  onClose(): void;
}

export interface GrokConfig {
  token: string;
  model: string;
  instructions: string;
  voice: string;
  /** Resume this conversation instead of starting a new one. */
  conversationId?: string | null;
}

type ServerEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  conversation?: { id?: string };
  error?: { message?: string };
};

export class GrokLive {
  private constructor(private ws: WebSocket) {}

  /** Opens the socket and sends the session settings. Resolves once the session is configured. */
  static connect(cfg: GrokConfig, on: GrokEvents): Promise<GrokLive> {
    const url = new URL("wss://api.x.ai/v1/realtime");
    url.searchParams.set("model", cfg.model);
    if (cfg.conversationId) url.searchParams.set("conversation_id", cfg.conversationId);
    const ws = new WebSocket(url, [`xai-client-secret.${cfg.token}`]);
    const live = new GrokLive(ws);

    return new Promise((resolve, reject) => {
      let ready = false;
      ws.onopen = () =>
        live.send({
          type: "session.update",
          session: {
            instructions: cfg.instructions,
            voice: cfg.voice,
            turn_detection: { type: "server_vad" },
            resumption: { enabled: true },
            audio: {
              input: { format: { type: "audio/pcm", rate: 16000 } },
              output: { format: { type: "audio/pcm", rate: 24000 } },
            },
          },
        });
      ws.onmessage = (e) => {
        let m: ServerEvent;
        try {
          m = JSON.parse(typeof e.data === "string" ? e.data : "");
        } catch {
          return;
        }
        switch (m.type) {
          case "session.updated":
            if (!ready) {
              ready = true;
              resolve(live);
            }
            break;
          case "conversation.created":
            if (m.conversation?.id) on.onConversation(m.conversation.id);
            break;
          case "response.output_audio.delta":
          case "response.audio.delta":
            if (m.delta) on.onAudio(m.delta);
            break;
          case "response.output_audio_transcript.delta":
            if (m.delta) on.onReferenceText(m.delta);
            break;
          case "conversation.item.input_audio_transcription.completed":
            if (m.transcript) on.onCallerText(m.transcript + " ");
            break;
          case "input_audio_buffer.speech_started":
            on.onInterrupted();
            break;
          case "response.done":
            on.onTurnComplete();
            break;
          case "error":
            console.warn("[grok voice]", m.error?.message ?? m);
            if (!ready) reject(new Error(m.error?.message || "Grok voice refused the session."));
            break;
        }
      };
      ws.onerror = () => {
        if (!ready) reject(new Error("Couldn't reach Grok voice."));
      };
      ws.onclose = () => {
        if (!ready) reject(new Error("Grok voice closed the connection."));
        else on.onClose();
      };
    });
  }

  sendAudio(b64: string) {
    this.send({ type: "input_audio_buffer.append", audio: b64 });
  }

  /** A text turn from the "user" side, then ask for a spoken reply (used for the opening line). */
  sendText(text: string) {
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    this.send({ type: "response.create" });
  }

  /** Muted: drop half-heard audio so VAD doesn't hang on it. */
  clearInput() {
    this.send({ type: "input_audio_buffer.clear" });
  }

  close() {
    this.ws.onclose = null;
    this.ws.close();
  }

  private send(msg: object) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
