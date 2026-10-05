import { useContext } from 'react';
import { SyncContext } from '../state/contexts';

/** Cloud sync state (Google sign-in + Firestore). */
export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
