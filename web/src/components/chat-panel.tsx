"use client";

import { MessageSquareText, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { PanelTitle } from "./brand";

type Turn = { role: "user" | "model"; text: string };

export function ChatPanel({ referenceId, managerName }: { referenceId: string; managerName: string }) {
  const [history, setHistory] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = managerName.split(" ")[0];

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text) return setError("Type a question first.");
    setError(null);
    const next: Turn[] = [...history, { role: "user", text }];
    setHistory(next);
    setQ("");
    setBusy(true);
    try {
      const res = await fetch(`/api/references/${referenceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: next.slice(-20) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setHistory([...next, { role: "model", text: body.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      <PanelTitle icon={MessageSquareText} tint="#f1ebfb" color="#7a4fc7">
        Or ask in text
      </PanelTitle>
      {history.length > 0 && (
        <div className="captions border-t-0! pt-0!">
          {history.map((t, i) => (
            <p key={i} className={t.role === "user" ? "cap-caller" : "cap-ref"}>
              <span>{t.role === "user" ? "You" : first}</span> {t.text}
            </p>
          ))}
          {busy && <p className="muted text-sm">{first} is typing…</p>}
        </div>
      )}
      <form onSubmit={ask} className="flex gap-2">
        <input
          className="field"
          placeholder="How does Alex handle unclear scope?"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setError(null);
          }}
        />
        <button className="btn" disabled={busy}>
          <SendHorizontal size={16} aria-hidden /> Ask
        </button>
      </form>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
