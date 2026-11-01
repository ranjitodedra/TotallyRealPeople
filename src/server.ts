import 'dotenv/config';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { createInbox, listMessages, replyToThread } from './agentboxd.js';
import { generatePersona } from './persona.js';
import { lintReply } from './lint.js';
import { generateReply } from './reply.js';
import { Session } from './schemas.js';
import { z } from 'zod';

const app = Fastify({ logger: false });
const SESSION_DURATION_MS = 15 * 60_000;
type EventItem = { id: number; event: string; data: Record<string, unknown> };
type Runtime = {
  session: Session; events: EventItem[]; listeners: Set<(item: EventItem) => void>;
  seenMessages: Set<string>; seenThreads: Set<string>; pendingMessages: Set<string>; pendingThreads: Set<string>; announcedMessages: Set<string>; ownAddresses: Set<string>;
  startedAt: number; sendCount: number; timer?: NodeJS.Timeout; active: boolean; prompt: string;
  drafts: Map<string, { text: string; subject: string; messageId: string; recipient: string }>;
  referenceMaterial: { resumeText: string; jobDescriptionText: string; candidateName: string };
};
const sessions = new Map<string, Runtime>();
const blockedSender = /(?:^|[<\s"'])[^\s<>"']*(?:no[-_.]?reply|mailer[-_.]?daemon|bounce|postmaster)[^\s<>"']*(?:$|[>\s"'])/i;
const automaticSubject = /\b(auto(?:matic)?[- ]?reply|out of office|delivery status notification|undeliverable|failure notice)\b/i;

function emit(runtime: Runtime, event: string, data: Record<string, unknown> = {}) {
  const item: EventItem = { id: runtime.events.length + 1, event, data: { at: new Date().toISOString(), ...data } };
  runtime.events.push(item);
  runtime.session.messages.push({ event, ...item.data });
  for (const listener of runtime.listeners) listener(item);
}

function sendSse(reply: { raw: { write: (chunk: string) => void } }, item: EventItem) {
  reply.raw.write(`id: ${item.id}\nevent: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`);
}

function field(message: any, ...keys: string[]): string {
  for (const key of keys) if (typeof message?.[key] === 'string') return message[key];
  return '';
}

function candidateNameFromResume(resumeText: string): string {
  const lines = resumeText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
  const labeled = lines.find((line) => /^name\s*:/i.test(line))?.replace(/^name\s*:\s*/i, '');
  if (labeled) return labeled.split(/[·•|]/)[0]!.trim().slice(0, 120);
  const nameLine = lines.find((line) =>
    !/@|https?:\/\/|\d|\b(resume|curriculum vitae|experience|education|skills|professional summary|objective|phone|email)\b/i.test(line)
    && /^[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){1,3}$/u.test(line),
  );
  return nameLine?.slice(0, 120) ?? '';
}

function greetingForSender(from: string): string {
  const label = from.match(/^\s*([^<>]+?)\s*<[^>]+>\s*$/)?.[1]?.trim()
    ?? (from.trim() && !from.includes('@') ? from.trim() : '');
  if (!label || label.includes('@')) return 'Hello,';
  const clean = label.replace(/[\r\n,]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean ? `Hello ${clean},` : 'Hello,';
}

function candidateNameFromRequest(emailText: string): string {
  const match = emailText.match(/^\s*(.{2,120}?)\s+is being considered for the\s+/im);
  return match?.[1]?.trim() ?? '';
}

async function processInbox(runtime: Runtime) {
  if (!runtime.active) return;
  if (Date.now() - runtime.startedAt > SESSION_DURATION_MS) {
    runtime.active = false;
    if (runtime.timer) clearInterval(runtime.timer);
    emit(runtime, 'session_expired', { message: 'This email session expired after 15 minutes. Start a new session and send a new request to its mailbox.' });
    return;
  }
  try {
    const messages = await listMessages(runtime.session.personaInbox.id);
    for (const message of messages as any[]) {
      const messageId = field(message, 'id');
      const threadId = field(message, 'thread_id') || messageId;
      if (!messageId || runtime.seenMessages.has(messageId) || runtime.pendingMessages.has(messageId)) continue;
      const from = field(message, 'from', 'sender');
      const subject = field(message, 'subject');
      const direction = field(message, 'direction');
      const status = field(message, 'status');
      const content = field(message, 'extracted_text', 'text', 'body');
      const fromAddress = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? from.toLowerCase();
      if (direction && direction !== 'inbound') { runtime.seenMessages.add(messageId); continue; }
      if (status === 'bounced' || blockedSender.test(from) || automaticSubject.test(subject)) { runtime.seenMessages.add(messageId); continue; }
      const allowedSenders = new Set([
        runtime.session.recruiterEmail.toLowerCase(),
      ]);
      if (runtime.ownAddresses.has(fromAddress) || !allowedSenders.has(fromAddress)) { runtime.seenMessages.add(messageId); continue; }
      if (!runtime.announcedMessages.has(messageId)) {
        emit(runtime, 'request_received', { messageId, threadId, from, subject, text: content });
        runtime.announcedMessages.add(messageId);
      }
      if (runtime.seenThreads.has(threadId)) { runtime.seenMessages.add(messageId); continue; }
      if (runtime.pendingThreads.has(threadId)) continue;
      if (runtime.sendCount >= 6) { emit(runtime, 'error', { message: 'Session send limit reached.' }); continue; }
      runtime.pendingThreads.add(threadId);
      runtime.pendingMessages.add(messageId);
      try {
      const incoming = content.replace(/<\/?email>/gi, '[email tag]');
      const greeting = greetingForSender(from);
      const candidateName = runtime.referenceMaterial.candidateName || candidateNameFromRequest(incoming);
      const referenceMaterial = { ...runtime.referenceMaterial, candidateName };
      const draft = await generateReply(runtime.session.persona, incoming, greeting, runtime.session.contactPhone ?? '', referenceMaterial);
      let text = draft.text;
      let lint = lintReply(text, runtime.prompt, runtime.session.persona, runtime.session.contactPhone ?? '');
      if (!lint.ok) {
        const retry = await generateReply(runtime.session.persona, incoming, greeting, runtime.session.contactPhone ?? '', referenceMaterial);
        text = retry.text;
        lint = lintReply(text, runtime.prompt, runtime.session.persona, runtime.session.contactPhone ?? '');
      }
      emit(runtime, 'lint_result', { ok: lint.ok, issues: lint.issues });
      if (!lint.ok) {
        // Do not poll the same email into an endless cycle of repeated Gemini generations.
        runtime.seenMessages.add(messageId);
        runtime.seenThreads.add(threadId);
        emit(runtime, 'error', { message: 'The draft did not meet the reply requirements after one retry. No reply was prepared; send a new request to try again.' });
        continue;
      }
      const draftId = randomUUID();
      runtime.drafts.set(draftId, { text, subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`, messageId, recipient: fromAddress });
      runtime.seenMessages.add(messageId);
      runtime.seenThreads.add(threadId);
      emit(runtime, 'reply_drafted', { draftId, text, subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`, to: fromAddress, fallback: false });
      } finally {
        runtime.pendingMessages.delete(messageId);
        runtime.pendingThreads.delete(threadId);
      }
    }
  } catch (error) {
    emit(runtime, 'error', { message: error instanceof Error ? error.message : 'Polling failed.' });
  }
}

app.setErrorHandler((error: any, _request, reply) => {
  reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({ error: 'Request failed.' });
});

app.get('/api/health', async () => ({ ok: true }));
app.get('/', async () => ({ service: 'RefBot Agentboxd API', ok: true }));

app.post<{ Body: { prompt?: string; recruiterEmail?: string; contactPhone?: string; resumeText?: string; jobDescriptionText?: string; candidateName?: string } }>('/api/sessions', async (request, reply) => {
  const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
  if (!prompt) return reply.code(400).send({ error: 'prompt is required' });
  const recruiterEmail = typeof request.body?.recruiterEmail === 'string' ? request.body.recruiterEmail.trim().toLowerCase() : '';
  if (!z.string().email().safeParse(recruiterEmail).success) {
    return reply.code(400).send({ error: 'a valid recruiter email is required' });
  }
  const rawPhone = typeof request.body?.contactPhone === 'string' ? request.body.contactPhone.trim() : '';
  if (!/^(?:\d{10}|\d{3}-\d{3}-\d{4})$/.test(rawPhone)) return reply.code(400).send({ error: 'enter 10 digits, with or without hyphens' });
  const contactPhone = rawPhone.replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  const resumeText = typeof request.body?.resumeText === 'string' ? request.body.resumeText.slice(0, 20_000) : '';
  const jobDescriptionText = typeof request.body?.jobDescriptionText === 'string' ? request.body.jobDescriptionText.slice(0, 12_000) : '';
  const candidateName = candidateNameFromResume(resumeText)
    || (typeof request.body?.candidateName === 'string' ? request.body.candidateName.trim().slice(0, 120) : '');
  const generated = await generatePersona(prompt);
  const id = randomUUID();
  const personaInbox = await createInbox(generated.persona.displayName, `refbot-persona-${id}`);
  const session: Session = { id, persona: generated.persona, personaInbox, recruiterEmail, contactPhone, messages: [] };
  const runtime: Runtime = {
    session, events: [], listeners: new Set(), seenMessages: new Set(), seenThreads: new Set(), pendingMessages: new Set(), pendingThreads: new Set(), announcedMessages: new Set(),
    ownAddresses: new Set([personaInbox.address.toLowerCase()]),
    startedAt: Date.now(), sendCount: 0, active: true, prompt, drafts: new Map(), referenceMaterial: { resumeText, jobDescriptionText, candidateName },
  };
  sessions.set(id, runtime);
  emit(runtime, 'persona_generated', { persona: generated.persona, fallback: generated.fallback, reason: generated.reason });
  emit(runtime, 'inbox_created', { personaInbox });
  runtime.timer = setInterval(() => void processInbox(runtime), 2_000);
  runtime.timer.unref();
  void processInbox(runtime);
  return session;
});

app.post<{ Params: { id: string }; Body: { draftId?: string; text?: string } }>('/api/sessions/:id/drafts/send', async (request, reply) => {
  const runtime = sessions.get(request.params.id);
  if (!runtime) return reply.code(404).send({ error: 'session not found' });
  const draft = runtime.drafts.get(request.body?.draftId ?? '');
  if (!draft) return reply.code(404).send({ error: 'draft not found or already sent' });
  if (runtime.sendCount >= 6) return reply.code(429).send({ error: 'session send limit reached' });
  const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
  const lint = lintReply(text, runtime.prompt, runtime.session.persona, runtime.session.contactPhone ?? '');
  if (!lint.ok) return reply.code(400).send({ error: 'Keep the greeting and complete name, title, and contact details in your professional plain-text reply.' });
  try {
    const result = await replyToThread(runtime.session.personaInbox.id, draft.messageId, text);
    runtime.sendCount++;
    runtime.drafts.delete(request.body.draftId!);
    emit(runtime, 'reply_sent', { to: draft.recipient, subject: draft.subject });
    return { ok: true, sent: true };
  } catch (error) {
    emit(runtime, 'error', { message: error instanceof Error ? error.message : 'Could not send the reply.' });
    return reply.code(502).send({ error: 'Could not send the reply.' });
  }
});

app.post('/api/agentboxd/webhook', async (_request, reply) => {
  // Polling is the active delivery path; malformed, empty, or unconfigured webhook posts are harmless.
  return reply.send({ ok: true, ignored: true });
});

app.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
  const runtime = sessions.get(request.params.id);
  if (!runtime) return reply.code(404).send({ error: 'session not found' });
  try {
    const personaMessages = await listMessages(runtime.session.personaInbox.id);
    return { ...runtime.session, messages: [...runtime.session.messages, ...personaMessages] };
  } catch {
    return runtime.session;
  }
});

app.get<{ Params: { id: string } }>('/api/sessions/:id/events', async (request, reply) => {
  const runtime = sessions.get(request.params.id);
  if (!runtime) return reply.code(404).send({ error: 'session not found' });
  reply.hijack();
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  for (const item of runtime.events) sendSse(reply, item);
  const listener = (item: EventItem) => sendSse(reply, item);
  runtime.listeners.add(listener);
  const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
  request.raw.on('close', () => { clearInterval(heartbeat); runtime.listeners.delete(listener); });
});

app.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
  const runtime = sessions.get(request.params.id);
  if (!runtime) return reply.code(404).send({ error: 'session not found' });
  runtime.active = false;
  if (runtime.timer) clearInterval(runtime.timer);
  sessions.delete(request.params.id);
  return { ok: true };
});

const port = Number(process.env.REFBOT_PORT ?? process.env.PORT ?? 3001);
await app.listen({ port, host: '127.0.0.1' });
