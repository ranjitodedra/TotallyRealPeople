"use client";

import { Plus, RefreshCw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "./modal";
import type { PublicProfile, QaItem } from "@/lib/types";

/**
 * Owner-only menu: auto-generated likely questions with answers the candidate can edit.
 * The bot uses these through the shared prompt, but the safety rules still win.
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
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QaItem[]>([]);
  const [busy, setBusy] = useState<null | "save" | "generate">(null);
  const [error, setError] = useState<string | null>(null);

  function show() {
    setItems(reference.qa ?? []);
    setError(null);
    setOpen(true);
  }

  async function call(path: string, method: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", "x-edit-key": editKey },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    onSaved(data.reference);
    return data.reference as PublicProfile;
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const qa = items
        .map((q) => ({ ...q, question: q.question.trim(), answer: q.answer.trim() }))
        .filter((q) => q.question);
      await call(`/api/references/${reference.id}`, "PATCH", { qa });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (items.length && !confirm("Replace all questions with a fresh generated set?")) return;
    setBusy("generate");
    setError(null);
    try {
      const r = await call(`/api/references/${reference.id}/qa`, "POST");
      setItems(r.qa ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate.");
    } finally {
      setBusy(null);
    }
  }

  const set = (i: number, patch: Partial<QaItem>) =>
    setItems((xs) => xs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const unanswered = items.filter((q) => !q.answer.trim()).length;

  return (
    <>
      <button className="btn text-xs! py-1!" onClick={show}>
        <SlidersHorizontal size={13} aria-hidden /> Tune answers
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        label="Tune answers"
        header={
          <div>
            <div className="font-semibold text-lg">Tune answers</div>
            <p className="text-sm muted">
              Likely questions, auto-generated. Edit the answers in your own words. Blank answers make the reference say it
              doesn&apos;t know. Only you can see this.
            </p>
          </div>
        }
        footer={
          <>
            <button className="btn mr-auto" onClick={regenerate} disabled={busy !== null}>
              <RefreshCw size={15} aria-hidden /> {busy === "generate" ? "Generating…" : "Regenerate"}
            </button>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy !== null}>
              <Save size={15} aria-hidden /> {busy === "save" ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          {items.length === 0 && <p className="muted">No questions yet. Press Regenerate or add one.</p>}
          {unanswered > 0 && (
            <p className="text-xs rounded-xl px-3 py-2 bg-[var(--amber-bg)] text-[var(--amber-ink)]">
              {unanswered} without an answer. Fill in things only you know, like salary or why you left.
            </p>
          )}
          {items.map((q, i) => (
            <div key={q.id} className="rounded-2xl border-2 border-[var(--line)] p-3 flex flex-col gap-2 bg-white">
              <input
                className="field font-medium"
                value={q.question}
                placeholder="Question"
                aria-label={`Question ${i + 1}`}
                onChange={(e) => set(i, { question: e.target.value })}
              />
              <textarea
                className="field min-h-16"
                value={q.answer}
                placeholder="Your answer (blank = it says it doesn't know)"
                aria-label={`Answer ${i + 1}`}
                onChange={(e) => set(i, { answer: e.target.value })}
              />
              <button
                className="btn btn-danger self-start text-xs! py-1!"
                onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
              >
                <Trash2 size={13} aria-hidden /> Remove
              </button>
            </div>
          ))}
          <button
            className="btn self-start text-xs! py-1!"
            onClick={() => setItems((xs) => [...xs, { id: crypto.randomUUID().slice(0, 8), question: "", answer: "" }])}
          >
            <Plus size={13} aria-hidden /> Add question
          </button>
          <p className="text-xs muted">
            The reference always says it&apos;s an AI, never confirms employment, and won&apos;t repeat answers that break
            those rules.
          </p>
          {error && <p className="text-[var(--danger)]">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
