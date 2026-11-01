# Trust Me Bro (TotallyRealPeople)

Your reference is ready to take the call.

Upload a resume, add a job description, and pick a manager template. The app builds an AI reference that can answer questions about the candidate by voice, by email, and in text chat. Every reference clearly identifies itself as an AI simulation built from documents the candidate provided. It does not verify employment.

## Progress

See [Stuff_WeDidSoFar.md](Stuff_WeDidSoFar.md) for a checklist of what is done and what is left.

## Repository layout

| Path | What it is |
| --- | --- |
| `web/` | Next.js app: create screen, reference desk, API routes |
| `web/src/lib/manager.ts` | The one demo manager: tone, examples, sample answers |
| `web/prompts/larp.md` | Prompts for "Generate Larp" (edit freely) |
| `web/src/server.ts`, `web/src/phone/` | App + Twilio call bridge on one port; μ-law/PCM audio conversion |
| `web/src/app/twiml/` | Twilio voice and SMS webhooks |
| `web/prompts/reference.md` | How the reference answers: identity, boundaries, voice/chat/email rules (edit freely) |
| `NOTES.md` | Team notes: voice plan reuse, phone bridge, email flow |
| `voice-tutor-systems-plan.md` | Reference design for the Gemini Live voice loop |
| `Stuff_WeDidSoFar.md` | Progress checklist |

## Run it locally

Requires Node.js 20 or newer.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Use the "Use sample" button and a job template to try it quickly.

Without API keys the app runs in fake mode: a simple parser reads the resume and the reference gives canned answers. Voice calls need a Gemini or Grok key.

## Choosing Gemini or Grok

Text (chat, email replies, SMS) and Voice (the browser call and the phone line) can each run on Gemini or Grok (xAI). By default **both Text and Voice use Grok**; change the defaults with `TEXT_PROVIDER` and `VOICE_PROVIDER` (`gemini` or `grok`).

Each reference can switch on the reference desk: the **AI models** card, above "Call Dana". Only the reference's creator can change it. The choice lives in `web/src/lib/models.ts`. Both providers get the same prompt from `buildReferenceInstruction`, so facts and AI-disclosure rules are identical.

If the chosen provider has no key on the server, the other one answers and the card says why. With neither key, text falls back to fake mode and voice is unavailable. Résumé extraction always uses Gemini (fake parser without it).

## Phone number (Twilio: calls and texts)

One Twilio number answers as the active reference: `PHONE_REFERENCE_ID` if set, otherwise the newest reference.
Callers first hear "You've reached an AI reference simulation…", then the reference greets them as "the AI reference simulation of <manager>". The first text reply in each conversation starts with an `[AI reference simulation …]` line.

Phone calls need a WebSocket, which Next.js route handlers can't hold, so `web/src/server.ts` runs the app and the call bridge together on one port:

```bash
cd web
npm run dev:phone        # instead of npm run dev (stop that one first)
ngrok http 3000          # in a second terminal
```

Set these in `web/.env.local`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `PUBLIC_BASE_URL` (your ngrok https address, e.g. `https://easiest-tributary-rockfish.ngrok-free.dev`). Calls need the key for the reference's Voice provider (`GROK_API_KEY` by default, or `GEMINI_API_KEY`); texts work in fake mode.

In the Twilio console, open the number (Phone Numbers → Manage → Active numbers):

| Section | Setting | Value |
| --- | --- | --- |
| Voice Configuration | A call comes in | Webhook, `<PUBLIC_BASE_URL>/twiml/voice`, HTTP POST |
| Messaging Configuration | A message comes in | Webhook, `<PUBLIC_BASE_URL>/twiml/sms`, HTTP POST |

Every webhook is checked against `X-Twilio-Signature`, so `PUBLIC_BASE_URL` must match the address in the console exactly. The call bridge logs both sides of the conversation as `[phone] …` lines in the server terminal.

## Environment variables

Copy `web/.env.example` to `web/.env.local` and fill in what you have.

| Variable | Needed for |
| --- | --- |
| `GEMINI_API_KEY` | Resume extraction; text and voice when set to Gemini |
| `GROK_API_KEY` | Text and voice when set to Grok (xAI) |
| `TEXT_PROVIDER` | Default provider for chat, email and SMS: `grok` (default) or `gemini` |
| `VOICE_PROVIDER` | Default provider for browser and phone calls: `grok` (default) or `gemini` |
| `AGENTBOXD_API_KEY` | Real email inboxes for each reference |
| `AGENTBOXD_WEBHOOK_SECRET` | Verifying incoming email webhooks |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | The phone number (calls and texts) |
| `PUBLIC_BASE_URL` | The public https address Twilio calls (ngrok or Render) |
| `PHONE_REFERENCE_ID` | Optional: which reference answers the number (default: the newest) |

Optional overrides: `GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_API_VERSION`, `GROK_TEXT_MODEL` (default `grok-4.20-0309-non-reasoning`, about 1 s per answer; `grok-4.7` reasons but takes about 12 s), `GROK_VOICE_MODEL` (default `grok-voice-latest`), `GROK_VOICE` (default: the manager's `grokVoice`, `rex`).

## Changing the manager

There is one demo manager. Everything about them (name, tone, habits, example answers, sample answers to 30 likely questions) is in `web/src/lib/manager.ts`. Replace each `[PLACEHOLDER_GTEXT]` with a sample answer. The safety rules in `web/src/lib/instruction.ts` always win over that file.

## Changing the larp prompt

**Turned off for now.** Set `LARP_ENABLED` in `web/src/lib/features.ts` to `true` to bring it back.

"Generate Larp" (top of the Tune answers card) makes up situations that fit the target company, built from the résumé, and fills in and adjusts the tuned answers to match. The reference always tells these as imagined.

Its prompts are in **`web/prompts/larp.md`**, with two sections: `## Generator` (what the button asks Gemini to write) and `## Reference rules` (how the reference talks about larps). Edit the text under each heading, but keep the two headings exactly as they are. The app re-reads the file on every request, so no restart is needed.

## How it works

1. The resume and job description go to Gemini, which returns structured facts: roles, skills, target role priorities, how the experience fits, and what the reference cannot verify.
2. The facts are saved as a reference profile with a fictional manager persona.
3. One prompt builder (`web/src/lib/instruction.ts`) turns the profile into instructions for each channel (voice, email, chat), so every channel answers from the same facts.
4. Voice: the server creates a short-lived token and the browser streams audio directly to the model. For Gemini Live the prompt is locked into the token. For Grok (xAI realtime, `wss://api.x.ai/v1/realtime`) the token can't carry settings, so the server returns the prompt with the token and the browser sends it as `session.update` (`web/src/lib/grok-live.ts`). The API key never reaches the browser either way.
5. Email: Agentboxd gives each reference an inbox and sends incoming mail to `/api/webhooks/email`, and the reference replies in the same thread.
6. Phone: Twilio posts calls to `/twiml/voice`, which says the AI disclosure and opens a Media Stream to `/twiml/media`. The bridge (`web/src/phone/`) converts 8 kHz μ-law to 16 kHz PCM for Gemini Live and 24 kHz PCM back to μ-law; Grok takes and returns μ-law directly, so its audio passes straight through. Either way it clears Twilio's audio when the caller interrupts. Texts go to `/twiml/sms` and are answered with the same prompt builder (channels `phone` and `sms`).

## Sponsors

- Render: hosting for the app (and the phone bridge: same web service, see `web/RENDER.md`)
- Agentboxd: email inboxes for the AI references
