"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { useCallback, useEffect, useRef, useState } from "react";
import { downsample, floatToPcm16Base64, pcm16Base64ToFloat, Player, rms } from "@/lib/live-audio";

type Status = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
type Grant = { token: string; model: string; apiVersion: string; expiresAt: string };
type Caption = { who: "caller" | "reference"; text: string };

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready when you are",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  error: "Disconnected",
};

/**
 * One continuous duplex Gemini Live session. Adapted from the Everprimer voice tutor:
 * token minted server-side, 16 kHz PCM up, 24 kHz PCM down, flush on barge-in,
 * resume on goAway, tear everything down on end/hide/leave.
 */
export function VoiceCall({ referenceId, managerName }: { referenceId: string; managerName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);

  const r = useRef({
    ctx: null as AudioContext | null,
    stream: null as MediaStream | null,
    node: null as AudioWorkletNode | null,
    session: null as Session | null,
    player: null as Player | null,
    handle: null as string | null,
    connId: 0,
    live: false,
    muted: false,
    awaitingReply: false,
    lastVoiceAt: 0,
    reconnecting: false,
    failures: 0,
    renewTimer: 0 as unknown as ReturnType<typeof setTimeout>,
    statusTimer: 0 as unknown as ReturnType<typeof setInterval>,
    openedAt: 0,
  });

  const addCaption = useCallback((who: Caption["who"], text: string) => {
    if (!text) return;
    setCaptions((c) => {
      const last = c.at(-1);
      if (last && last.who === who) return [...c.slice(0, -1), { who, text: last.text + text }];
      return [...c.slice(-11), { who, text }];
    });
  }, []);

  const teardown = useCallback(() => {
    const s = r.current;
    s.live = false;
    s.connId++;
    clearTimeout(s.renewTimer);
    clearInterval(s.statusTimer);
    try {
      s.session?.close();
    } catch {}
    s.session = null;
    s.node?.port.close();
    s.node?.disconnect();
    s.node = null;
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    s.player?.flush();
    s.ctx?.close().catch(() => {});
    s.ctx = null;
    s.handle = null;
  }, []);

  const end = useCallback(() => {
    teardown();
    setStatus("idle");
    setMuted(false);
  }, [teardown]);

  const fetchGrant = useCallback(async (): Promise<Grant> => {
    const res = await fetch(`/api/references/${referenceId}/voice`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Voice is unavailable right now.");
    return body;
  }, [referenceId]);

  const connectRef = useRef<(grant: Grant, fresh: boolean) => Promise<void>>(async () => {});

  const reconnect = useCallback(async () => {
    const s = r.current;
    if (s.reconnecting || !s.live) return;
    s.reconnecting = true;
    while (s.live && s.failures < 3) {
      try {
        const grant = await fetchGrant();
        await connectRef.current(grant, false);
        s.reconnecting = false;
        return;
      } catch {
        s.failures++;
        s.handle = null;
        await new Promise((ok) => setTimeout(ok, 1000 * s.failures));
      }
    }
    s.reconnecting = false;
    if (s.live) {
      teardown();
      setStatus("error");
      setError("The reference got disconnected. Call again.");
    }
  }, [fetchGrant, teardown]);

  const onMessage = useCallback(
    (id: number, m: LiveServerMessage) => {
      const s = r.current;
      if (id !== s.connId) return; // stale socket
      const sc = m.serverContent;
      if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
        s.handle = m.sessionResumptionUpdate.newHandle;
      }
      if (m.goAway) void reconnect();
      if (!sc) return;
      if (sc.interrupted) s.player?.flush();
      if (sc.inputTranscription?.text) {
        s.awaitingReply = true;
        addCaption("caller", sc.inputTranscription.text);
      }
      if (sc.outputTranscription?.text) addCaption("reference", sc.outputTranscription.text);
      for (const part of sc.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (data && part.inlineData?.mimeType?.startsWith("audio/")) {
          s.awaitingReply = false;
          s.player?.play(pcm16Base64ToFloat(data));
        }
      }
      if (sc.turnComplete) s.awaitingReply = false;
    },
    [addCaption, reconnect],
  );

  const connect = useCallback(async (grant: Grant, fresh: boolean) => {
    const s = r.current;
    const id = ++s.connId;
    try {
      s.session?.close();
    } catch {}
    const ai = new GoogleGenAI({ apiKey: grant.token, httpOptions: { apiVersion: grant.apiVersion } });
    const open = (handle: string | null) =>
      ai.live.connect({
        model: grant.model,
        config: { responseModalities: [Modality.AUDIO], sessionResumption: handle ? { handle } : {} },
        callbacks: {
          onopen: () => {},
          onmessage: (m) => onMessage(id, m),
          onerror: () => {
            if (id === s.connId) void reconnect();
          },
          onclose: () => {
            if (id !== s.connId || !s.live) return;
            if (Date.now() - s.openedAt < 5000) s.handle = null; // died instantly: don't trust the handle
            void reconnect();
          },
        },
      });
    let session: Session;
    try {
      session = await open(s.handle);
    } catch (e) {
      if (!s.handle) throw e;
      s.handle = null;
      session = await open(null);
      fresh = true;
    }
    s.session = session;
    s.openedAt = Date.now();
    s.failures = 0;
    clearTimeout(s.renewTimer);
    s.renewTimer = setTimeout(() => void reconnect(), new Date(grant.expiresAt).getTime() - Date.now() - 60_000);
    if (fresh && !s.handle) {
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "(The caller just connected. Introduce yourself in one short sentence.)" }] }],
        turnComplete: true,
      });
      s.awaitingReply = true;
    }
  }, [onMessage, reconnect]);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const start = useCallback(async () => {
    setError(null);
    setCaptions([]);
    setStatus("connecting");
    const s = r.current;
    // Gesture first: create the AudioContext and ask for the mic inside the click.
    const ctx = new AudioContext();
    s.ctx = ctx;
    void ctx.resume();
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      teardown();
      setStatus("error");
      setError("Microphone access was blocked. Allow it in your browser and try again.");
      return;
    }
    try {
      await ctx.audioWorklet.addModule("/worklets/pcm-capture.js");
      s.player = new Player(ctx);
      const grant = await fetchGrant();
      s.live = true;
      await connectRef.current(grant, true);
    } catch (e) {
      teardown();
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't start the call.");
      return;
    }

    const src = ctx.createMediaStreamSource(s.stream!);
    const node = new AudioWorkletNode(ctx, "pcm-capture");
    const silent = ctx.createGain();
    silent.gain.value = 0; // keeps the worklet running without echoing the mic
    src.connect(node).connect(silent).connect(ctx.destination);
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (!s.live || s.muted || !s.session) return;
      if (rms(e.data) > 0.02) s.lastVoiceAt = Date.now();
      const pcm = floatToPcm16Base64(downsample(e.data, ctx.sampleRate));
      try {
        s.session.sendRealtimeInput({ audio: { data: pcm, mimeType: "audio/pcm;rate=16000" } });
      } catch {}
    };
    s.node = node;

    s.statusTimer = setInterval(() => {
      if (!s.live) return;
      if (s.player?.playing) setStatus("speaking");
      else if (Date.now() - s.lastVoiceAt < 600) setStatus("listening");
      else if (s.awaitingReply) setStatus("thinking");
      else setStatus("listening");
    }, 200);
  }, [fetchGrant, teardown]);

  const toggleMute = useCallback(() => {
    const s = r.current;
    const next = !s.muted;
    s.muted = next;
    s.stream?.getAudioTracks().forEach((t) => (t.enabled = !next));
    if (next) {
      try {
        s.session?.sendRealtimeInput({ audioStreamEnd: true });
      } catch {}
    }
    setMuted(next);
  }, []);

  // Hide means stop. Nothing listens in the background.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && r.current.live) end();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", end);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", end);
      teardown();
    };
  }, [end, teardown]);

  const inCall = status !== "idle" && status !== "error";

  return (
    <div className="card flex flex-col gap-3">
      {!inCall ? (
        <button className="btn-call" onClick={start}>
          <PhoneIcon /> Call {managerName.split(" ")[0]}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className={`pulse pulse-${status}`} aria-hidden />
          <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={toggleMute} aria-pressed={muted}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button className="btn btn-danger" onClick={end}>
              End call
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {captions.length > 0 && (
        <div className="captions" aria-live="polite">
          {captions.map((c, i) => (
            <p key={i} className={c.who === "caller" ? "cap-caller" : "cap-ref"}>
              <span>{c.who === "caller" ? "You" : managerName.split(" ")[0]}</span> {c.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}
