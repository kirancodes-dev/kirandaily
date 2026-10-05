import { useCallback, useMemo } from 'react';
import type { DayLog } from '../types/task';
import { useAppData } from './useAppData';

export function useDayLog(date: string) {
  const { data, update } = useAppData();
  const log = useMemo(() => data.dayLogs.find((l) => l.date === date), [data.dayLogs, date]);
  const save = useCallback(
    (patch: Partial<Omit<DayLog, 'date'>>) =>
      update((d) => {
        const current = d.dayLogs.find((l) => l.date === date) ?? { date };
        const next: DayLog = { ...current, ...patch };
        const empty = next.sleepHours === undefined && !next.special;
        const others = d.dayLogs.filter((l) => l.date !== date);
        return { ...d, dayLogs: empty ? others : [...others, next] };
      }),
    [update, date],
  );
  return { log, save };
}
