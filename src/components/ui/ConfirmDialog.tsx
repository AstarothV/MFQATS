'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean; // a red button for things that cannot be undone
}

/**
 * The system's own "Are you sure?" box, in place of the browser's confirm() pop-up (which a browser can be told to
 * block, and then every button that asks first silently does nothing).
 *   const [confirm, confirmBox] = useConfirm();  ...  if (!(await confirm({ ... }))) return;  ...  {confirmBox}
 */
export function useConfirm() {
  const [ask, setAsk] = useState<(ConfirmOptions & { answer: (yes: boolean) => void }) | null>(null);
  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((answer) => setAsk({ ...opts, answer })), []);
  const close = (yes: boolean) => { ask?.answer(yes); setAsk(null); };
  const box = ask ? <ConfirmBox {...ask} onClose={close} /> : null;
  return [confirm, box] as const;
}

function ConfirmBox({ title, message, confirmLabel, cancelLabel = 'Cancel', danger, onClose }: ConfirmOptions & { onClose: (yes: boolean) => void }) {
  const keep = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    keep.current?.focus(); // the safe choice has the focus
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4" onClick={() => onClose(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={message ? 'confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <div>
          <h2 id="confirm-title" className="text-lg font-bold text-foreground">{title}</h2>
          {message && <p id="confirm-message" className="mt-1.5 text-sm text-muted-foreground">{message}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={keep} type="button" onClick={() => onClose(false)} className="btn-secondary text-sm">{cancelLabel}</button>
          <button type="button" onClick={() => onClose(true)}
            className={danger ? 'rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90' : 'btn-primary text-sm'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
