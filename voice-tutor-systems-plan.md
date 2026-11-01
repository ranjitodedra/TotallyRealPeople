# Live voice tutor: systems plan

A compatible voice chat is one duplex session with Gemini Live. Speech recognition, the reply, and speech synthesis are the same model turn. There is no separate speech-to-text service, no separate text-to-speech service, no WebRTC media path, no wake word, and no push-to-talk.

This describes Everprimer as built. A later project can swap the lesson iframe and the credit ledger and keep the session shape.

## Stack

| Piece | What it is |
| --- | --- |
| Model | Gemini Live, default `gemini-3.8-live` (`TUTOR_LIVE_MODEL`) |
| SDK | `@google/genai` 2.x. Server and browser both use `GoogleGenAI` |
| API version | `v1alpha` (`TUTOR_LIVE_API_VERSION`). Ephemeral tokens are v1alpha in this SDK |
| Auth to Google | Server holds `GEMINI_API_KEY` (fallback `GOOGLE_GENERATIVE_AI_API_KEY`). Browser holds a single-use ephemeral token whose name starts with `auth_tokens/` |
| Transport | WebSocket opened by `ai.live.connect`. SDK URL: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.{version}.GenerativeService.BidiGenerateContentConstrained?access_token={token}` |
| Voice | Prebuilt Gemini voice, default `Puck` (`TUTOR_LIVE_VOICE`), locked into the token |
| Capture | `getUserMedia` plus an `AudioWorklet` (`pcm-capture`). Page downsamples to 16 kHz mono PCM16 |
| Playback | Web Audio `AudioBufferSourceNode` at 24 kHz mono PCM16, scheduled back to back |
| Turn taking | Gemini's own voice activity and barge-in (`serverContent.interrupted`). The page does not gate audio on a local VAD |
| Screen context | `postMessage` from the sandboxed lesson into the host, then `sendClientContent` as text |
| Metering | App routes, not the Live socket. `tutor_sessions` stores times, token counts, and credits. Audio and transcripts are not stored |
| App | Next.js route handlers under `apps/web`. Node runtime |

Lesson speech bubbles are authored text in the player. They are not this system. Character art (fal.ai) only paints the guide; `tutor_state` drives its glow.

## Components

1. **Host page** (`apps/web/src/components/live-tutor.tsx`, mounted from `artifact-player.tsx`). Owns the microphone, the Live socket, playback, reconnect, and the on-screen controls.
2. **Capture worklet** (`apps/web/public/worklets/pcm-capture.js`). Packs mic samples into ~85 ms blocks. Conversion happens on the page (`apps/web/src/lib/live-audio.ts`).
3. **Token service** (`apps/web/src/lib/live-tutor.ts`). Builds the system instruction, mints and renews tokens, records ticks, charges credits.
4. **Instruction builder** (`packages/ai/src/tutor.ts`, `buildTutorInstruction`). Age, reading level, lesson title, description, up to eight objectives, progress. No name, interests, or parent notes.
5. **HTTP routes**
   - `POST /api/tutor/live` — start. Body `{ sessionId }`. Returns the grant.
   - `POST /api/tutor/live/{id}/renew` — fresh token for the same row.
   - `POST /api/tutor/live/{id}/tick` — usage so far. Body `{ usage }`.
   - `POST /api/tutor/live/{id}/end` — final tick. `sendBeacon` on leave. Usage body optional.
6. **Lesson frame** (`packages/learnkit`). Posts `TutorContext`. Receives `tutor_state`. Sandbox is `allow-scripts` only. It never gets the microphone (`Permissions-Policy: microphone=(self)` on the app origin).
7. **Session row** `tutor_sessions`. Status `issued` or `ended`. Clients cannot insert or update it.

## Data flow

### Open

1. Learner taps **Live tutor**. The tap is the user gesture. `AudioContext` is created inside it so iOS will play sound. `getUserMedia` asks for one channel with echo cancellation, noise suppression, and auto gain.
2. `POST /api/tutor/live` with the open lesson's `artifact_sessions.id`. The route uses the signed-in user. Row-level security limits the read to that user's learners.
3. Server checks, in order: live tutor configured, plan flag `parents.tutor_enabled`, grown-up switch `parents.live_tutor_allowed`, credit balance above zero, no other `issued` session for this learner. A session with no tick for two minutes is closed first and no longer counts as open.
4. Server rebuilds the system instruction from the learner and the lesson, then calls `authTokens.create`:
   - `uses: 1`
   - `newSessionExpireTime`: 60 seconds to open the socket
   - `expireTime`: 30 minutes of connection
   - `liveConnectConstraints` lock model, system instruction, `responseModalities: [AUDIO]`, `inputAudioTranscription`, `outputAudioTranscription`, `contextWindowCompression.slidingWindow`, and `speechConfig` voice
   - `lockAdditionalFields: []`
5. Server inserts `tutor_sessions` (`status: issued`) and returns:

```ts
interface LiveTutorGrant {
  token: string;       // token.name, used as the browser apiKey
  model: string;
  apiVersion: string;  // "v1alpha"
  expiresAt: string;   // ISO, token lifetime
  tutorSessionId: string;
}
```

6. Browser constructs `new GoogleGenAI({ apiKey: grant.token, httpOptions: { apiVersion } })` and calls `ai.live.connect`. Client config sends only `responseModalities: [AUDIO]` and `sessionResumption`. Model, voice, instruction, transcription, and compression stay inside the token. The browser cannot change them.
7. Worklet starts. Each block is downsampled to 16 kHz, converted to little-endian PCM16, base64-encoded, and sent:

```ts
session.sendRealtimeInput({
  audio: { data: base64Pcm16, mimeType: "audio/pcm;rate=16000" },
});
```

The worklet node is connected through a gain of 0 to `AudioContext.destination`. That keeps the processor alive without playing the mic back.
8. First text turn greets, and if a screen is known, asks for one walk-through. See Screen context.

### Talk

Gemini detects speech, transcribes both sides, and replies in audio. The page treats messages like this:

- `usageMetadata` — add to the running `LiveUsage` (`textIn`, `audioIn`, `textOut`, `audioOut`). Thoughts count as text out. Each report is one model turn, including context the model re-read, so the total is cumulative-by-addition of per-turn reports, not a single running counter from Google.
- `sessionResumptionUpdate` — when `resumable` and `newHandle` are set, keep the handle.
- `goAway` — reconnect before the server drops the socket.
- `serverContent.interrupted` — learner barged in, or a new slide cut the walk-through. Stop every queued buffer immediately.
- `serverContent.inputTranscription.text` — signal only. Means the learner spoke, so the current turn is an answer, not a slide walk-through. The text is not shown and not saved.
- `serverContent.modelTurn.parts[].inlineData.data` — base64 PCM16 at 24 kHz. Decode, wrap in an `AudioBuffer`, start an `AudioBufferSourceNode` at `max(now + 30ms, previousEnd)`.
- `serverContent.turnComplete` — reply finished. Wait for the learner.

Output transcription is requested on the token so the model runs in that mode. The page does not read `outputTranscription`.

Local RMS above `0.02` sets "the learner is talking" for the status light and the idle clock. It does not start or stop the uplink. While the session is live and unmuted, every block is sent.

Mute disables the mic track and sends `sendRealtimeInput({ audioStreamEnd: true })`. Unmute re-enables the track and streaming resumes.

### Screen context

The lesson posts:

```ts
{ source: "learnkit", v: protocolVersion, kind: "context", nonce, context: TutorContext }
```

The host checks `event.source` is the lesson iframe and `nonce` matches the session. It keeps the latest `TutorContext` and, while the tutor is live, forwards it after a 900 ms debounce.

`TutorContext` fields: `screen` (`section | bite | map | session_done | final | score`), optional `title`, `sessionTitle`, `biteType`, `text` (max 1500), `question` (`prompt`, `options`, `hint`), `answered`, `correct`, `explanation` (max 600), `progress` (`round`, `rounds`). The player omits `explanation` until the learner has answered or the answer has been revealed.

The host formats that as a `[screen]` note and sends it as a user text turn:

```ts
session.sendClientContent({
  turns: [{ role: "user", parts: [{ text }] }],
  turnComplete: boolean, // true only when an instruction is appended
});
```

Two appendages, both keyed by the system instruction:

- Greeting, once, on connect: `(The learner just turned on the voice tutor. Say hi in a few words first.)`
- Walk-through, once per slide: `(The learner hasn't said anything yet.) Explain this screen`

The instruction tells the model: a `[screen]` note is context and is not read aloud; a note that ends with `Explain this screen` gets two to four sentences, then silence; any other `[screen]` note gets no reply. On an unanswered question the model must not give the answer.

A slide is identified by screen, titles, bite type, round, and question prompt. Answering or revealing the same question does not count as a new slide. A new slide is explained immediately when the tutor is quiet or still walking through the previous slide (playback is flushed). If the tutor is answering the learner, the new screen is sent as context and the walk-through waits until playback, the reply, and 1.2 s of learner silence.

### Voice state back to the lesson

Every 200 ms the host publishes one of `idle | listening | thinking | speaking`:

- `speaking` while a buffer is still scheduled
- `listening` while the learner's RMS was hot in the last 600 ms, or while waiting with nothing in flight
- `thinking` while a reply is expected and nothing is playing

The host posts `{ source: "learnkit-host", kind: "tutor_state", state }` into the iframe. The player sets `data-tutor` on `document.body`. That is the character glow. `idle` clears it.

### Meter

Every 60 seconds, and once more on end, the browser posts cumulative `LiveUsage`. The server measures elapsed time on its own clock. Cost is `creditsForLive(usage)` held between a per-minute floor and a per-minute ceiling (`boundedLiveCredits`). The floor is the price of the mic stream (audio in at 32 tokens/second) so a client that under-reports still pays. The ceiling caps a chatty minute. The tick writes the new total only if `credits_used` is still the value just read, then charges the delta as `live` usage. Three attempts. Response:

```ts
interface LiveTutorTick {
  stop: "credits" | "ended" | null;
  creditsUsed: number;
  secondsUsed: number;
}
```

`stop: "credits"` or `"ended"` closes the client. There is no time cap.

### Reconnect

Gemini moves a long conversation to a new socket every few minutes (`goAway`, `onclose`, `onerror`). The token is also renewed 60 seconds before `expiresAt`.

1. Ignore if a reconnect is already in progress.
2. `POST /renew`. Same checks as start, against the open row. Instruction is rebuilt, so progress can change. New single-use token.
3. `ai.live.connect` with `sessionResumption: { handle }` when a handle exists.
4. If connect with a handle throws, drop the handle and connect fresh.
5. A socket that dies within 5 seconds of opening is treated as not resumable: clear the handle.
6. A fresh conversation (no handle, or the handle was discarded) re-sends the current screen. A resumed conversation does not.
7. Three failures, with backoff of 1s, 2s, then stop. The user sees "The tutor got disconnected."

Connection callbacks carry an id. Messages from a replaced socket are ignored.

### Close

The socket, worklet, mic tracks, and `AudioContext` are torn down, then `POST /end` via `navigator.sendBeacon` (fallback `fetch` with `keepalive`) with the last usage. The server sets `status: ended` and charges the remainder.

The client closes on: End, two minutes with nobody talking and nothing playing, credits exhausted, the document becoming hidden, `pagehide`, or the component unmounting (leaving the lesson). A server row that stops receiving ticks is closed after two minutes at its last `last_seen_at`.

## Interfaces worth keeping

**Grant.** Opaque token plus model, API version, expiry, and the app's session id. The browser never sees the API key or the system instruction text.

**Locked connect config.** Whatever must not be attacker-controlled belongs in `liveConnectConstraints` on the token: model, instruction, modality, voice, transcription, compression. The browser connect call stays thin.

**Audio framing.** Uplink `audio/pcm;rate=16000`, 16-bit little-endian mono, base64, ~85 ms blocks. Downlink 24 kHz PCM16 base64 in `inlineData`. Gapless scheduling with a ~30 ms lead. Flush the queue on `interrupted`.

**Two channels into the model.** Mic audio is realtime input. Everything else (screen, greet, explain) is a text client turn. Do not speak the screen by playing a recording of it.

**One explain per slide, deferred during a learner answer.** `inputTranscription` is the signal that a person spoke. It is not a transcript store.

**Resumption handle.** Persist the latest `newHandle` in memory only. Renew the token before expiry and on `goAway`. Re-send screen context only when the handle was dropped.

**Server clock for time, client report for tokens, bounds for trust.** Charge the delta. Compare-and-set on the last billed total so a tick and an end beacon cannot double-charge.

**Mic stays on the parent origin.** The untrusted lesson frame gets context out and voice state in. It does not get `getUserMedia`.

## Patterns

- **Session, not walkie-talkie.** One button starts a continuous duplex session. Mute is an in-session control, not the activation gesture. There is no wake word.
- **Gesture first.** Create the `AudioContext` and call `getUserMedia` in the click handler.
- **Instruction is a server secret.** Rebuild it on every mint and every renew. The prompt tells the model to coach, stay on the lesson, refuse personal details, and stay quiet after a screen explanation.
- **Safety copy is shared** with the rest of the product (`SAFETY` in `packages/ai/src/prompts.ts`) and then tightened by the voice-tutor rules in `buildTutorInstruction`.
- **Nothing of the audio is durable.** `tutor_sessions` keeps `model`, `status`, `started_at`, `expires_at`, `ended_at`, `seconds_used`, `last_seen_at`, `credits_used`, `input_tokens`, `output_tokens`, and foreign keys. Insert and update are service-role only.
- **One open conversation per learner.** A second start returns `busy` (409) until the first ends or goes stale.
- **Failures the client can show:** `plan` (403), `disabled` (403), `credits` (402), `busy` (409), `unavailable` (503), plus local `mic`, `dropped`, and `idle`.
- **Hide means stop.** Backgrounding the page ends the session. Nothing listens in the background.
- **Native shells** need `NSMicrophoneUsageDescription` (iOS) and `RECORD_AUDIO` (Android). The web policy is `microphone=(self)`.

## What a compatible hackathon build needs

Minimum to sound the same:

1. A server that mints a v1alpha ephemeral token with audio-only responses, a locked system instruction, input and output transcription, sliding-window compression, and a prebuilt voice.
2. A page that, on a click, opens the mic, connects with `ai.live.connect` using the token as the API key, streams 16 kHz PCM16, and plays 24 kHz PCM16.
3. Text side-channel turns for anything the model should know but not hear as speech.
4. Handle `interrupted`, `goAway`, and session resumption.
5. Tear the mic down on end, hide, and page leave.

Billing, the lesson iframe, and the character glow are product-specific. Drop them and the voice loop still matches. Keep the token lock and the "no audio stored" rule if the conversation is with a child: Google's Gemini API additional terms restrict use in services directed at people under 18, so a real deployment needs a legal review or a different offering before it is turned on for learners.

## Source map

- `apps/web/src/components/live-tutor.tsx` — session lifecycle, socket, playback, reconnect
- `apps/web/src/lib/live-audio.ts` — PCM, screen formatting, usage split
- `apps/web/public/worklets/pcm-capture.js` — mic blocks
- `apps/web/src/lib/live-tutor.ts` — entitlement, mint, renew, tick
- `apps/web/src/lib/live-tutor-access.ts` — auth on renew, tick, end
- `apps/web/src/lib/env.ts` — `liveTutorEnv`
- `apps/web/src/app/api/tutor/live/**` — HTTP
- `packages/ai/src/tutor.ts` — system instruction
- `packages/ai/src/pricing.ts` — `boundedLiveCredits`
- `packages/contracts/src/events.ts` — `TutorContext`, `TutorVoiceState`
- `packages/learnkit/src/player.ts` — context the lesson posts, glow it applies
- `packages/db/supabase/migrations/0009_lesson_tutor.sql` — `tutor_sessions`
