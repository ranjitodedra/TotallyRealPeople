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

Without API keys the app runs in fake mode: a simple parser reads the resume and the reference gives canned answers. Voice calls need a Gemini key.

## Environment variables

Copy `web/.env.example` to `web/.env.local` and fill in what you have.

| Variable | Needed for |
| --- | --- |
| `GEMINI_API_KEY` | Resume extraction, text and email answers, voice calls |
| `AGENTBOXD_API_KEY` | Real email inboxes for each reference |
| `AGENTBOXD_WEBHOOK_SECRET` | Verifying incoming email webhooks |

Optional overrides: `GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_API_VERSION`.

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
4. Voice: the server creates a short-lived Gemini Live token with the prompt locked in, and the browser streams audio directly to Gemini.
5. Email: Agentboxd gives each reference an inbox and sends incoming mail to `/api/webhooks/email`, and the reference replies in the same thread.

## Sponsors

- Render: hosting for the app (and the phone bridge, if it ships)
- Agentboxd: email inboxes for the AI references
