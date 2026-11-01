import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Pastel quadrant logo mark. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="flex-none">
      <path d="M32 32V0A32 32 0 0 0 0 32Z" fill="var(--p-blue)" />
      <path d="M32 32V0A32 32 0 0 1 64 32Z" fill="var(--p-yellow)" />
      <path d="M32 32H0A32 32 0 0 0 32 64Z" fill="var(--p-purple)" />
      <path d="M32 32H64A32 32 0 0 1 32 64Z" fill="var(--p-peach)" />
    </svg>
  );
}

/** Pastel initials avatar for the fictional manager. */
export function PersonaAvatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-none"
      style={{ width: size, height: size, background: "var(--p-green)", color: "#2f6b00", fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

/** Panel heading: colored icon tile + uppercase label. */
export function PanelTitle({
  icon: Icon,
  tint,
  color,
  children,
}: {
  icon: LucideIcon;
  tint: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="icon-tile w-8! h-8!" style={{ background: tint, color }}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="label mb-0!">{children}</span>
    </span>
  );
}
