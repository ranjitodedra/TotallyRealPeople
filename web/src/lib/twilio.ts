import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";
import { getReference, listReferences } from "./store";

// Helpers for the shared Twilio number: webhook signatures, TwiML, and which reference answers.

export const hasTwilio = () => env.twilioAuthToken.length > 0;

/** The URL Twilio requested. Behind ngrok/Render the local request URL is http://localhost, so rebuild it. */
export function publicUrl(req: Request) {
  const u = new URL(req.url);
  if (env.publicBaseUrl) return env.publicBaseUrl + u.pathname + u.search;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  return `${proto}://${host}${u.pathname}${u.search}`;
}

/** Twilio's X-Twilio-Signature: base64 HMAC-SHA1 of the URL plus every POST param (sorted, name+value). */
export function twilioSignature(url: string, params: Record<string, string>, authToken = env.twilioAuthToken) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

/** Reads a Twilio form POST and checks its signature. Returns the params, or null if it isn't from Twilio. */
export async function readTwilioForm(req: Request): Promise<Record<string, string> | null> {
  if (!hasTwilio()) return null;
  const form = new URLSearchParams(await req.text());
  const params: Record<string, string> = {};
  for (const [k, v] of form) params[k] = v;
  const given = req.headers.get("x-twilio-signature") ?? "";
  const want = twilioSignature(publicUrl(req), params);
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (env.twilioAccountSid && params.AccountSid && params.AccountSid !== env.twilioAccountSid) return null;
  return params;
}

export function xml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

export function twiml(body: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status,
    headers: { "content-type": "text/xml" },
  });
}

/** PHONE_REFERENCE_ID if set, otherwise the newest reference. */
export async function phoneReference() {
  if (env.phoneReferenceId) return getReference(env.phoneReferenceId);
  const all = await listReferences();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** The shared number, if this reference is the one answering it. Shown on the reference page. */
export async function phoneNumberFor(referenceId: string) {
  if (!env.twilioPhoneNumber) return null;
  return (await phoneReference())?.id === referenceId ? env.twilioPhoneNumber : null;
}

// The media-stream WebSocket can't carry our webhook signature check, so the voice webhook hands the
// bridge a short-lived signed token (as a <Stream> <Parameter>) naming the reference to load.
const TOKEN_TTL_MS = 2 * 60 * 1000;

export function streamToken(referenceId: string, now = Date.now()) {
  const body = `${referenceId}.${now + TOKEN_TTL_MS}`;
  return `${body}.${createHmac("sha256", env.twilioAuthToken).update(body).digest("base64url")}`;
}

/** Returns the reference id if the token is genuine and unexpired. */
export function checkStreamToken(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !hasTwilio()) return null;
  const [id, exp, sig] = parts;
  const want = createHmac("sha256", env.twilioAuthToken).update(`${id}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Number(exp) > now ? id : null;
}
