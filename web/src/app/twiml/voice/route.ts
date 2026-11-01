import { hasGemini } from "@/lib/env";
import { PHONE_DISCLOSURE } from "@/lib/instruction";
import { phoneReference, publicUrl, readTwilioForm, streamToken, twiml, xml } from "@/lib/twilio";

// Twilio "A call comes in" webhook for the shared number.
// Says the AI disclosure, then hands the call to the media-stream bridge in src/server.ts.
export async function POST(req: Request) {
  const params = await readTwilioForm(req);
  if (!params) return twiml("<Reject/>", 403);

  const say = (text: string) => `<Say>${xml(text)}</Say>`;
  const p = await phoneReference();
  if (!p) return twiml(say(PHONE_DISCLOSURE) + say("No reference is set up on this number yet. Goodbye.") + "<Hangup/>");
  if (!hasGemini()) return twiml(say(PHONE_DISCLOSURE) + say("Phone calls need a Gemini key on the server. Goodbye.") + "<Hangup/>");

  const stream = new URL("/twiml/media", publicUrl(req));
  stream.protocol = stream.protocol === "http:" ? "ws:" : "wss:";
  return twiml(
    say(PHONE_DISCLOSURE) +
      `<Connect><Stream url="${xml(stream.toString())}"><Parameter name="token" value="${xml(streamToken(p.id))}"/></Stream></Connect>`,
  );
}
