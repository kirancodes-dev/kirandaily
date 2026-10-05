import { useContext } from 'react';
import { TimerContext } from '../state/contexts';

/** Study session timer (stopwatch or Pomodoro). Shared across pages, survives refresh. */
export function useStudyTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useStudyTimer must be used inside <TimerProvider>');
  return ctx;
}
