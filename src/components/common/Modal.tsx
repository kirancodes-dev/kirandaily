import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Accessible dialog built on <dialog>: focus trap, Escape to close, bottom sheet on phones.
 * Rendered into <body>, so a parent's spacing (space-y-*) can't push the sheet off the bottom.
 */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The <dialog> unmounts before close() could hand focus back, so do it here.
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:m-auto sm:max-w-lg sm:rounded-2xl dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={22} aria-hidden />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-touch rounded-xl px-4 font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:ring-slate-600 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-touch rounded-xl px-4 font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-base text-slate-700 dark:text-slate-300">{message}</div>
    </Modal>
  );
}
