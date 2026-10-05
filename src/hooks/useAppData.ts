import { useContext } from 'react';
import { AppDataContext } from '../state/contexts';

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
