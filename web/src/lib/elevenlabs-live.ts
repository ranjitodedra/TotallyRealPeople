// Browser client for an ElevenLabs Agents conversation (voice only; the agent's custom LLM is Grok).
// Opens the signed URL from /api/references/[id]/voice and sends our prompt as the system prompt override.
// Audio: 16 kHz PCM16 up and 24 kHz PCM16 down, same as Gemini Live, so live-audio.ts works unchanged.
// The agent's own turn detection does turn-taking and barge-in. No resumption: a reconnect starts fresh.
// The protocol helpers at the top are shared with the phone bridge (src/phone/bridge.ts).

export type ElevenLabsMessage = {
  type: string;
  conversation_initiation_metadata_event?: { user_input_audio_format?: string; agent_output_audio_format?: string };
  audio_event?: { audio_base_64?: string };
  user_transcription_event?: { user_transcript?: string };
  agent_response_event?: { agent_response?: string };
  ping_event?: { event_id?: number };
};

/** First message on the socket: our prompt replaces the agent's system prompt (needs the override enabled). */
export const elevenLabsInit = (prompt: string) => ({
  type: "conversation_initiation_client_data",
  conversation_config_override: { agent: { prompt: { prompt } } },
});

/** A dashboard setting to fix when the agent's audio isn't PCM 16000 Hz in / 16000 or 24000 Hz out, else null. */
export function elevenLabsFormatProblem(m: ElevenLabsMessage) {
  const meta = m.conversation_initiation_metadata_event;
  const bad: string[] = [];
  if (meta?.user_input_audio_format && meta.user_input_audio_format !== "pcm_16000") bad.push(`input to PCM 16000 Hz (it is ${meta.user_input_audio_format})`);
  if (meta?.agent_output_audio_format && !["pcm_16000", "pcm_24000"].includes(meta.agent_output_audio_format)) bad.push(`output to PCM 16000 or 24000 Hz (it is ${meta.agent_output_audio_format})`);
  return bad.length ? `Set the ElevenLabs agent's audio ${bad.join(" and ")}.` : null;
}

/** The agent's output sample rate, from the start-of-conversation message. */
export const elevenLabsOutputRate = (m: ElevenLabsMessage) =>
  m.conversation_initiation_metadata_event?.agent_output_audio_format === "pcm_16000" ? 16000 : 24000;

export interface ElevenLabsEvents {
  onAudio(b64: string): void;
  /** The caller started talking: stop playing the old reply. */
  onInterrupted(): void;
  onCallerText(text: string): void;
  onReferenceText(text: string): void;
  onClose(): void;
}

export class ElevenLabsLive {
  /** Sample rate of the audio in onAudio, known once the conversation starts. */
  outputRate = 24000;
  private constructor(private ws: WebSocket) {}

  /** Opens the socket and sends the prompt. Resolves once the conversation has started. */
  static connect(cfg: { signedUrl: string; prompt: string }, on: ElevenLabsEvents): Promise<ElevenLabsLive> {
    const ws = new WebSocket(cfg.signedUrl);
    const live = new ElevenLabsLive(ws);

    return new Promise((resolve, reject) => {
      let ready = false;
      ws.onopen = () => live.send(elevenLabsInit(cfg.prompt));
      ws.onmessage = (e) => {
        let m: ElevenLabsMessage;
        try {
          m = JSON.parse(typeof e.data === "string" ? e.data : "");
        } catch {
          return;
        }
        switch (m.type) {
          case "conversation_initiation_metadata": {
            const problem = elevenLabsFormatProblem(m);
            if (problem) {
              live.close();
              return reject(new Error(problem));
            }
            live.outputRate = elevenLabsOutputRate(m);
            ready = true;
            resolve(live);
            break;
          }
          case "audio":
            if (m.audio_event?.audio_base_64) on.onAudio(m.audio_event.audio_base_64);
            break;
          case "interruption":
            on.onInterrupted();
            break;
          case "user_transcript":
            if (m.user_transcription_event?.user_transcript) on.onCallerText(m.user_transcription_event.user_transcript + " ");
            break;
          case "agent_response":
            if (m.agent_response_event?.agent_response) on.onReferenceText(m.agent_response_event.agent_response + " ");
            break;
          case "ping":
            live.send({ type: "pong", event_id: m.ping_event?.event_id });
            break;
        }
      };
      ws.onerror = () => {
        if (!ready) reject(new Error("Couldn't reach ElevenLabs voice."));
      };
      ws.onclose = (e) => {
        // A refused override (not enabled on the agent) shows up as a close with a reason.
        if (!ready) reject(new Error(e.reason ? `ElevenLabs: ${e.reason}` : "ElevenLabs voice closed the connection."));
        else on.onClose();
      };
    });
  }

  sendAudio(b64: string) {
    this.send({ user_audio_chunk: b64 });
  }

  /** A text turn from the "user" side; the agent answers it out loud (used for the opening line). */
  sendText(text: string) {
    this.send({ type: "user_message", text });
  }

  close() {
    this.ws.onclose = null;
    this.ws.close();
  }

  private send(msg: object) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
