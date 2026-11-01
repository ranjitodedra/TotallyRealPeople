"use client";

import {
  Briefcase,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { JobPicker } from "@/components/job-picker";
import { guessEmployers } from "@/lib/employers";
import { MANAGER } from "@/lib/manager";
import { SAMPLE_RESUME } from "@/lib/samples";

export default function CreatePage() {
  const router = useRouter();
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [custom, setCustom] = useState(customFrom);
  const [customOpen, setCustomOpen] = useState(false);
  const employers = useMemo(() => guessEmployers(resume), [resume]);
  const [busy, setBusy] = useState<null | "pdf" | "build">(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPdf(file: File) {
    setError(null);
    setBusy("pdf");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume/extract", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResume(body.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that PDF.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function build() {
    setError(null);
    if (resume.trim().length < 40) return setError("Add a résumé first: upload a PDF or paste the text.");
    if (jd.trim().length < 20) return setError("Paste the job description first.");
    setBusy("build");
    try {
      const res = await fetch("/api/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: resume, jobDescriptionText: jd, ...customBody(custom) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      try {
        localStorage.setItem(`trp-edit-${body.reference.id}`, body.editKey);
      } catch {}
      router.push(`/r/${body.reference.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the reference.");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center pt-10 pb-12">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Your reference is ready
          <br />
          to take the call
        </h1>
        <p className="mt-4 text-lg text-[var(--on-page-2)]">
          Add a résumé and a job. Get an AI reference you can call and email.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
          <Perk icon={Phone} text="Voice line" />
          <Perk icon={Mail} text="Own inbox" />
          <Perk icon={Sparkles} text="Grounded in your résumé" />
        </div>
      </div>

      <Section n={1} icon={FileText} tint="#e3f4fd" color="#1899d6" title="Résumé">
        <div className="flex gap-2">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null} type="button">
            {busy === "pdf" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />}
            {busy === "pdf" ? "Reading…" : "Upload PDF"}
          </button>
          <button className="btn" onClick={() => setResume(SAMPLE_RESUME)} type="button">
            <Wand2 size={16} aria-hidden /> Use sample
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onPdf(e.target.files[0])}
        />
        <textarea
          className="field min-h-56"
          placeholder="Paste the résumé text, or upload a PDF and fix anything that came out wrong."
          value={resume}
          onChange={(e) => setResume(e.target.value)}
        />
      </Section>

      <Section n={2} icon={Briefcase} tint="#fff1d6" color="#c27c00" title="Job">
        <JobPicker value={jd} onChange={setJd} />
      </Section>

      <Section n={3} icon={UserRound} tint="#eaf8dd" color="#3a8a00" title="Manager template">
        {/* One manager for the demo (edit lib/manager.ts). */}
        <button type="button" className="option" aria-pressed>
          <span className="w-11 h-11 rounded-full flex items-center justify-center font-bold bg-[var(--p-green)] text-[#2f6b00] flex-none">
            {MANAGER.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </span>
          <span>
            <span className="block font-semibold text-[16px]">{MANAGER.label}</span>
            <span className="block text-[14px] text-[var(--ink-2)]">
              {MANAGER.name} · {MANAGER.blurb}
            </span>
          </span>
          <Check className="ml-auto text-[var(--blue)]" size={22} aria-hidden />
        </button>
        <CustomizeAgent
          open={customOpen}
          onToggle={() => setCustomOpen(!customOpen)}
          value={custom}
          onChange={setCustom}
          employers={employers}
          onReset={() => setCustom(customFrom())}
        />
      </Section>

      <div className="flex flex-col gap-3 pb-6">
        <button className="btn btn-primary w-full text-lg! py-4!" onClick={build} disabled={busy !== null}>
          {busy === "build" ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Sparkles size={20} aria-hidden />}
          {busy === "build" ? "Building your reference…" : "Build my reference"}
        </button>
        <p className="text-sm text-center text-[var(--on-page-2)]">Creates an AI simulation from the experience you provide.</p>
        {error && <p className="text-sm text-center text-[var(--danger)]">{error}</p>}
      </div>
    </div>
  );
}

type Custom = { name: string; title: string; company: string; tone: string; focusAreas: string };

function customFrom(): Custom {
  const m = MANAGER;
  return { name: m.name, title: m.title, company: "", tone: m.tone, focusAreas: m.focusAreas.join(", ") };
}

/** Only send what the user actually changed, so edits to manager.ts still flow through. */
function customBody(c: Custom) {
  const base = customFrom();
  const focus = c.focusAreas
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    manager: {
      name: c.name.trim() !== base.name ? c.name.trim() : undefined,
      title: c.title.trim() !== base.title ? c.title.trim() : undefined,
      company: c.company || undefined,
    },
    agent: {
      tone: c.tone.trim() !== base.tone ? c.tone.trim() : undefined,
      focusAreas: c.focusAreas !== base.focusAreas && focus.length ? focus : undefined,
    },
  };
}

function CustomizeAgent({
  open,
  onToggle,
  value: v,
  onChange,
  employers,
  onReset,
}: {
  open: boolean;
  onToggle: () => void;
  value: Custom;
  onChange: (c: Custom) => void;
  employers: string[];
  onReset: () => void;
}) {
  const set = (patch: Partial<Custom>) => onChange({ ...v, ...patch });
  return (
    <div className="rounded-2xl border-2 border-[var(--line)] bg-white">
      <button type="button" className="w-full flex items-center gap-2 px-4 py-3 text-left" onClick={onToggle} aria-expanded={open}>
        <SlidersHorizontal size={17} className="text-[var(--ink-2)]" aria-hidden />
        <span className="font-semibold">Customize this manager</span>
        <span className="text-sm text-[var(--ink-3)]">optional</span>
        <ChevronDown size={18} className={`ml-auto text-[var(--ink-3)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <SmallField label="Name">
              <input className="field" value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
            </SmallField>
            <SmallField label="Position">
              <input className="field" value={v.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
            </SmallField>
          </div>
          <SmallField label="Company (from your résumé)">
            <select className="field" value={v.company} onChange={(e) => set({ company: e.target.value })}>
              <option value="">Auto: the employer most relevant to the job</option>
              {employers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {employers.length === 0 && (
              <span className="text-xs text-[var(--ink-3)]">Add your résumé in step 1 to pick a specific employer.</span>
            )}
          </SmallField>
          <SmallField label="Tone">
            <textarea className="field min-h-16" value={v.tone} maxLength={400} onChange={(e) => set({ tone: e.target.value })} />
          </SmallField>
          <SmallField label="Talks most about (comma separated)">
            <input className="field" value={v.focusAreas} onChange={(e) => set({ focusAreas: e.target.value })} />
          </SmallField>
          <div className="flex items-center gap-3">
            <button type="button" className="btn text-xs! py-1!" onClick={onReset}>
              <RotateCcw size={13} aria-hidden /> Reset to template
            </button>
            <span className="text-xs text-[var(--ink-3)]">Whatever you pick, the reference always says it&apos;s an AI.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--ink-2)]">{label}</span>
      {children}
    </label>
  );
}

function Perk({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--line)] px-3 py-1 text-[var(--ink-2)]">
      <Icon size={15} aria-hidden /> {text}
    </span>
  );
}

function Section({
  n,
  icon: Icon,
  tint,
  color,
  title,
  children,
}: {
  n: number;
  icon: LucideIcon;
  tint: string;
  color: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 pb-10">
      <h2 className="flex items-center gap-3 text-xl font-semibold">
        <span className="icon-tile" style={{ background: tint, color }}>
          <Icon size={19} aria-hidden />
        </span>
        <span className="text-[var(--ink-3)] text-base font-medium">Step {n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
