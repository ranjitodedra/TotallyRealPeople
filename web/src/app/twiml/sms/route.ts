import { answerAsReference, type Turn } from "@/lib/answer";
import { smsDisclosure } from "@/lib/instruction";
import { phoneReference, readTwilioForm, twiml, xml } from "@/lib/twilio";

// Twilio "A message comes in" webhook for the shared number. Replies in the same request with <Message>.
// Twilio itself handles STOP/HELP keywords.

// Short per-number history, in memory only. A conversation restarts (with the disclosure) after an idle hour.
type Thread = { turns: Turn[]; at: number };
const g = globalThis as unknown as { __trpSms?: Map<string, Thread> };
const threads = (g.__trpSms ??= new Map());
const IDLE_MS = 60 * 60 * 1000;
const MAX_TURNS = 12;

export async function POST(req: Request) {
  const params = await readTwilioForm(req);
  if (!params) return twiml("", 403);

  const p = await phoneReference();
  if (!p) return message("AI reference simulation: no reference is set up on this number yet.");

  const from = params.From ?? "";
  const body = (params.Body ?? "").trim().slice(0, 1000);
  const key = `${p.id}:${from}`;
  const now = Date.now();
  for (const [k, t] of threads) if (now - t.at > IDLE_MS) threads.delete(k);
  const thread = threads.get(key) ?? { turns: [], at: now };
  const isFirst = thread.turns.length === 0;

  let reply: string;
  if (!body) {
    reply = "I can only read text messages. What would you like to know?";
  } else {
    try {
      reply = await answerAsReference(p, "sms", [...thread.turns, { role: "user", text: body }]);
    } catch (e) {
      console.error("sms answer failed", e);
      reply = "Sorry, I couldn't answer that just now. Please try again in a minute.";
    }
    reply = reply.slice(0, 1200) || "Sorry, I don't have an answer for that.";
    thread.turns.push({ role: "user", text: body }, { role: "model", text: reply });
    thread.turns = thread.turns.slice(-MAX_TURNS);
    thread.at = now;
    threads.set(key, thread);
  }

  return message(isFirst ? `${smsDisclosure(p)}\n\n${reply}` : reply);
}

function message(text: string) {
  return twiml(`<Message>${xml(text)}</Message>`);
}
