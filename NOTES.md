# Team notes (gist)

Short version of where things stand. Full plans: Jirat's scope (below) and `voice-tutor-systems-plan.md` (the voice engine we're reusing).

## What we're building

User gives a résumé + job description and picks a manager template. We create a reference agent playing that manager, with an email address and a voice line. Each agent says it's an AI simulation when a call or email starts.

**Build order:** MVP (no phone number) → phone number → ElevenLabs / extra voices.

**Sponsor tracks:** Render (hosting, and the phone bridge if we ship it), Agentboxd (the agent's email inbox).

## Voice: reuse the Everprimer design

`voice-tutor-systems-plan.md` describes a working Gemini Live voice loop. We keep the core and drop the product-specific parts.

**Keep**
- Server mints a single-use ephemeral token (`authTokens.create`, `v1alpha`) that locks the model, system instruction, voice, `responseModalities: [AUDIO]`, transcription and compression. The browser never sees the API key or the prompt.
- Browser: on click, create the `AudioContext` and call `getUserMedia`, then `ai.live.connect(token)`.
- Uplink 16 kHz PCM16 mono base64, about 85 ms blocks (AudioWorklet). Downlink 24 kHz PCM16, played back to back with about 30 ms of lead time.
- On `serverContent.interrupted`, stop all queued audio right away (this is barge-in).
- `goAway`, a session resumption handle, and renewing the token before it expires.
- Shut the mic down on end, when the page is hidden, and when the user leaves.

**Drop:** credits and billing ticks, the lesson iframe and `[screen]` context, the character glow, and the rules for kids' plans.

**Swap:** replace `buildTutorInstruction` with a reference-persona instruction (identity, style, candidate facts, target role, boundaries, channel). Email and voice both build their prompt from that one function.

**Check first:** the model id (`gemini-3.8-live`) and the voice names. Confirm they still work with our API key before building on them.

## Phone number (for whoever is on it)

The browser path doesn't carry over directly. A phone call needs a **server-side bridge**:

```
caller ⇄ phone provider (e.g. Twilio Media Streams, WebSocket) ⇄ our bridge on Render ⇄ Gemini Live
```

- Twilio Media Streams send **8 kHz μ-law** audio, base64 in `media` events. Gemini wants **16 kHz PCM16** in and sends **24 kHz PCM16** back. The bridge has to convert both ways: μ-law decode → upsample to 16k, and 24k → downsample to 8k → μ-law encode.
- Use a bidirectional stream (`<Connect><Stream url="wss://...">` in TwiML). Send audio back as `{event:"media", streamSid, media:{payload}}`.
- When Gemini sends `interrupted`, send Twilio a `{event:"clear", streamSid}` so the caller stops hearing the old reply.
- The bridge runs on the server, so it can use the real API key with the same persona instruction; no ephemeral token needed.
- It needs to be a long-running Render **web service** that supports WebSockets. Free instances spin down and the first call hits a cold start, so warm it up before the demo or use a paid instance.
- Demo setup: one shared number, inbound calls only, and the bridge answers as whichever reference is marked active.
- Time box: about 45 minutes after the MVP is stable. If it isn't working by then, demo the browser voice instead.

## Email (Agentboxd)

The webhook comes in → skip duplicate message ids → match the recipient address to a profile → build the same persona prompt → reply in the same thread and sign it as an AI simulation. Ignore auto-replies, bounces and messages from the agent itself so it can't get into a reply loop. Check what the Agentboxd API supports before designing more around it.

## Open questions

- Who owns what? Phone = friend. Third teammate = ?
- Stack: Next.js on Render (GPT plan), or something else?
- Do we have API keys yet (Gemini, Twilio or another phone provider, Agentboxd)?
