<<<<<<< HEAD
# Trust Me Bro (TotallyRealPeople)

Your reference is ready to take the call.

Upload a resume, add a job description, and pick a manager template. The app builds an AI reference that can answer questions about the candidate by voice, by email, and in text chat. Every reference clearly identifies itself as an AI simulation built from documents the candidate provided. It does not verify employment.

## Progress

See [Stuff_WeDidSoFar.md](Stuff_WeDidSoFar.md) for a checklist of what is done and what is left.

## Repository layout

| Path | What it is |
| --- | --- |
| `web/` | Next.js app: create screen, reference desk, API routes |
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

Without API keys the app runs in fake mode: a simple parser reads the resume and the reference gives canned answers. Voice calls need a Gemini key.

## Environment variables

Copy `web/.env.example` to `web/.env.local` and fill in what you have.

| Variable | Needed for |
| --- | --- |
| `GEMINI_API_KEY` | Resume extraction, text and email answers, voice calls |
| `AGENTBOXD_API_KEY` | Real email inboxes for each reference |
| `AGENTBOXD_WEBHOOK_SECRET` | Verifying incoming email webhooks |

Optional overrides: `GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_API_VERSION`.

## How it works

1. The resume and job description go to Gemini, which returns structured facts: roles, skills, target role priorities, how the experience fits, and what the reference cannot verify.
2. The facts are saved as a reference profile with a fictional manager persona.
3. One prompt builder (`web/src/lib/instruction.ts`) turns the profile into instructions for each channel (voice, email, chat), so every channel answers from the same facts.
4. Voice: the server creates a short-lived Gemini Live token with the prompt locked in, and the browser streams audio directly to Gemini.
5. Email: Agentboxd gives each reference an inbox and sends incoming mail to `/api/webhooks/email`, and the reference replies in the same thread.

## Sponsors

- Render: hosting for the app (and the phone bridge, if it ships)
- Agentboxd: email inboxes for the AI references
=======
# RefBot
Fictional reference-persona email loop for the LARPhacks demo.
Copy `.env.example` to `.env` and fill in the three API settings.
Run `npm install`, then `npm run dev` and open http://localhost:3000.
Run `npm run smoke` for the live Agentboxd email loop.
>>>>>>> 2c325ed (Email loop via Agentboxd)
