'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  count: number;
  children: ReactNode;
};

/**
 * Phone layout: the full index as a modal sheet, for jumping straight to a
 * destination instead of swiping to it. A native <dialog>, so focus
 * trapping and Escape come for free.
 */
export function IndexSheet({ open, onClose, title, count, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-label={title}>
      <header className="sheet__header">
        <p className="index__label">
          <span>{title}</span>
          <span>{count}</span>
        </p>
        <button type="button" className="sheet__close" onClick={onClose}>
          Close
        </button>
      </header>
      {children}
    </dialog>
  );
}
