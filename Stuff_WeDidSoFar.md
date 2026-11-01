# Stuff we did so far

Checklist of everything built for Trust Me Bro, and what is still open.
Last updated: 2026-11-01.

Legend: `[x]` done, `[~]` built but not tested with real keys, `[ ]` not started.

## Planning

- [x] Agreed on the scope: resume + job description + manager template becomes an AI reference with email and voice
- [x] Build order: MVP without phone, then phone number, then ElevenLabs voices
- [x] Wrote `NOTES.md` (team gist: voice plan reuse, phone bridge notes, email flow)
- [x] Picked the stack: Next.js app in `web/`, deployed to Render, Gemini for text and voice
- [x] Decided the flow: pick a manager template, build from the resume, then tune facts on the reference desk
- [x] Every reference says it is an AI simulation (badge, first spoken line, email signature)

## Project setup

- [x] Cloned the repo and created the Next.js app in `web/`
- [x] Installed `@google/genai`, `unpdf` (PDF text), `zod`, `lucide-react` (icons)
- [x] `web/.env.example` lists every key; `.env.local` and `.data/` are git-ignored
- [x] Fake mode: the whole app runs with no API keys (rule-based parser, canned answers)

## Screen 1: Create (`/`)

- [x] Step 1, Resume: paste text or upload a PDF (text is extracted and editable), plus "Use sample"
- [x] Step 2, Job: textarea plus an "Or use a template" dropdown
- [x] Job templates: Scotiabank (Full Stack Engineer) and Stripe (Software Engineer Intern)
- [x] (i) button on each template opens the full posting in a centered popup with "Use this job"
- [x] Step 3, Manager template: The Technical Manager (Dana Okafor), the only manager for the demo; all of it is in `web/src/lib/manager.ts`
- [x] "Build my reference" button with loading state and error messages

## Screen 2: Reference desk (`/r/<id>`)

- [x] Manager card: avatar, name, title, company, "AI simulation" badge, availability line
- [x] Email address with copy button
- [~] "Call Dana" voice call: live captions, mute, end, interrupt, reconnect
- [x] "Or ask in text" chat with the reference
- [x] "What this reference knows" panel: roles, skills, target role, why they fit, can't verify
- [x] Edit mode for the facts (only the creator's browser can edit, using an edit key)
- [x] Email panel with thread list and "Send a test email (demo)"
- [~] "Generate Larp" at the top of Tune answers: 3 made-up situations that fit the target company, plus blank answers filled in and existing ones adjusted (prompts in `web/prompts/larp.md`; tested in fake mode only). Turned off for now with `LARP_ENABLED` in `web/src/lib/features.ts`

## Server and AI

- [x] One shared prompt builder for voice, email and chat (`web/src/lib/instruction.ts`)
- [~] Resume and job extraction with Gemini (`gemini-3.8-flash`), checked against a schema
- [~] Voice token route: single-use Gemini Live token with model, voice and prompt locked in
- [x] Model choice: Gemini or Grok (xAI) for Text (chat, email, SMS) and Voice (browser call, phone), set separately (`web/src/lib/models.ts`)
  - Defaults: Text = Grok, Voice = Grok; change with `TEXT_PROVIDER` / `VOICE_PROVIDER`, or per reference on the "AI models" card (creator only)
  - Missing key: the other provider answers and the card says why; no keys at all = fake text, no voice
  - Both use the same `buildReferenceInstruction` prompt. Grok text = `grok-4.20-0309-non-reasoning` (~1 s; `grok-4.7` took ~12 s)
  - Grok voice in the browser: ephemeral `xai-realtime…` token from `/api/references/[id]/voice`, socket in `web/src/lib/grok-live.ts`. The prompt goes to the browser as `session.update` because xAI tokens can't lock it (Gemini's can)
  - Grok on the phone: the bridge sends Twilio's μ-law straight to Grok (no conversion)
  - Tested with real keys: text on both, Grok greeting from the browser page (audio + transcript), simulated Twilio call on Grok, all fallbacks. Not tested: a spoken call with a real mic, a real phone call, switching on the card as the creator
- [x] Profiles saved to a JSON file (`web/.data/`), raw resume never sent to the browser
- [~] Agentboxd: one inbox per reference, created at build time
- [~] Agentboxd webhook: signature check, duplicate skip, auto-reply loop guard, reply in thread
- [~] Twilio phone number, one number for calls and texts, answered by `PHONE_REFERENCE_ID` or the newest reference
  - Calls: `/twiml/voice` says the AI disclosure, then a Media Stream to `/twiml/media` bridges to Gemini Live (`web/src/server.ts`, `web/src/phone/`). Bridge tested with a real Gemini key and a simulated Twilio stream; not yet with a real call
  - Texts: `/twiml/sms` answers with the shared prompt builder, keeps a short per-number history, first reply starts with the AI disclosure
  - Both webhooks check `X-Twilio-Signature`; new channels `phone` and `sms` in `instruction.ts` with their rules in code
  - Run with `npm run dev:phone` + `ngrok http 3000`; setup in `README.md`, deploy in `web/RENDER.md`

## Look and feel

- [x] Bright style: white page, Rubik font, soft thick borders, blue and green buttons
- [x] Removed the onboarding gimmicks (mascot chat bubbles, progress bar, rotating loading lines)
- [x] Icons across both screens

## Git

- [x] Branch `web-mvp` pushed
- [x] `main` updated with a normal fast-forward push (no force push)

## Still to do

- [ ] Get a Gemini API key and test voice and text end to end
- [ ] Deploy `web/` to Render (needed for the Agentboxd webhook and the judges' link)
- [ ] Get an Agentboxd key, register the webhook, send one real email
- [ ] Phone number: set Twilio env vars and console webhooks, then make one real call and send one real text
- [ ] More manager templates
- [ ] Extra voices, then ElevenLabs
- [ ] Rehearse the demo and record a fallback video
- [ ] "My references" (`/references`, header link) is a showcase placeholder: it lists the references this browser made (from `trp-edit-*` keys) and sample cards; Duplicate, Archive, Set as phone line and Google/GitHub sign-in are disabled until we add accounts (OAuth)

## Agentboxd email service

- [x] Added the root Fastify service for Agentboxd inboxes, email sessions, polling, and live status updates.
- [x] Connected the existing Next.js interface to the service through the RefBot panel.
- [x] Added the manager phone field for a formatted reply signature.
- [~] Run the email loop end to end with configured Agentboxd and model keys.
