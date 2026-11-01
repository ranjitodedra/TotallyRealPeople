"use client";

import { use, useCallback, useEffect, useState } from "react";
import { VoiceCall } from "@/components/voice-call";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { EmailPanel } from "@/components/email-panel";
import { ChatPanel } from "@/components/chat-panel";
import { TuneAnswers } from "@/components/tune-answers";
import { ModelPicker } from "@/components/model-picker";
import { PersonaAvatar } from "@/components/brand";
import { ArrowRight, Bot, Building2, Check, Copy, Mail, Phone, TriangleAlert } from "lucide-react";
import type { PublicProfile } from "@/lib/types";
import type { ModelStatus } from "@/lib/models";

export default function ReferenceDesk({ params }: PageProps<"/r/[id]">) {
  const { id } = use(params);
  const [ref, setRef] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<"email" | "phone" | null>(null);
  // The shared Twilio number, when this reference is the one answering it.
  const [phone, setPhone] = useState<string | null>(null);
  // Gemini or Grok for text and voice, plus any fallback because a key is missing.
  const [models, setModels] = useState<ModelStatus | null>(null);

  // Some routes return the profile without the owner-only tuned answers and larps; keep the ones we have.
  const update = useCallback(
    (next: PublicProfile) => setRef((prev) => ({ ...next, qa: next.qa ?? prev?.qa, larps: next.larps ?? prev?.larps })),
    [],
  );

  const load = useCallback(
    async (key: string | null) => {
      const res = await fetch(`/api/references/${id}`, { headers: key ? { "x-edit-key": key } : {} });
      const body = await res.json();
      if (!res.ok) return setError(body.error);
      setRef(body.reference);
      setPhone(body.phone ?? null);
      setModels(body.models ?? null);
    },
    [id],
  );

  useEffect(() => {
    let key: string | null = null;
    try {
      key = localStorage.getItem(`trp-edit-${id}`);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditKey(key);
    void load(key);
  }, [id, load]);

  if (error) return <p className="pt-10 text-[var(--on-page-2)]">{error}</p>;
  if (!ref) return <p className="pt-10 text-[var(--on-page-2)]">Loading reference…</p>;

  async function copy(what: "email" | "phone", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="card">
            <div className="flex items-center gap-3">
              <PersonaAvatar name={ref.manager.name} />
              <div className="min-w-0">
                <div className="font-semibold text-xl leading-tight">{ref.manager.name}</div>
                <div className="flex items-center gap-1.5 text-sm muted">
                  <Building2 size={14} aria-hidden /> {ref.manager.title} · {ref.manager.company}
                </div>
              </div>
              <span className="badge-sim ml-auto inline-flex items-center gap-1">
                <Bot size={14} aria-hidden /> AI simulation
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--green-ink)]">
              <span className="dot" /> Available. Suspiciously prepared.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="muted">Reference for</span>
              <span className="font-medium">{ref.facts.candidateName}</span>
              <ArrowRight size={15} className="muted" aria-hidden />
              <span className="font-medium">{ref.targetRole.title}</span>
            </div>
            {ref.email && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Mail size={16} className="muted flex-none" aria-label="Email" />
                <code className="font-mono text-[13px] truncate">{ref.email.address}</code>
                <button className="btn text-xs! py-0.5! px-2!" onClick={() => copy("email", ref.email!.address)}>
                  {copied === "email" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                  {copied === "email" ? "Copied" : "Copy"}
                </button>
                {ref.email.provider === "demo" && <span className="chip">demo inbox</span>}
              </div>
            )}
            {phone && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Phone size={16} className="muted flex-none" aria-label="Phone" />
                <a href={`tel:${phone}`} className="font-mono text-[13px] truncate">
                  {formatPhone(phone)}
                </a>
                <button className="btn text-xs! py-0.5! px-2!" onClick={() => copy("phone", phone)}>
                  {copied === "phone" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                  {copied === "phone" ? "Copied" : "Copy"}
                </button>
                <span className="chip">call or text</span>
              </div>
            )}
            {ref.fakeExtraction && (
              <p className="mt-3 flex gap-2 text-xs rounded-xl px-3 py-2 bg-[var(--amber-bg)] text-[var(--amber-ink)]">
                <TriangleAlert size={15} className="flex-none mt-px" aria-hidden />
                Fake mode: facts came from a simple parser. Add GEMINI_API_KEY for real extraction and answers.
              </p>
            )}
          </div>

          {models && <ModelPicker referenceId={ref.id} editKey={editKey} status={models} onChange={setModels} />}
          <VoiceCall referenceId={ref.id} managerName={ref.manager.name} />
          <ChatPanel referenceId={ref.id} managerName={ref.manager.name} />
          {editKey && <TuneAnswers reference={ref} editKey={editKey} onSaved={update} />}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <KnowledgePanel reference={ref} editKey={editKey} onSaved={update} />
          <EmailPanel reference={ref} onUpdated={update} />
        </div>
      </div>
    </div>
  );
}

/** +15551234567 → +1 (555) 123-4567. Other countries stay as given. */
function formatPhone(n: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(n.replace(/[^\d+]/g, ""));
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : n;
}
