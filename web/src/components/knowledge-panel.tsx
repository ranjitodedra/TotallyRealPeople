"use client";

import { Brain, BriefcaseBusiness, Link2, Pencil, Plus, Save, ShieldQuestion, Target, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { PanelTitle } from "./brand";
import type { CandidateRole, PublicProfile } from "@/lib/types";

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function KnowledgePanel({
  reference,
  editKey,
  onSaved,
}: {
  reference: PublicProfile;
  editKey: string | null;
  onSaved: (r: PublicProfile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => toDraft(reference));

  function startEdit() {
    setDraft(toDraft(reference));
    setEditing(true);
  }

  async function save() {
    if (!editKey) return;
    if (!draft.candidateName.trim()) return setError("The candidate needs a name.");
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/references/${reference.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-edit-key": editKey },
        body: JSON.stringify({
          facts: {
            ...reference.facts,
            candidateName: draft.candidateName.trim(),
            roles: draft.roles.map((r) => ({
              company: r.company,
              title: r.title,
              startDate: r.startDate || undefined,
              endDate: r.endDate || undefined,
              achievements: lines(r.achievementsText),
            })),
            skills: draft.skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
          targetRole: { ...reference.targetRole, title: draft.targetTitle, priorities: lines(draft.priorities) },
          relevance: lines(draft.relevance),
          unknowns: lines(draft.unknowns),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      onSaved(body.reference);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const f = reference.facts;

  if (editing) {
    const setRole = (i: number, patch: Partial<DraftRole>) =>
      setDraft((d) => ({ ...d, roles: d.roles.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
    return (
      <div className="card flex flex-col gap-3 text-sm">
        <PanelTitle icon={Pencil} tint="#fdeaf1" color="#c23a6b">
          Edit what this reference knows
        </PanelTitle>
        <Field label="Candidate name">
          <input
            className="field"
            value={draft.candidateName}
            onChange={(e) => setDraft({ ...draft, candidateName: e.target.value })}
          />
        </Field>
        {draft.roles.map((r, i) => (
          <div key={i} className="rounded-2xl border-2 border-[var(--line)] p-3 flex flex-col gap-2 bg-white">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="field"
                value={r.title}
                placeholder="Title"
                onChange={(e) => setRole(i, { title: e.target.value })}
              />
              <input
                className="field"
                value={r.company}
                placeholder="Company"
                onChange={(e) => setRole(i, { company: e.target.value })}
              />
              <input
                className="field"
                value={r.startDate}
                placeholder="Start"
                onChange={(e) => setRole(i, { startDate: e.target.value })}
              />
              <input
                className="field"
                value={r.endDate}
                placeholder="End"
                onChange={(e) => setRole(i, { endDate: e.target.value })}
              />
            </div>
            <textarea
              className="field min-h-20"
              value={r.achievementsText}
              placeholder="One achievement per line"
              onChange={(e) => setRole(i, { achievementsText: e.target.value })}
            />
            <button
              className="btn btn-danger self-start text-xs! py-1!"
              onClick={() => setDraft((d) => ({ ...d, roles: d.roles.filter((_, j) => j !== i) }))}
            >
              <Trash2 size={13} aria-hidden /> Remove role
            </button>
          </div>
        ))}
        <button
          className="btn self-start text-xs! py-1!"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              roles: [...d.roles, { title: "", company: "", startDate: "", endDate: "", achievementsText: "" }],
            }))
          }
        >
          <Plus size={13} aria-hidden /> Add role
        </button>
        <Field label="Skills (comma separated)">
          <input className="field" value={draft.skills} onChange={(e) => setDraft({ ...draft, skills: e.target.value })} />
        </Field>
        <Field label="Target role">
          <input
            className="field"
            value={draft.targetTitle}
            onChange={(e) => setDraft({ ...draft, targetTitle: e.target.value })}
          />
        </Field>
        <Field label="What the role cares about (one per line)">
          <textarea
            className="field min-h-20"
            value={draft.priorities}
            onChange={(e) => setDraft({ ...draft, priorities: e.target.value })}
          />
        </Field>
        <Field label="Why they fit (one per line)">
          <textarea
            className="field min-h-20"
            value={draft.relevance}
            onChange={(e) => setDraft({ ...draft, relevance: e.target.value })}
          />
        </Field>
        <Field label="Can't verify (one per line)">
          <textarea
            className="field min-h-16"
            value={draft.unknowns}
            onChange={(e) => setDraft({ ...draft, unknowns: e.target.value })}
          />
        </Field>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Save size={16} aria-hidden />
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        {error && <p className="text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 text-sm">
      <div className="flex items-center justify-between">
        <PanelTitle icon={Brain} tint="#fdeaf1" color="#c23a6b">
          What this reference knows
        </PanelTitle>
        {editKey && (
          <button className="btn text-xs! py-1!" onClick={startEdit}>
            <Pencil size={13} aria-hidden /> Edit
          </button>
        )}
      </div>

      <section>
        <h3 className="font-semibold mb-1 flex items-center gap-1.5">
          <BriefcaseBusiness size={15} aria-hidden /> Roles
        </h3>
        {f.roles.length === 0 && <p className="muted">No roles found. Edit to add them.</p>}
        <ul className="flex flex-col gap-2">
          {f.roles.map((r, i) => (
            <li key={i}>
              <div className="font-medium">
                {r.title} · {r.company}
              </div>
              <div className="muted text-xs">{[r.startDate, r.endDate].filter(Boolean).join(" – ") || "Dates not given"}</div>
              {r.achievements.length > 0 && (
                <ul className="list-disc pl-5 mt-1 text-[var(--ink-2)]">
                  {r.achievements.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      {f.skills.length > 0 && (
        <section>
          <h3 className="font-semibold mb-1 flex items-center gap-1.5">
            <Wrench size={15} aria-hidden /> Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {f.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-semibold mb-1 flex items-center gap-1.5">
          <Target size={15} aria-hidden /> Target role · {reference.targetRole.title}
        </h3>
        <ul className="list-disc pl-5 text-[var(--ink-2)]">
          {reference.targetRole.priorities.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold mb-1 flex items-center gap-1.5">
          <Link2 size={15} aria-hidden /> Why they fit
        </h3>
        <ul className="list-disc pl-5 text-[var(--ink-2)]">
          {reference.relevance.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl px-4 py-3 bg-[var(--amber-bg)] text-[var(--amber-ink)]">
        <h3 className="font-semibold mb-1 flex items-center gap-1.5">
          <ShieldQuestion size={15} aria-hidden /> Can&apos;t verify
        </h3>
        <ul className="list-disc pl-5">
          {reference.unknowns.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type DraftRole = { title: string; company: string; startDate: string; endDate: string; achievementsText: string };

function toDraft(r: PublicProfile) {
  return {
    candidateName: r.facts.candidateName,
    roles: r.facts.roles.map((x: CandidateRole): DraftRole => ({
      title: x.title,
      company: x.company,
      startDate: x.startDate ?? "",
      endDate: x.endDate ?? "",
      achievementsText: x.achievements.join("\n"),
    })),
    skills: r.facts.skills.join(", "),
    targetTitle: r.targetRole.title,
    priorities: r.targetRole.priorities.join("\n"),
    relevance: r.relevance.join("\n"),
    unknowns: r.unknowns.join("\n"),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium muted">{label}</span>
      {children}
    </label>
  );
}
