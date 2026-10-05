import { useMemo } from 'react';
import { useAppData } from '../../hooks/useAppData';
import { computeActivity } from '../../utils/gamification';

/** XP, level, totals and badges up to `today` (recomputed only when the data changes). */
export function useActivity(today: string) {
  const { stats } = useAppData();
  return useMemo(() => computeActivity(stats, today), [stats, today]);
}
