"use client";

import { CornerDownRight, FlaskConical, Inbox, Send } from "lucide-react";
import { useState } from "react";
import { PanelTitle } from "./brand";
import type { PublicProfile } from "@/lib/types";

export function EmailPanel({ reference, onUpdated }: { reference: PublicProfile; onUpdated: (r: PublicProfile) => void }) {
  const [from, setFrom] = useState("hiring@northwind.example");
  const [subject, setSubject] = useState(`Reference check: ${reference.facts.candidateName}`);
  const [text, setText] = useState(
    `Hi ${reference.manager.name.split(" ")[0]},\n\nWhat was ${reference.facts.candidateName.split(" ")[0]}'s biggest contribution on your team, and where should they keep growing?\n\nThanks`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!from.trim() || !subject.trim() || !text.trim()) return setError("Fill in from, subject, and message.");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/references/${reference.id}/email-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, subject, text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      onUpdated(body.reference);
      setOpen(body.reference.messages.at(-1)?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  const msgs = [...reference.messages].reverse();

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <PanelTitle icon={Inbox} tint="#e3f4fd" color="#1899d6">
          Email
        </PanelTitle>
        <code className="font-mono text-xs muted truncate">{reference.email?.address}</code>
      </div>

      {msgs.length === 0 ? (
        <p className="text-sm muted">No email yet. Send a test question below, or email the address above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--line)] border-2 border-[var(--line)] rounded-2xl bg-white overflow-hidden">
          {msgs.map((m) => (
            <li key={m.id}>
              <button className="w-full text-left px-3 py-2 text-sm" onClick={() => setOpen(open === m.id ? null : m.id)}>
                <div className="flex gap-2">
                  <span className={m.direction === "outbound" ? "text-[var(--green-ink)] font-medium" : "font-medium"}>
                    {m.direction === "outbound" ? (
                      <span className="inline-flex items-center gap-1">
                        <CornerDownRight size={14} aria-hidden /> {reference.manager.name} (AI)
                      </span>
                    ) : (
                      m.from
                    )}
                  </span>
                  {m.workflowRunId && (
                    <span className="chip ml-auto" title={`Render Workflows run ${m.workflowRunId}`}>
                      via Render Workflow
                    </span>
                  )}
                  {m.demo && <span className={`chip ${m.workflowRunId ? "" : "ml-auto"}`}>demo</span>}
                </div>
                <div className="muted truncate">{m.subject}</div>
              </button>
              {open === m.id && <pre className="whitespace-pre-wrap font-sans text-sm px-3 pb-3">{m.text}</pre>}
            </li>
          ))}
        </ul>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium inline-flex items-center gap-2">
          <FlaskConical size={16} aria-hidden /> Send a test email (demo)
        </summary>
        <form onSubmit={send} className="mt-3 flex flex-col gap-2">
          <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="hiring@company.com" />
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="field min-h-28" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn self-start" disabled={busy}>
            <Send size={15} aria-hidden />
            {busy ? "Waiting for a reply…" : "Send test email"}
          </button>
          {error && <p className="text-[var(--danger)]">{error}</p>}
        </form>
      </details>
    </div>
  );
}
