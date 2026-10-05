import { useContext } from 'react';
import { ToastContext } from '../state/contexts';

/** Show short pop-up messages: toast({ title, body, tone, action }). */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
