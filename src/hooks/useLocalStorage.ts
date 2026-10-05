import { useCallback, useEffect, useState } from 'react';

/**
 * Small typed localStorage hook for UI preferences and the running timer.
 * `validate` turns whatever is stored into a safe value (corrupted entries never crash).
 */
export function useLocalStorage<T>(key: string, fallback: T, validate: (raw: unknown) => T = (raw) => raw as T) {
  const read = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : validate(JSON.parse(raw));
    } catch {
      return fallback;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / private mode errors */
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, read]);

  return [value, setValue] as const;
}
