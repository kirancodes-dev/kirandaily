import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types/app';
import { createDefaultData } from '../data/defaultData';
import { loadData, saveData, STORAGE_KEY, localStorageAdapter, type StorageAdapter } from '../utils/storage';
import { buildStatsContext } from '../utils/calculations';
import { AppDataContext } from './contexts';

export function AppDataProvider({ children, adapter = localStorageAdapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const initial = useRef<ReturnType<typeof loadData> | null>(null);
  if (initial.current === null) initial.current = loadData(adapter);
  const [data, setData] = useState<AppData>(initial.current.data);
  const [warnings, setWarnings] = useState<string[]>(initial.current.warnings);
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipSave = useRef(false);

  // Persist every change.
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaveError(saveData(data, adapter));
  }, [data, adapter]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      const result = loadData(adapter);
      skipSave.current = true;
      setData(result.data);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [adapter]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const replace = useCallback((next: AppData) => setData(next), []);
  const reset = useCallback(() => setData(createDefaultData()), []);
  const dismissWarnings = useCallback(() => setWarnings([]), []);
  const stats = useMemo(() => buildStatsContext(data), [data]);

  const value = useMemo(
    () => ({ data, stats, update, replace, reset, warnings, dismissWarnings, saveError }),
    [data, stats, update, replace, reset, warnings, dismissWarnings, saveError],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
