# Deploying to Render

Two services from this repo, both with **Root Directory** `web`.

## 1. Web service (the app)

Dashboard → **New → Web Service** → this repo.

| Setting | Value |
| --- | --- |
| Root Directory | `web` |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start:phone` (app + Twilio call bridge; plain `npm start` works if you don't use the phone number) |

Environment variables:

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | your Gemini key |
| `AGENTBOXD_API_KEY` | your Agentboxd key |
| `AGENTBOXD_WEBHOOK_SECRET` | from registering the webhook (step 3) |
| `RENDER_API_KEY` | Account Settings → API Keys (lets the app start workflow runs) |
| `RENDER_WORKFLOW_SLUG` | the workflow's slug from step 2, e.g. `trust-me-bro-workflows` |

| `TWILIO_ACCOUNT_SID` | Twilio console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio console → Account Info (used to check webhook signatures) |
| `TWILIO_PHONE_NUMBER` | the number, e.g. `+15551234567` |
| `PUBLIC_BASE_URL` | `https://<web-service>.onrender.com` (must match the Twilio webhook URLs exactly) |
| `PHONE_REFERENCE_ID` | optional: which reference answers the number (default: the newest) |

Leave `RENDER_API_KEY` / `RENDER_WORKFLOW_SLUG` unset and email replies run inline instead.

### Phone number on Render

`npm run start:phone` runs `src/server.ts`: the Next app plus a WebSocket at `/twiml/media` for Twilio Media Streams, on Render's `PORT`.
The bridge reads references from the same `.data` file as the app, which is why it is part of the web service and not a separate one.
Then in the Twilio console, on the number: **A call comes in** → `https://<web-service>.onrender.com/twiml/voice` (POST), **A message comes in** → `https://<web-service>.onrender.com/twiml/sms` (POST).
Free instances sleep and the first call can time out: open the app a minute before calling, or use a paid instance for the demo.

## 2. Workflow service (email replies)

Dashboard → **New → Workflow** → this repo.

| Setting | Value |
| --- | --- |
| Root Directory | `web` |
| Language | Node |
| Build Command | `npm ci` |
| Start Command | `npm run workflows` |

Environment variables: `GEMINI_API_KEY`, `AGENTBOXD_API_KEY` (same values as the web service).

After the deploy, the **Tasks** page should list `answerEmail`, `draftReply` and `sendReply`.
The task slug is `<workflow-slug>/answerEmail`; put the `<workflow-slug>` part in `RENDER_WORKFLOW_SLUG` on the web service.

Test it end to end: send a test email from a reference page. The reply shows a
"via Render Workflow" tag, and the run appears under the workflow's **Runs** page.
(Starting a task by hand from the dashboard isn't practical, since it needs a whole profile as input.)

### What runs where

```
Agentboxd webhook → web service: record the email, respond 200 right away
                    └─ after the response: start answerEmail on Render Workflows
answerEmail
  ├─ draftReply   Gemini writes the reply (3 retries, backoff)
  └─ sendReply    Agentboxd sends it (5 retries; idempotent per message, so no double-sends)
web service: save the reply (tagged with the run id)
```

The task gets the reference profile without the raw résumé, job description, edit key or message history.

## 3. Agentboxd webhook

```
POST https://api.agentboxd.com/v1/webhooks
{ "url": "https://<web-service>.onrender.com/api/webhooks/email", "events": ["message.received"], "payload": "envelope" }
```

Put the returned secret in `AGENTBOXD_WEBHOOK_SECRET` on the web service.

## Notes

- Data is a JSON file on the web service's disk. Free instances reset it on every deploy; fine for the demo.
- Free web instances sleep. Open the app a minute before demoing.
