export type Channel = "voice" | "email" | "chat";

export interface CandidateRole {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  achievements: string[];
}

export interface CandidateFacts {
  candidateName: string;
  headline?: string;
  roles: CandidateRole[];
  skills: string[];
  education: string[];
}

export interface TargetRole {
  title: string;
  company?: string;
  priorities: string[];
}

export interface EmailMessage {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  subject: string;
  text: string;
  at: string;
  /** Provider message id, used to skip duplicate webhook deliveries. */
  providerMessageId?: string;
  demo?: boolean;
  /** Render Workflows run that wrote and sent this reply, if any. */
  workflowRunId?: string;
}

/** A likely hiring-manager question with an answer the candidate wrote or approved. */
export interface QaItem {
  id: string;
  question: string;
  /** Empty means "not answered yet": the bot says it doesn't have that information. */
  answer: string;
  /** Fixed safety answers. Shown to the owner but never editable. */
  locked?: boolean;
}

/** The user's edits to the persona's style, layered on top of the template. */
export interface AgentCustom {
  tone?: string;
  focusAreas?: string[];
  habits?: string[];
}

export interface ReferenceProfile {
  id: string;
  createdAt: string;
  resumeText: string;
  jobDescriptionText: string;
  facts: CandidateFacts;
  targetRole: TargetRole;
  /** How documented experience connects to the target role. */
  relevance: string[];
  /** Things the reference can't speak to. */
  unknowns: string[];
  personaId: string;
  /** The fictional manager. `company` is the résumé employer the persona is framed around. */
  manager: { name: string; title: string; company: string };
  voice: string;
  /** User edits to the persona's tone, focus areas and habits. */
  agent?: AgentCustom;
  email?: { address: string; inboxId?: string; provider: "agentboxd" | "demo" };
  messages: EmailMessage[];
  /** Tuned answers from the "Tune answers" menu. */
  qa?: QaItem[];
  /** True when facts came from the rule-based fallback instead of Gemini. */
  fakeExtraction?: boolean;
  /** sha256 of the owner edit key. Never sent to the browser. */
  editKeyHash?: string;
}

/** What the browser is allowed to see (no raw résumé/JD text; tuned answers only for the owner). */
export type PublicProfile = Omit<ReferenceProfile, "resumeText" | "jobDescriptionText" | "editKeyHash">;

export function toPublic(p: ReferenceProfile, owner = false): PublicProfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resumeText, jobDescriptionText, editKeyHash, qa, ...rest } = p;
  return owner ? { ...rest, qa } : rest;
}
