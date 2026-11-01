"use client";

import { Cpu, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { ModelKind, ModelStatus, Provider } from "@/lib/models";
import { PanelTitle } from "./brand";

const ROWS: { kind: ModelKind; label: string; hint: string }[] = [
  { kind: "text", label: "Text", hint: "chat, email, SMS" },
  { kind: "voice", label: "Voice", hint: "calls in the browser and on the phone" },
];
const LABEL: Record<Provider, string> = { gemini: "Gemini", grok: "Grok" };

/** Gemini or Grok for text and for voice. Only the creator can change it; everyone sees what's in use. */
export function ModelPicker({
  referenceId,
  editKey,
  status,
  onChange,
}: {
  referenceId: string;
  editKey: string | null;
  status: ModelStatus;
  onChange: (next: ModelStatus) => void;
}) {
  const [busy, setBusy] = useState<ModelKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(kind: ModelKind, provider: Provider) {
    if (!editKey || status[kind].wanted === provider) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/references/${referenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-edit-key": editKey },
        body: JSON.stringify({ models: { [kind]: provider } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      onChange(body.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      <PanelTitle icon={Cpu} tint="#e8f6fe" color="#1899d6">
        AI models
      </PanelTitle>
      {ROWS.map(({ kind, label, hint }) => {
        const s = status[kind];
        return (
          <div key={kind} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium w-12">{label}</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label={`${label} model`}>
                {(["gemini", "grok"] as const).map((p) => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={s.wanted === p}
                    className={`btn text-xs! py-0.5! px-2.5! ${s.wanted === p ? "btn-primary" : ""}`}
                    disabled={!editKey || busy === kind}
                    onClick={() => pick(kind, p)}
                    title={status.available[p] ? undefined : `No ${LABEL[p]} key on the server`}
                  >
                    {LABEL[p]}
                    {!status.available[p] && " (no key)"}
                  </button>
                ))}
              </div>
              <span className="muted text-xs">{hint}</span>
            </div>
            {s.note && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--amber-ink)]">
                <TriangleAlert size={13} className="flex-none" aria-hidden /> {s.note}
              </p>
            )}
          </div>
        );
      })}
      {!editKey && <p className="muted text-xs">Only the reference&apos;s creator can change these.</p>}
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
