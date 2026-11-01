import { answerAsReference } from "./answer";
import type { ReferenceProfile } from "./types";

// Shared by the web app (inline path) and the Render Workflow tasks.
// No storage imports here: workflow task runs can't read the web service's data file.

export interface InboundEmail {
  from: string;
  subject: string;
  text: string;
}

/** What a workflow task needs to answer an email. Leaves out raw documents and secrets. */
export type ReplyProfile = Omit<ReferenceProfile, "resumeText" | "jobDescriptionText" | "editKeyHash" | "messages">;

export function toReplyProfile(p: ReferenceProfile): ReplyProfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resumeText, jobDescriptionText, editKeyHash, messages, ...rest } = p;
  return rest;
}

/** Writes the reference's email reply with the one shared prompt. */
export function writeEmailReply(p: ReplyProfile, inbound: InboundEmail) {
  const full: ReferenceProfile = { ...p, resumeText: "", jobDescriptionText: "", messages: [] };
  const body = inbound.text.slice(0, 8000).replace(/<\/?incoming_email>/gi, "");
  return answerAsReference(full, "email", [
    {
      role: "user",
      text: `<incoming_email>\nFrom: ${inbound.from}\nSubject: ${inbound.subject}\n\n${body}\n</incoming_email>`,
    },
  ]);
}
