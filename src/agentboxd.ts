import 'dotenv/config';
import { Agentboxd } from 'agentboxd';

const agentboxd = new Agentboxd();

export async function createInbox(displayName: string, clientId: string) {
  const inbox = await agentboxd.inboxes.create({ display_name: displayName, client_id: clientId });
  return { id: inbox.id, address: inbox.address };
}

export async function sendEmail(inboxId: string, to: string, subject: string, text: string) {
  return agentboxd.messages.send(inboxId, { to, subject, text });
}

export async function replyToThread(inboxId: string, messageId: string, text: string) {
  return agentboxd.messages.reply(inboxId, messageId, { text });
}

export async function draftReply(messageId: string, instructions: string) {
  return agentboxd.messages.draftReply(messageId, { instructions });
}

export async function listMessages(inboxId: string) {
  const result = await agentboxd.messages.list(inboxId);
  return result.data;
}
