"use client";

// "My references": showcase placeholder for managing several references.
// Real rows come from edit keys in this browser (no accounts yet); the rest is mock data.
// Accounts (OAuth) would replace the localStorage lookup so a user owns references across devices.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Archive, Copy, ExternalLink, Lock, Mail, MessageSquare, Mic, Phone, PhoneCall, Plus, Users } from "lucide-react";
import { PersonaAvatar } from "@/components/brand";
import type { Channel, PublicProfile } from "@/lib/types";

type Status = "Live" | "Draft" | "Archived";

interface Row {
  /** Set for real references; mock rows have no page to open. */
  id?: string;
  manager: string;
  managerTitle: string;
  role: string;
  company?: string;
  channels: Channel[];
  status: Status;
  lastActivity: string;
}

// Edit freely: these are only for the demo.
const MOCK: Row[] = [
  { manager: "Dana Okafor", managerTitle: "Engineering Manager", role: "Senior Frontend Engineer", company: "Stripe", channels: ["voice", "email", "phone"], status: "Live", lastActivity: "Called 2 hours ago" },
  { manager: "Dana Okafor", managerTitle: "Engineering Manager", role: "Product Engineer", company: "Linear", channels: ["voice", "email"], status: "Live", lastActivity: "Email answered yesterday" },
  { manager: "Marcus Lee", managerTitle: "Head of Design", role: "Product Designer", company: "Figma", channels: ["voice"], status: "Draft", lastActivity: "Created 3 days ago" },
  { manager: "Priya Nair", managerTitle: "Data Lead", role: "Data Analyst", company: "Spotify", channels: ["email"], status: "Archived", lastActivity: "Last used 2 months ago" },
];

const CHANNEL_ICON: Record<Channel, LucideIcon> = { voice: Mic, email: Mail, chat: MessageSquare, phone: Phone, sms: MessageSquare };

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  Live: { bg: "var(--green-bg)", color: "var(--green-ink)" },
  Draft: { bg: "var(--amber-bg)", color: "var(--amber-ink)" },
  Archived: { bg: "var(--card-2)", color: "var(--ink-3)" },
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hours ago`;
  return `${Math.round(mins / 60 / 24)} days ago`;
}

function toRow(p: PublicProfile, phone: string | null): Row {
  const last = p.messages.at(-1)?.at;
  const channels: Channel[] = ["voice", "chat"];
  if (p.email) channels.push("email");
  if (phone) channels.push("phone");
  return {
    id: p.id,
    manager: p.manager.name,
    managerTitle: p.manager.title,
    role: p.targetRole.title,
    company: p.targetRole.company,
    channels,
    status: "Live",
    lastActivity: last ? `Email ${ago(last)}` : `Created ${ago(p.createdAt)}`,
  };
}

/** References this browser created, found through their saved edit keys. */
async function loadMine(): Promise<Row[]> {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("trp-edit-")) ids.push(k.slice("trp-edit-".length));
    }
  } catch {}
  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`/api/references/${id}`);
        if (!res.ok) return null;
        const body = await res.json();
        return toRow(body.reference, body.phone ?? null);
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r): r is Row => r !== null);
}

function SoonButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button className="btn px-2.5! py-1.5! text-xs!" disabled title="Coming soon" style={{ cursor: "not-allowed" }}>
      <Icon size={14} aria-hidden /> {label}
    </button>
  );
}

function ReferenceCard({ row }: { row: Row }) {
  const s = STATUS_STYLE[row.status];
  return (
    <div className="card flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-3">
        <PersonaAvatar name={row.manager} size={44} />
        <div className="min-w-0">
          <div className="font-semibold leading-tight truncate">{row.manager}</div>
          <div className="text-sm muted truncate">{row.managerTitle}</div>
        </div>
        <span className="chip ml-auto font-semibold!" style={{ background: s.bg, color: s.color, borderColor: "transparent" }}>
          {row.status}
        </span>
      </div>
      <div>
        <div className="font-semibold">{row.role}</div>
        {row.company && <div className="text-sm muted">at {row.company}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {row.channels.map((c) => {
          const Icon = CHANNEL_ICON[c];
          return (
            <span key={c} className="chip inline-flex! items-center gap-1 capitalize">
              <Icon size={12} aria-hidden /> {c}
            </span>
          );
        })}
        {!row.id && <span className="chip">Sample</span>}
      </div>
      <div className="text-xs muted">{row.lastActivity}</div>
      <div className="flex flex-wrap gap-2 border-t-2 border-[var(--line)] pt-3 mt-auto">
        {row.id ? (
          <Link href={`/r/${row.id}`} className="btn btn-primary px-3! py-1.5! text-xs!">
            <ExternalLink size={14} aria-hidden /> Open
          </Link>
        ) : (
          <SoonButton icon={ExternalLink} label="Open" />
        )}
        <SoonButton icon={Copy} label="Duplicate" />
        <SoonButton icon={Archive} label="Archive" />
        <SoonButton icon={PhoneCall} label="Set as phone line" />
      </div>
    </div>
  );
}

export default function MyReferences() {
  const [mine, setMine] = useState<Row[] | null>(null);

  useEffect(() => {
    void loadMine().then(setMine);
  }, []);

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My references</h1>
          <p className="text-[var(--on-page-2)]">Every fake manager you&apos;ve hired, in one place.</p>
        </div>
        <Link href="/" className="btn btn-primary ml-auto">
          <Plus size={16} aria-hidden /> New reference
        </Link>
      </div>

      <div className="card flex flex-wrap items-center gap-4" style={{ background: "#eef9ff", borderColor: "#cfe9f7" }}>
        <span className="icon-tile" style={{ background: "var(--p-blue)", color: "#11709e" }}>
          <Users size={18} aria-hidden />
        </span>
        <div className="flex-1 min-w-[220px]">
          <div className="font-semibold flex items-center gap-2">
            Accounts are coming <span className="chip whitespace-nowrap">Coming soon</span>
          </div>
          <p className="text-sm text-[var(--ink-2)]">
            Sign in to own several references on any device. For now, references live in the browser that made them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled title="Coming soon" style={{ cursor: "not-allowed" }}>
            <Lock size={14} aria-hidden /> Sign in with Google
          </button>
          <button className="btn" disabled title="Coming soon" style={{ cursor: "not-allowed" }}>
            <Lock size={14} aria-hidden /> Sign in with GitHub
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <span className="label mb-0!">Made in this browser</span>
        {mine === null ? (
          <p className="text-sm text-[var(--on-page-2)]">Looking for your references…</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-[var(--on-page-2)]">
            None yet. <Link href="/" className="text-[var(--blue)] font-semibold">Make your first reference</Link>.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((r) => (
              <ReferenceCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <span className="label mb-0!">Preview: what a full account looks like</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK.map((r, i) => (
            <ReferenceCard key={i} row={r} />
          ))}
        </div>
      </section>
    </div>
  );
}
