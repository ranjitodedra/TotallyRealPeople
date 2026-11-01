import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import 'dotenv/config';

const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { stdio: 'ignore', env: process.env });
let sessionId = '';
try {
  let healthy = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break; } } catch { /* wait for startup */ }
    await delay(250);
  }
  if (!healthy) throw new Error('Server did not start.');
  const createdResponse = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'A funny former teammate who was great at organizing projects.' }) });
  const session = await createdResponse.json() as any;
  if (!createdResponse.ok) throw new Error(session.error || 'Session creation failed.');
  sessionId = session.id;
  const sentResponse = await fetch(`${base}/api/sessions/${sessionId}/sample-request`, { method: 'POST' });
  if (!sentResponse.ok) throw new Error('Sample request failed.');
  const deadline = Date.now() + 60_000;
  let thread: any;
  while (Date.now() < deadline) {
    await delay(2_000);
    const response = await fetch(`${base}/api/sessions/${sessionId}`);
    thread = await response.json();
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const reply = messages.find((m: any) => m && typeof m === 'object' && (m.direction === 'outbound' || m.event === 'reply_sent') && String(m.text ?? '').includes('(Fictional AI persona, LARPhacks demo)'));
    if (reply) { console.log(JSON.stringify({ persona: thread.persona, thread: messages }, null, 2)); process.exitCode = 0; break; }
  }
  if (process.exitCode !== 0) throw new Error('No threaded reply with the required footer arrived within 60 seconds.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Smoke failed.');
  process.exitCode = 1;
} finally {
  if (sessionId) { try { await fetch(`${base}/api/sessions/${sessionId}`, { method: 'DELETE' }); } catch { /* cleanup is best effort */ } }
  server.kill('SIGTERM');
}
