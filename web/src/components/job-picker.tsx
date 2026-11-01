"use client";

import { Check, ChevronDown, Info, LayoutTemplate, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { JOB_TEMPLATES, type JobTemplate } from "@/lib/job-templates";
import { Modal } from "./modal";

/** Job description textarea, with an "Or use a template" dropdown that fills it. */
export function JobPicker({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewing, setViewing] = useState<JobTemplate | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setViewing(null), []);

  // Which template the textarea currently holds, if it's untouched.
  const active = JOB_TEMPLATES.find((t) => t.text === value) ?? null;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function use(t: JobTemplate) {
    onChange(t.text);
    setMenuOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <LayoutTemplate size={16} aria-hidden /> Or use a template
            <ChevronDown size={16} aria-hidden className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="dropdown absolute left-0 top-full mt-2 z-20 w-[min(30rem,calc(100vw-2rem))] p-2 flex flex-col gap-1"
            >
              {JOB_TEMPLATES.map((t) => (
                <div key={t.id} className="dropdown-row">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex flex-1 items-center gap-3 text-left min-w-0 p-2"
                    onClick={() => use(t)}
                  >
                    <CompanyBadge t={t} size={38} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[15px] truncate">{t.title}</span>
                      <span className="flex items-center gap-1.5 text-[13px] text-[var(--ink-2)]">
                        {t.company} <span className="text-[var(--ink-3)]">·</span> <MapPin size={13} aria-hidden /> {t.location}
                      </span>
                    </span>
                    {active?.id === t.id && <Check size={18} className="ml-auto flex-none text-[var(--blue)]" aria-hidden />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn flex-none mr-1"
                    aria-label={`View the full ${t.company} job description`}
                    title="View full description"
                    onClick={() => {
                      setMenuOpen(false);
                      setViewing(t);
                    }}
                  >
                    <Info size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {active && (
          <span className="chip inline-flex! items-center gap-1.5 py-1!">
            <CompanyBadge t={active} size={18} />
            {active.company} template
            <button
              type="button"
              className="ml-0.5 hover:text-[var(--danger)]"
              aria-label="Clear template"
              onClick={() => onChange("")}
            >
              <X size={14} />
            </button>
          </span>
        )}
      </div>

      <textarea
        className="field min-h-48"
        placeholder="Paste the job posting."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <Modal
        open={viewing !== null}
        onClose={close}
        label={viewing ? `${viewing.company} job description` : "Job description"}
        header={
          viewing && (
            <div className="flex items-center gap-3">
              <CompanyBadge t={viewing} />
              <div className="min-w-0">
                <div className="font-semibold text-lg leading-snug">{viewing.title}</div>
                <div className="flex items-center gap-1.5 text-sm text-[var(--ink-2)]">
                  {viewing.company} <span className="text-[var(--ink-3)]">·</span> <MapPin size={14} aria-hidden />{" "}
                  {viewing.location}
                </div>
              </div>
            </div>
          )
        }
        footer={
          viewing && (
            <>
              <button className="btn" onClick={close}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onChange(viewing.text);
                  close();
                }}
              >
                <Check size={18} aria-hidden /> Use this job
              </button>
            </>
          )
        }
      >
        {viewing && <JobText text={viewing.text} />}
      </Modal>
    </div>
  );
}

function CompanyBadge({ t, size = 44 }: { t: JobTemplate; size?: number }) {
  return (
    <span
      className="flex-none flex items-center justify-center text-white font-bold"
      style={{ background: t.color, width: size, height: size, borderRadius: size * 0.27, fontSize: size * 0.42 }}
      aria-hidden
    >
      {t.company[0]}
    </span>
  );
}

/** Light formatting: "- " lines become bullets, short lines before a block become headings. */
function JobText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-[var(--ink)]">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const first = lines[0].trim();
        const isHeading = lines.length > 1 && first.length < 70 && !/[.]$/.test(first) && !first.startsWith("-");
        const body = isHeading ? lines.slice(1) : lines;
        const bullets = body.filter((l) => /^\s*-\s/.test(l));
        return (
          <div key={i}>
            {isHeading && <h3 className="font-semibold mb-1.5">{first}</h3>}
            {bullets.length === body.length ? (
              <ul className="flex flex-col gap-1">
                {body.map((l, j) => (
                  <li key={j} className={`list-disc ${/^\s{2,}-/.test(l) ? "ml-10" : "ml-5"}`}>
                    {l.replace(/^\s*-\s/, "")}
                  </li>
                ))}
              </ul>
            ) : (
              body.map((l, j) => (
                <p key={j} className="text-[var(--ink-2)]">
                  {l}
                </p>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
