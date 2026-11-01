"use client";

import { Check, ChevronDown, Lock, Plus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { PanelTitle } from "./brand";
import type { PublicProfile, QaItem } from "@/lib/types";

/**
 * Owner-only card: auto-generated likely questions with answers the candidate can edit.
 * The bot uses these through the shared prompt; the locked safety answers can't be changed.
 */
export function TuneAnswers({
  reference,
  editKey,
  onSaved,
}: {
  reference: PublicProfile;
  editKey: string;
  onSaved: (r: PublicProfile) => void;
}) {
  const items = reference.qa ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ question: "", answer: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = items.filter((q) => !q.locked);
  const answered = editable.filter((q) => q.answer.trim()).length;

  async function send(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", "x-edit-key": editKey },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.reference);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveList = (qa: QaItem[]) => send(`/api/references/${reference.id}`, "PATCH", { qa });

  function open(q: QaItem) {
    if (openId === q.id) return setOpenId(null);
    setDraft({ question: q.question, answer: q.answer });
    setOpenId(q.id);
  }

  async function saveOne(id: string) {
    const question = draft.question.trim();
    if (!question) return setError("The question can't be empty.");
    const exists = items.some((q) => q.id === id);
    const next = exists
      ? items.map((q) => (q.id === id ? { ...q, question, answer: draft.answer.trim() } : q))
      : [...items, { id, question, answer: draft.answer.trim() }];
    if (await saveList(next)) setOpenId(null);
  }

  async function remove(id: string) {
    if (await saveList(items.filter((q) => q.id !== id))) setOpenId(null);
  }

  function addNew() {
    setDraft({ question: "", answer: "" });
    setOpenId(`new-${crypto.randomUUID().slice(0, 8)}`);
  }

  async function regenerate() {
    if (items.length && !confirm("Replace all questions and answers with a fresh generated set?")) return;
    if (await send(`/api/references/${reference.id}/qa`, "POST")) setOpenId(null);
  }

  const editor = (id: string, isNew: boolean) => (
    <div className="flex flex-col gap-2 pt-2">
      <input
        className="field font-medium"
        value={draft.question}
        placeholder="Question a hiring manager might ask"
        aria-label="Question"
        autoFocus={isNew}
        onChange={(e) => setDraft({ ...draft, question: e.target.value })}
      />
      <textarea
        className="field min-h-20"
        value={draft.answer}
        placeholder="Your answer. Leave blank and the reference will say it doesn't know."
        aria-label="Answer"
        autoFocus={!isNew}
        onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary text-sm! py-1.5!" onClick={() => saveOne(id)} disabled={busy}>
          <Check size={15} aria-hidden /> {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn text-sm! py-1.5!" onClick={() => setOpenId(null)}>
          Cancel
        </button>
        {!isNew && (
          <button className="btn btn-danger text-sm! py-1.5! ml-auto" onClick={() => remove(id)} disabled={busy}>
            <Trash2 size={14} aria-hidden /> Remove
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <PanelTitle icon={SlidersHorizontal} tint="#e3f4fd" color="#1899d6">
            Tune answers
          </PanelTitle>
          <p className="text-sm muted mt-1.5">
            Questions hiring managers will likely ask. Answer the ones only you know. Only you can see this.
          </p>
        </div>
        <button className="btn text-xs! py-1! flex-none" onClick={regenerate} disabled={busy} title="Generate a fresh set">
          <RefreshCw size={13} aria-hidden /> Regenerate
        </button>
      </div>

      {editable.length > 0 && (
        <div>
          <div className="flex justify-between text-xs muted mb-1">
            <span>
              {answered} of {editable.length} answered
            </span>
            {answered < editable.length && <span>Blank ones get &quot;I don&apos;t know&quot;</span>}
          </div>
          <div className="h-2 rounded-full bg-[var(--card-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--green)] transition-all"
              style={{ width: `${(answered / editable.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {items.length === 0 && <p className="text-sm muted">No questions yet. Press Regenerate or add your own.</p>}

      <ul className="flex flex-col gap-2">
        {items.map((q) => {
          const isOpen = openId === q.id;
          const blank = !q.answer.trim();
          return (
            <li
              key={q.id}
              className={`rounded-2xl border-2 px-3 py-2.5 text-sm ${
                isOpen ? "border-[var(--blue)] bg-white" : "border-[var(--line)] bg-white"
              }`}
            >
              {q.locked ? (
                <div className="flex gap-2">
                  <Lock size={15} className="muted flex-none mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-medium">{q.question}</div>
                    <div className="muted">{q.answer}</div>
                    <div className="text-xs text-[var(--ink-3)] mt-0.5">Always on. Keeps the reference honest.</div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="w-full flex items-start gap-2 text-left"
                    onClick={() => open(q)}
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{q.question}</span>
                      {!isOpen &&
                        (blank ? (
                          <span className="inline-block mt-1 text-xs rounded-full px-2 py-0.5 bg-[var(--amber-bg)] text-[var(--amber-ink)]">
                            Needs your answer
                          </span>
                        ) : (
                          <span className="block muted truncate">{q.answer}</span>
                        ))}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`muted flex-none mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {isOpen && editor(q.id, false)}
                </>
              )}
            </li>
          );
        })}
        {openId?.startsWith("new-") && (
          <li className="rounded-2xl border-2 border-[var(--blue)] px-3 py-2.5 text-sm bg-white">
            <div className="font-medium">New question</div>
            {editor(openId, true)}
          </li>
        )}
      </ul>

      {!openId?.startsWith("new-") && (
        <button className="btn self-start text-sm! py-1.5!" onClick={addNew}>
          <Plus size={15} aria-hidden /> Add a question
        </button>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
