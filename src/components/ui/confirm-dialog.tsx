"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  /** What will happen, stated plainly. */
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/** In-app confirmation that names the consequence; replaces `window.confirm`. */
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = "Volver", busy, confirmDisabled, error, onConfirm, onCancel, children }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <div className="confirm-body">{body}</div>
        {children}
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button onClick={onConfirm} disabled={busy || confirmDisabled}>{busy ? "Un momento…" : confirmLabel}</Button>
        </footer>
      </section>
    </div>
  );
}
