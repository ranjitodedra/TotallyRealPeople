"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Centered popup. Closes on Esc, backdrop click, or the X. */
export function Modal({
  open,
  onClose,
  header,
  footer,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  label: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={label} className="modal-panel flex flex-col w-full max-w-2xl max-h-[85vh]">
        <div className="flex items-start gap-3 p-5 border-b-2 border-[var(--line)]">
          <div className="flex-1 min-w-0">{header}</div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="p-4 border-t-2 border-[var(--line)] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
