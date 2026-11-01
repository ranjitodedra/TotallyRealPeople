import { PHONE_DISCLOSURE } from "@/lib/instruction";
import { resolveModel } from "@/lib/models";
import { phoneReference, publicUrl, readTwilioForm, streamToken, twiml, xml } from "@/lib/twilio";

// Twilio "A call comes in" webhook for the shared number. Hands the call straight to the media-stream
// bridge in src/server.ts, whose first spoken line is the AI disclosure ("## Phone" in prompts/referencev2.md).
// The robotic <Say> disclosure is kept only for calls that can't reach the reference.
export async function POST(req: Request) {
  const params = await readTwilioForm(req);
  if (!params) return twiml("<Reject/>", 403);

  const say = (text: string) => `<Say>${xml(text)}</Say>`;
  const p = await phoneReference();
  if (!p) return twiml(say(PHONE_DISCLOSURE) + say("No reference is set up on this number yet. Goodbye.") + "<Hangup/>");
  // Gemini or Grok, whichever the reference's Voice choice is (or the other one if that key is missing).
  if (!resolveModel(p, "voice").using) {
    return twiml(say(PHONE_DISCLOSURE) + say("Phone calls need a Gemini or Grok key on the server. Goodbye.") + "<Hangup/>");
  }

  const stream = new URL("/twiml/media", publicUrl(req));
  stream.protocol = stream.protocol === "http:" ? "ws:" : "wss:";
  return twiml(
    `<Connect><Stream url="${xml(stream.toString())}"><Parameter name="token" value="${xml(streamToken(p.id))}"/></Stream></Connect>`,
  );
}
