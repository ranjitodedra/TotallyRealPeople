<<<<<<< HEAD
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
- [x] Step 3, Manager template: The Technical Manager (Dana Okafor)
- [x] "Build my reference" button with loading state and error messages

## Screen 2: Reference desk (`/r/<id>`)

- [x] Manager card: avatar, name, title, company, "AI simulation" badge, availability line
- [x] Email address with copy button
- [~] "Call Dana" voice call: live captions, mute, end, interrupt, reconnect
- [x] "Or ask in text" chat with the reference
- [x] "What this reference knows" panel: roles, skills, target role, why they fit, can't verify
- [x] Edit mode for the facts (only the creator's browser can edit, using an edit key)
- [x] Email panel with thread list and "Send a test email (demo)"

## Server and AI

- [x] One shared prompt builder for voice, email and chat (`web/src/lib/instruction.ts`)
- [~] Resume and job extraction with Gemini (`gemini-3.8-flash`), checked against a schema
- [~] Voice token route: single-use Gemini Live token with model, voice and prompt locked in
- [x] Profiles saved to a JSON file (`web/.data/`), raw resume never sent to the browser
- [~] Agentboxd: one inbox per reference, created at build time
- [~] Agentboxd webhook: signature check, duplicate skip, auto-reply loop guard, reply in thread

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
- [ ] Phone number bridge (teammate is on it; see `NOTES.md`)
- [ ] More manager templates
- [ ] Extra voices, then ElevenLabs
- [ ] Rehearse the demo and record a fallback video
=======
# Done
- Implemented fictional persona generation with fixture fallback, guarded email replies, linting, and Agentboxd inbox/message wrappers.
- Added Fastify session endpoints, polling, SSE events, and a plain single-page client.
- Added `.env.example`; `.env` remains ignored.

# Next
- Add `ANTHROPIC_API_KEY` to `.env` to enable generated personas and replies; otherwise fixtures and templates are used.
- Start the server and run `npm run smoke` with an Agentboxd key that can create inboxes and send/read mail.

# Open questions
- The project directory has no Git metadata, so the requested commit cannot be created here.
>>>>>>> 2c325ed (Email loop via Agentboxd)
