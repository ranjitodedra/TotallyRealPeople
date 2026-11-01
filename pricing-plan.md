# Trust Me Bro: pricing plan

What it costs us to run each part of the app, what a month looks like at 100 and 1,000 users, and what we could charge.
Prices were looked up on 2026-11-01. All amounts are USD.

**Short version**

- Text is cheap: building a reference costs about **3¢**, a chat answer or email reply about **1¢**.
- Voice is the main cost. Gemini Live re-bills the whole conversation every turn, so a voice minute costs **4–9¢**, and long calls cost more per minute than short ones. Cap call length.
- A phone line adds about **1.3¢/min** (Twilio) plus **$1.15/month** per number.
- Proposed: **Free** (1 reference, 5 voice minutes), **Pro $15/month** (60 voice minutes), and **minute packs / a phone add-on** for heavy voice users. Pro keeps a 48% margin even when a user maxes out every cap, and about 78% at typical use.

---

## 1. Prices used

| Service | Item | Price | Source |
|---|---|---|---|
| Gemini API | `gemini-3.8-flash` (our `GEMINI_TEXT_MODEL` default) | $0.75 / 1M input, $3.75 / 1M output **until 2026-12-31**; **$1.50 / $7.50 from 2027-01-01** | [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), page dated 2026-10-30 |
| Gemini API | `gemini-3.8-live` (our `GEMINI_LIVE_MODEL` default) | Audio in $3.00 / 1M tokens (≈ $0.005/min); audio out $12.00 / 1M (≈ $0.018/min); text in $0.75 / 1M; text out $4.50 / 1M | same |
| Gemini API | Live billing rule | "During each turn, the API bills for all context tokens", meaning the history and the system instruction; audio ≈ 25 tokens/s; silence is billed | [Live API best practices (Google Cloud)](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/best-practices), [forum: silence billed](https://discuss.ai.google.dev/t/live-api-pricing-audio-tokens-second-silent-audio/92653) |
| Twilio | US local number | $1.15 / month | [Twilio US voice pricing](https://www.twilio.com/en-us/voice/pricing/us), listed as of Aug 2026 |
| Twilio | Inbound local / toll-free | $0.0085 / $0.0220 per min | same |
| Twilio | Media Streams (needed for the Gemini bridge) | $0.0044 / min | same |
| Render | Workspace | Hobby $0; Pro $25/month flat (since 2026-04-23) | [Render changelog: updated workspace plans](https://render-www.onrender.com/changelog/updated-plans-for-render-workspaces) |
| Render | Web service | Starter $7/month (0.5 CPU, 512 MB); Standard $25/month (1 CPU, 2 GB) | third-party summaries, e.g. [Render pricing 2026 (temps.sh)](https://temps.sh/blog/render-pricing-2026). The official page didn't render; Render says compute prices didn't change in April 2026 |
| Render | Workflows (`flex` compute) | $0.20/CPU-hour + $0.05/GB-hour, billed per second, max $0.40/hour; task state $0.25/GB-month | [Render Workflows limits & pricing](https://render.com/docs/workflows-limits) |
| Render | Bandwidth overage | $0.15 / GB | Render changelog above |
| Agentboxd | Inboxes + email | **Free during public beta** (10 inboxes, 3,000 emails/month). Planned: Builder $15/month (100 inboxes, 25k emails), Team $60/month (1,000 inboxes, 150k emails), +100 inboxes $3/month, extra emails $1 per 1,000 | [Agentboxd pricing](https://agentboxd.com/pricing) |
| Stripe (assumed) | Card fees | 2.9% + $0.30 per charge | standard US rate, not checked here |

**Model ids exist.** `gemini-3.8-flash` and `gemini-3.8-live` are both on Google's pricing page, so no stand-ins were needed.

**The Gemini Flash price doubles on 2027-01-01.** Every cost below uses the **2027 price**, since that's what we'd pay once real users arrive. Until the end of 2026, text costs are half of what's shown.

---

## 2. Cost per action

Token counts are estimates from the prompts in the code (about 4 characters per token):

| Action | Code path | Input tokens | Output tokens* | Cost (2027) | Cost (now) |
|---|---|---|---|---|---|
| **Build a reference**: extraction | `web/src/lib/extract.ts`: ~300-token system prompt + JSON schema + résumé (~1.5k tokens typical, capped at 20k chars ≈ 5k) + JD (~1.2k, capped at 12k chars ≈ 3k) | 3,300 (max ~9,000) | 2,000 | $0.020 | $0.010 |
| **Build a reference**: question bank | `web/src/lib/qa.ts`: system prompt + profile JSON | 1,500 | 1,200 (8–10 Q&As) | $0.011 | $0.006 |
| **Build total** | 2 calls | | | **$0.031** | $0.016 |
| **Generate Larp** | `web/src/lib/larp.ts`: `larp.md` "Generator" section (not read, **assumed ~800 tokens**) + profile + existing larps (≤12) + open answers | 3,300 | 1,900 (3 stories + rewritten answers) | **$0.019** | $0.010 |
| **Chat answer** | `answer.ts` → `generateText`: full reference prompt from `instruction.ts` (**~4,000 tokens**, see below) + history (≤30 turns, avg ~500 tokens) | 4,500 | 420 | **$0.010** | $0.005 |
| **Email reply** | `email-reply.ts`: same reference prompt + the email (≤8,000 chars) | 4,300 | 550 | $0.011 | $0.005 |
| ↳ Render Workflow run | `workflows.ts` `answerEmail`, ~10 s on `flex` (mostly waiting on Gemini) | | | ≤ $0.001 | ≤ $0.001 |
| ↳ Agentboxd | 2 emails (in + reply) | | | $0.002 at the planned overage rate; $0 in beta / within plan | |
| **Email total** | | | | **$0.014** | $0.008 |

\* Output includes ~300–800 tokens of model "thinking" per call, which Gemini bills as output. With thinking off, text costs drop by about a third.

**Reference prompt size (`buildReferenceInstruction`).** Fixed sections in `instruction.ts` come to ~650 tokens. The manager persona from `manager.ts` (style, examples, question guide) is ~1,200. Candidate facts ~800, target role + connections + unknowns ~250, the candidate's 10–12 answers ~850, and 0–12 larps ~0–1,200. That adds up to **~3,800–5,000 tokens**; the tables use 4,000.

### Voice (browser, Gemini Live)

`voice/route.ts` mints a token with the same ~4,000-token prompt and opens an audio session straight from the browser to Google, so the audio never touches Render. Cost has three parts:

1. **New audio**: mic in at $0.005/min for the whole call (silence counts), and model speech out at $0.018/min (assume the model talks ~50% of the time).
2. **System prompt re-billed every turn**: 4,000 text tokens × $0.75/1M ≈ $0.003 per turn.
3. **Audio history re-billed every turn**: everything said so far (~25 tokens/s, both sides) is billed again as audio input on each turn. This grows with the square of call length.

Assuming ~2 turns per minute:

| Call length | Parts 1+2 only | With history re-billing (budget this) | Per minute |
|---|---|---|---|
| 3 min | $0.06 | **$0.12** | $0.040 |
| 5 min | $0.10 | **$0.27** | $0.054 |
| 8 min | $0.16 | **$0.59** | $0.074 |
| 10 min | $0.20 | **$0.88** | $0.088 |
| 15 min | $0.30 | **$1.82** | $0.121 |

**Not verified:** how much of the history gets re-billed. If the history is kept as text transcripts, or partly cached, a call costs closer to the "Parts 1+2" column. Before we fix prices, run one real 5-minute call and read `usageMetadata` from the Live session. Until then, budget with the higher column.

**Ways to keep voice cheap**
- Cap calls at **8 minutes**; the token from `voice/route.ts` already expires after 30.
- Set `contextWindowCompression.triggerTokens` to ~8k–10k so the history stops growing (it's already on with `slidingWindow: {}`, but the default trigger is far higher).
- Stop sending mic audio while nobody is talking, if the Live config allows it, since silence is billed.

### Phone calls (planned Twilio bridge, `NOTES.md`)

| Item | Cost |
|---|---|
| Gemini Live (same as voice, 8-minute call) | $0.074/min |
| Twilio inbound local + Media Streams | $0.0085 + $0.0044 = $0.0129/min |
| **Phone minute total** | **≈ $0.087/min** (toll-free: ≈ $0.10/min) |
| Phone number | $1.15/month each (local) |
| Bridge bandwidth (Render → Twilio 64 kbps + Render → Gemini 256 kbps) | ~2.4 MB/min → $0.0004/min at overage; negligible |
| Bridge host | A Render web service that stays on with WebSockets: Starter $7 for a demo, Standard $25 for real traffic. A Free instance spins down and the first caller hits a cold start |

**One number or one per reference?** A **shared number** with a reference code ("enter the 6-digit code") costs $1.15/month in total. A **dedicated number per reference** costs $1.15 each, which is fine as a paid add-on but not for free users.

### Fixed infrastructure

| | 100 users | 1,000 users |
|---|---|---|
| Render workspace | Hobby $0 | Pro $25 |
| Web app (`web/`) | Starter $7 | Standard $25 |
| Persistent disk for `DATA_DIR` (file store) | 1 GB ≈ $0.25 (assumed $0.25/GB-month) | 5 GB ≈ $1.25 |
| Phone bridge service | ($0 until built) | Standard $25 |
| Agentboxd (1 inbox per reference) | Builder $15 (free during beta) | Team $60 + 1 add-on $3 (~1,500 inboxes) |
| Shared Twilio number | $1.15 | $1.15 |
| **Fixed total** | **≈ $23/month** | **≈ $141/month** |

Moving the file store to Render Postgres would add ~$6–20/month at 1,000 users. That's not included.

---

## 3. Proposed plans

| | **Free** | **Pro, $15/month** | **Minute pack** | **Phone add-on** |
|---|---|---|---|---|
| References | 1 active | 3 active | | |
| Rebuilds | 1 per month | 5 per month | | |
| Generate Larp | 3 per month | 10 per month | | |
| Chat answers (hiring managers + owner testing) | 20 per month | 100 per month | | |
| Email replies | 10 per month | 100 per month | | |
| Voice minutes (browser) | **5 per month, 5 min per call** | **60 per month, 8 min per call** | +60 min for **$12** (voice or phone) | |
| Phone | Shared number + code only, counts against voice minutes | Shared number + code | | **$8/month**: dedicated number + 30 phone minutes |
| Our cost at full use | $0.69 | $7.09 | $4.44 voice / $5.21 phone | $3.76 |
| Our cost at typical use† | $0.28 | $2.56 | | |
| **Margin** (after Stripe) | n/a (acquisition cost) | **48% at full use, 78% typical** | **58% voice / 51% phone** | **46%** at full use |

† Typical = Free: 1 build, 1 larp, 8 chats, 2 emails, 3 voice minutes. Pro: 2 builds, 4 larps, 30 chats, 20 emails, 25 voice minutes. These are guesses; replace them with real usage after launch.

**Why this shape**
- **Voice is the only thing to meter.** Text actions cost about 1¢ each, so Pro caps on chat and email mostly stop abuse. They can be generous.
- **A short per-call cap on Free.** Because of re-billing, 5 one-minute calls cost much less than 1 five-minute call. A 5-minute cap keeps a free user under ~$0.70/month in the worst case.
- **The 8-minute cap on Pro** keeps a voice minute around 7¢. Selling extra minutes at $0.20/min ($12 per 60) stays above 50% margin even over the phone.
- **Pricing per reference instead (optional):** a one-time **$9 "Job hunt pass"** (1 reference, 30 days, 30 voice minutes) costs us ≤ $2.65 at full use (with Free-level text caps), a ~64% margin after Stripe. It fits job seekers who don't want a subscription.
- **Who pays?** The candidate, not the hiring manager. Callers never sign in, so all voice, chat and email usage counts against the reference owner's plan. When a cap is hit, the reference should say plainly that it can't take more calls this month and fall back to email.

---

## 4. Monthly scenarios

Assumes 85% Free and 15% Pro, 2027 Gemini prices, and the fixed costs from section 2.

| | 100 users, typical use | 100 users, all at cap | 1,000 users, typical use | 1,000 users, all at cap |
|---|---|---|---|---|
| Free users (85% / 850) | $24 | $59 | $238 | $587 |
| Pro users (15 / 150) | $38 | $106 | $384 | $1,064 |
| Fixed infrastructure | $23 | $23 | $141 | $141 |
| Stripe fees | $11 | $11 | $110 | $110 |
| **Total cost** | **$96** | **$200** | **$872** | **$1,903** |
| Revenue (Pro × $15) | $225 | $225 | $2,250 | $2,250 |
| **Profit** | **+$129** | **+$25** | **+$1,378** | **+$347** |

Even if every user maxes out every cap, we still don't lose money, with 15% of users paying. At **typical use the break-even is about 4% paying** (each Pro user nets ~$11.70, each free user costs ~$0.28). Until 2026-12-31, the Gemini text costs above are half.

Add-ons aren't in these totals; every add-on sold adds 46–58% margin. Add ~$1.15/month per phone add-on number.

---

## 5. Assumptions and open questions

1. **Token counts are estimates** from prompt and code length, not measured. Log `usageMetadata` from `generateContent` and Live sessions for a week and update section 2.
2. **The `larp.md` Generator prompt wasn't read** (no access); it's assumed to be ~800 tokens. If it's 2,000, a larp costs ~$0.021 instead of $0.019.
3. **Re-billing Live audio history is the biggest unknown.** Officially, the full context is billed each turn; that the history is raw audio and silence counts comes from forum posts. The real voice cost could be up to ~3× lower than budgeted.
4. **Thinking tokens:** ~300–800 per call assumed. Setting `thinkingConfig: { thinkingBudget: 0 }` on extraction and the question bank would cut costs.
5. **Gemini's free tier is out.** It uses submitted content to improve Google's products, and these are résumés. Use the paid tier from day one.
6. **Agentboxd paid plans are "planned"** with no date. Today everything is free, but the beta's 10-inbox / 3,000-email limit is hit at about 10 references.
7. **Render web service prices** come from third-party summaries, because the official pricing page didn't render. Workflows and workspace prices are from Render's own pages.
8. **Stripe fees** are assumed at the standard 2.9% + $0.30; Stripe pricing wasn't checked.
9. **No support, storage growth or chargeback costs** are included.
10. **Usage mix (85/15, typical-use numbers) is a guess** for planning only.
