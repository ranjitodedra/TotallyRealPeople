"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { PERSONAS } from "@/lib/personas";
import { SAMPLE_JD, SAMPLE_RESUME } from "@/lib/samples";

export default function CreatePage() {
  const router = useRouter();
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
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
        body: JSON.stringify({ resumeText: resume, jobDescriptionText: jd, personaId }),
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
          Add a résumé and a job description. Get an AI reference with an inbox and a voice line.
        </p>
      </div>

      <Section n={1} title="Résumé">
        <div className="flex gap-2">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null} type="button">
            {busy === "pdf" ? "Reading…" : "Upload PDF"}
          </button>
          <button className="btn" onClick={() => setResume(SAMPLE_RESUME)} type="button">
            Use sample
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

      <Section n={2} title="Job description">
        <div>
          <button className="btn" onClick={() => setJd(SAMPLE_JD)} type="button">
            Use sample
          </button>
        </div>
        <textarea
          className="field min-h-48"
          placeholder="Paste the job posting."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
      </Section>

      <Section n={3} title="Manager template">
        {PERSONAS.map((p) => (
          <button key={p.id} type="button" className="option" aria-pressed={personaId === p.id} onClick={() => setPersonaId(p.id)}>
            <span>
              <span className="block font-semibold text-[17px]">{p.label}</span>
              <span className="block text-[15px] text-[var(--ink-2)]">
                {p.name} · {p.blurb}
              </span>
            </span>
          </button>
        ))}
      </Section>

      <div className="flex flex-col gap-3 pb-6">
        <button className="btn btn-primary w-full text-lg! py-4!" onClick={build} disabled={busy !== null}>
          {busy === "build" ? "Building your reference…" : "Build my reference"}
        </button>
        <p className="text-sm text-center text-[var(--on-page-2)]">Creates an AI simulation from the experience you provide.</p>
        {error && <p className="text-sm text-center text-[var(--danger)]">{error}</p>}
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 pb-10">
      <h2 className="flex items-center gap-3 text-xl font-semibold">
        <span className="option-num">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
