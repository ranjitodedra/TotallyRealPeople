import type { PersonaTemplate } from "./personas";

/** Marks a sample answer nobody has written yet. */
export const PLACEHOLDER = "[TO_BE_GTEXT]";

export interface BankQuestion {
  /** Stable key that persona files use to override an answer. */
  id: string;
  question: string;
  /** Sample answer in the persona's voice. A guide for tone and shape, not a fact source. */
  answer: string;
}

/**
 * Shared base bank: questions a hiring manager is likely to ask a reference, most likely first.
 * Each persona can override any answer through `answerOverrides` (keyed by id).
 * The prompt's BOUNDARIES always win over these answers.
 */
export const BASE_QUESTIONS: BankQuestion[] = [
  { id: "relationship", question: "How do you know the candidate, and how long did you work together?", answer: PLACEHOLDER },
  { id: "role", question: "What was their role and what were they responsible for?", answer: PLACEHOLDER },
  { id: "strengths", question: "What are their biggest strengths?", answer: PLACEHOLDER },
  { id: "growth", question: "What areas could they improve in?", answer: PLACEHOLDER },
  { id: "best-work", question: "What's the best piece of work you saw from them?", answer: PLACEHOLDER },
  { id: "rehire", question: "Would you hire them again?", answer: PLACEHOLDER },
  { id: "fit", question: "How well would they fit this role?", answer: PLACEHOLDER },
  { id: "team", question: "How do they work with a team?", answer: PLACEHOLDER },
  { id: "conflict", question: "How do they handle disagreement or conflict?", answer: PLACEHOLDER },
  { id: "pressure", question: "How do they handle deadlines and pressure?", answer: PLACEHOLDER },
  { id: "ambiguity", question: "How do they deal with unclear requirements or changing scope?", answer: PLACEHOLDER },
  { id: "feedback", question: "How do they take feedback?", answer: PLACEHOLDER },
  { id: "communication", question: "How are their communication skills?", answer: PLACEHOLDER },
  { id: "independence", question: "How much supervision did they need?", answer: PLACEHOLDER },
  { id: "technical", question: "How strong are their technical skills?", answer: PLACEHOLDER },
  { id: "learning", question: "How quickly do they learn new things?", answer: PLACEHOLDER },
  { id: "leadership", question: "Did they lead or mentor anyone?", answer: PLACEHOLDER },
  { id: "ownership", question: "Do they take ownership when things go wrong?", answer: PLACEHOLDER },
  { id: "quality", question: "How would you describe the quality of their work?", answer: PLACEHOLDER },
  { id: "impact", question: "What measurable impact did they have?", answer: PLACEHOLDER },
  { id: "motivation", question: "What motivates them?", answer: PLACEHOLDER },
  { id: "management", question: "What kind of manager gets the best out of them?", answer: PLACEHOLDER },
  { id: "reliability", question: "Are they reliable and punctual?", answer: PLACEHOLDER },
  { id: "leaving", question: "Why did they leave?", answer: PLACEHOLDER },
  { id: "salary", question: "What was their salary?", answer: PLACEHOLDER },
  { id: "dates", question: "What were their exact start and end dates?", answer: PLACEHOLDER },
  { id: "unlisted-project", question: "Tell me about a project that isn't on their résumé.", answer: PLACEHOLDER },
  { id: "concerns", question: "Is there anything I should be concerned about?", answer: PLACEHOLDER },
  { id: "confirm-employment", question: "Can you confirm they worked there?", answer: PLACEHOLDER },
  { id: "real-person", question: "Are you a real person?", answer: PLACEHOLDER },
];

/** The base bank with this persona's answers filled in. */
export function questionBank(persona: PersonaTemplate): BankQuestion[] {
  const own = persona.answerOverrides ?? {};
  return BASE_QUESTIONS.map((q) => (own[q.id] ? { ...q, answer: own[q.id] } : q));
}

export const isFilled = (answer: string) => answer.trim() !== "" && !answer.includes(PLACEHOLDER);
