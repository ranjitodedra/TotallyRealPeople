import { Persona } from './schemas.js';

const realOrgPattern = /\b(google|alphabet|microsoft|amazon|apple|meta|facebook|openai|anthropic|stanford|harvard|mit|yale|princeton|berkeley|university of [a-z ]+)\b/i;
const assistantPattern = /\b(certainly|as an ai|i'm happy to|i am happy to|here's a|let me know if you need anything else)\b/i;

export function lintReply(text: string, prompt = '', persona?: Persona, contactPhone = ''): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!/^Hello(?: [^,\n]+)?,\n\n/.test(text)) issues.push('missing_greeting');
  const signature = persona ? [persona.displayName, persona.roleTitle, contactPhone].filter(Boolean).join('\n') : '';
  if (signature ? !text.trim().endsWith(`\n\n${signature}`) : !/^.+$/m.test(text.trim().split('\n').at(-1) ?? '')) issues.push('missing_signature');
  if (/AI[- ]generated|AI reference simulation|Fictional AI persona/i.test(text)) issues.push('demo_disclosure_in_body');
  if (sentences.length < 3 || sentences.length > 8) issues.push('sentence_count');
  if (/```|^\s*(?:[-*#>]\s|\d+[.)]\s)|\[[^\]]+\]\([^)]+\)/m.test(text)) issues.push('markdown');
  if (assistantPattern.test(text)) issues.push('assistant_ism');
  if (realOrgPattern.test(text)) issues.push('real_org');
  const secretCandidates = [process.env.AGENTBOXD_API_KEY, process.env.ANTHROPIC_API_KEY].filter((value): value is string => Boolean(value && value.length >= 8));
  if (secretCandidates.some((secret) => text.includes(secret))) issues.push('secret');
  const promptText = prompt.trim();
  if (promptText.length > 20 && text.toLowerCase().includes(promptText.toLowerCase())) issues.push('prompt_text');
  return { ok: issues.length === 0, issues };
}

