"use client";

import { Activity, Loader2, Mail, Play, Send, Square, CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { phoneInputPattern } from "@/lib/phone";

type Session = {
  id: string;
  persona: { displayName: string };
  personaInbox: { address: string };
  recruiterEmail: string;
  contactPhone?: string;
};
type LogItem = { event: string; data: Record<string, unknown> };
type Draft = { draftId: string; text: string; to: string };

function candidateNameFromResume(text: string) {
  const lines = text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const labeled = lines.find((item) => /^name\s*:/i.test(item))?.replace(/^name\s*:\s*/i, "");
  if (labeled) return labeled.split(/[·•|]/)[0]?.trim() ?? "";
  return lines.find((item) =>
    !/@|https?:\/\/|\d|\b(resume|curriculum vitae|experience|education|skills|professional summary|objective|phone|email)\b/i.test(item)
    && /^[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){1,3}$/u.test(item),
  ) ?? "";
}

function sampleRoleFromJob(text: string) {
  const heading = text.split(/\r?\n/).map((item) => item.trim()).find((item) => item.length > 0);
  if (!heading) return { title: "", organization: "" };
  const parts = heading.split(/\s+[—–-]\s+/, 2).map((item) => item.trim());
  return { title: parts[0] ?? "", organization: parts[1] ?? "" };
}

const EVENTS = [
  "persona_generated", "inbox_created", "request_received", "reply_drafted", "reply_sent", "error", "session_expired",
];
const SAMPLE_PERSONA = `Create a fictional reference persona named Taylor Morgan, an Engineering Manager and former supervisor at Northstar Systems, a made-up organization. Taylor worked with the candidate for about three years and communicates in a warm, thoughtful, and professional way. The reference can mention that the candidate kept clear project notes, helped teammates stay calm during busy periods, and made sure the team had the resources it needed. Keep every detail fictional.`;

export function RefBotPanel({ resumeText, jobDescriptionText }: { resumeText: string; jobDescriptionText: string }) {
  const [prompt, setPrompt] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [hiringOrganization, setHiringOrganization] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<LogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveDisconnected, setLiveDisconnected] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sent, setSent] = useState(false);
  const stream = useRef<EventSource | null>(null);

  useEffect(() => () => stream.current?.close(), []);

  async function start() {
    setError(null);
    if (!prompt.trim()) return setError("Describe the fictional reference persona first.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recruiterEmail.trim())) return setError("Enter a valid recruiter email address.");
    if (!phoneInputPattern.test(contactPhone.trim())) return setError("Enter 10 digits, with or without hyphens.");
    setBusy(true);
    try {
      const response = await fetch("/api/refbot/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, recruiterEmail, contactPhone, resumeText, jobDescriptionText, candidateName: candidateNameFromResume(resumeText) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't start the RefBot session.");
      setSession(body);
      setEvents([]);
      setDraft(null);
      setSent(false);
      setLiveDisconnected(false);
      stream.current?.close();
      const source = new EventSource(`/api/refbot/sessions/${encodeURIComponent(body.id)}/events`);
      stream.current = source;
      for (const name of EVENTS) {
        source.addEventListener(name, (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            if (name === "reply_drafted" && typeof data.draftId === "string") {
              setDraft({ draftId: data.draftId, text: data.text, to: data.to });
              setSent(false);
              setError(null);
            }
            if (name === "reply_sent") { setDraft(null); setSent(true); }
            if (name === "error" && typeof data.message === "string") setError(data.message);
            if (name === "session_expired" && typeof data.message === "string") setError(data.message);
            setEvents((items) => [...items, { event: name, data }]);
          } catch {
            setEvents((items) => [...items, { event: name, data: { message: "Received an unreadable event." } }]);
          }
        });
      }
      source.onopen = () => setLiveDisconnected(false);
      source.onerror = () => setLiveDisconnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the RefBot session.");
    } finally {
      setBusy(false);
    }
  }

  async function sendDraft() {
    if (!session || !draft) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/refbot/sessions/${encodeURIComponent(session.id)}/drafts/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.draftId, text: draft.text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't send the reply.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the reply.");
    } finally {
      setBusy(false);
    }
  }

  function fillSampleRequest() {
    const role = sampleRoleFromJob(jobDescriptionText);
    setHiringOrganization(role.organization);
    setCandidateName(candidateNameFromResume(resumeText));
    setJobTitle(role.title);
  }

  function openRequestInGmail() {
    if (!session || !hiringOrganization.trim() || !candidateName.trim() || !jobTitle.trim()) {
      setError("Add the organization, candidate, and job title first.");
      return;
    }
    setError(null);
    const subject = `Reference Check Invitation from ${hiringOrganization.trim()}`;
    const message = `Hello ${session.persona.displayName.split(" ")[0]},\n\n${candidateName.trim()} is being considered for the ${jobTitle.trim()} position at ${hiringOrganization.trim()}. We would appreciate your perspective on their strengths, contributions, and fit for the role. Please reply to this email with your comments.\n\nThank you,\n${hiringOrganization.trim()} Hiring Team`;
    const query = new URLSearchParams({ view: "cm", fs: "1", to: session.personaInbox.address, su: subject, body: message });
    window.open(`https://mail.google.com/mail/?${query.toString()}`, "_blank", "noopener,noreferrer");
  }

  async function stop() {
    if (!session) return;
    setBusy(true);
    try {
      await fetch(`/api/refbot/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      stream.current?.close();
      stream.current = null;
      setSession(null);
      setEvents([]);
      setDraft(null);
      setSent(false);
      setLiveDisconnected(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mb-12 flex flex-col gap-4" aria-labelledby="refbot-title">
      <div className="flex items-center gap-3">
        <span className="icon-tile" style={{ background: "#e3f4fd", color: "#1899d6" }}><Activity size={19} aria-hidden /></span>
        <div>
          <h2 id="refbot-title" className="text-xl font-semibold">Agentboxd email loop</h2>
          <p className="text-sm text-[var(--on-page-2)]">Create a fictional reference, review its reply, then choose whether to email it.</p>
        </div>
      </div>
      {!session ? (
        <>
          <label className="text-sm font-medium" htmlFor="refbot-prompt">Who is writing this reference?</label>
          <textarea id="refbot-prompt" className="field min-h-28" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Enter their name, job title, how they know the candidate, and a few things they can say about the candidate." />
          <p className="text-xs text-[var(--on-page-2)]">This hackathon demo uses made-up people and work history.</p>
          <p className="text-xs text-[var(--on-page-2)]">The reply can draw on the résumé and job description above to mention relevant sample experiences.</p>
          <p className="text-xs text-[var(--on-page-2)]">Gemini drafts each reply from the incoming email, résumé, job description, and reference details. Agentboxd handles the mailbox and sends the reply after your review.</p>
          <button className="btn self-start" type="button" onClick={() => setPrompt(SAMPLE_PERSONA)}>Fill in an example</button>
          <label className="text-sm font-medium" htmlFor="refbot-recruiter-email">Recruiter email</label>
          <input id="refbot-recruiter-email" className="field" type="email" autoComplete="email" required value={recruiterEmail} onChange={(e) => setRecruiterEmail(e.target.value)} placeholder="you@company.com" />
          <p className="text-xs text-[var(--on-page-2)]">This is where an approved reply will be sent. The app does not sign in to or read your Gmail.</p>
          <label className="text-sm font-medium" htmlFor="refbot-contact-phone">Reference phone number</label>
          <input id="refbot-contact-phone" className="field" type="tel" autoComplete="tel" required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="123-456-7890 or 1234567890" />
          <button className="btn self-start text-xs! py-1!" type="button" onClick={() => setContactPhone("123-456-7890")}>Use sample number: 123-456-7890</button>
          <p className="text-xs text-[var(--on-page-2)]">Starting creates the demo mailbox. You’ll send a request from Gmail; the reply will wait here for your review before it is sent.</p>
          <button className="btn btn-primary self-start" onClick={start} disabled={busy || !recruiterEmail.trim() || !contactPhone.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />}
            {busy ? "Starting…" : "Start email loop"}
          </button>
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-[var(--line)] bg-white p-3 text-sm"><div className="mb-1 flex items-center gap-2 font-medium"><Mail size={15} aria-hidden /> Demo reference mailbox</div><code className="break-all">{session.personaInbox.address}</code><p className="mt-2 text-[var(--on-page-2)]">Send the request from <strong>{session.recruiterEmail}</strong> so the reply can return to the same email thread.</p></div>
          <div className="flex flex-col gap-3 rounded-xl border-2 border-[var(--line)] bg-white p-4">
            <div><h3 className="font-semibold">Send a reference request</h3><p className="text-sm text-[var(--on-page-2)]">We’ll open a prefilled Gmail draft. Review it and press Send in Gmail to start the conversation.</p></div>
            <button className="btn self-start" type="button" onClick={fillSampleRequest}>Fill in a sample request</button>
            <label className="text-sm font-medium" htmlFor="refbot-request-org">Hiring organization</label>
            <input id="refbot-request-org" className="field" value={hiringOrganization} onChange={(e) => setHiringOrganization(e.target.value)} placeholder="Organization name" />
            <label className="text-sm font-medium" htmlFor="refbot-request-candidate">Candidate name</label>
            <input id="refbot-request-candidate" className="field" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Candidate name" />
            <label className="text-sm font-medium" htmlFor="refbot-request-role">Job title</label>
            <input id="refbot-request-role" className="field" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Position they’re applying for" />
            {(hiringOrganization.trim() || candidateName.trim() || jobTitle.trim()) && <p className="text-xs text-[var(--on-page-2)]">Subject: <strong>Reference Check Invitation from {hiringOrganization.trim() || "[Hiring organization]"}</strong></p>}
            <button className="btn btn-primary self-start" type="button" onClick={openRequestInGmail} disabled={!hiringOrganization.trim() || !candidateName.trim() || !jobTitle.trim()}><ExternalLink size={15} aria-hidden /> Open request in Gmail</button>
          </div>
          <p className="text-sm text-[var(--on-page-2)]">When a request arrives, its subject stays on the thread. The reply waits here for your review and approval before going to <strong>{session.recruiterEmail}</strong>. This is a fictional hackathon demo.</p>
          {draft && <div className="flex flex-col gap-3 rounded-xl border-2 border-[var(--line)] bg-white p-4">
            <div><h3 className="font-semibold">Your reply is ready to review</h3><p className="text-sm text-[var(--on-page-2)]">We drafted a reply to the email you sent. Edit it before sending.</p></div>
            <label className="text-sm font-medium" htmlFor="refbot-draft-text">Reply</label>
            <textarea id="refbot-draft-text" className="field min-h-40" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            <p className="text-xs text-[var(--on-page-2)]">The reply goes back in the same email thread. The signature uses the reference name, job title, and phone number you provided.</p>
            <button className="btn btn-primary self-start" onClick={sendDraft} disabled={busy}><Send size={15} aria-hidden /> {busy ? "Sending…" : "Send reply"}</button>
          </div>}
          {sent && <p className="flex items-center gap-2 text-sm text-green-700" role="status"><CheckCircle2 size={17} aria-hidden /> Sent to your inbox.</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={stop} disabled={busy}><Square size={15} aria-hidden /> Stop session</button>
          </div>
          {events.some((item) => item.event === "request_received") && !draft && !sent && <p className="text-sm text-[var(--on-page-2)]">A new question came in. Preparing a reply for you to review…</p>}
        </>
      )}
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {liveDisconnected && <p className="text-sm text-[var(--danger)]" role="status">Live status updates are reconnecting. Reply processing may continue; any processing error will appear here when the connection returns.</p>}
    </section>
  );
}
