import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PomodoroPreset, TimerMode, TimerState } from '../types/study';
import { TimerContext } from './contexts';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { TIMER_KEY } from '../utils/storage';
import {
  IDLE_TIMER,
  elapsedMs,
  focusedMinutes,
  pauseTimer,
  pomodoroInfo,
  resumeTimer,
  sanitizeTimer,
  startTimer,
} from '../utils/timer';

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available */
  }
}

function notify(text: string) {
  try {
    navigator.vibrate?.(300);
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Kiran Planner', { body: text });
  } catch {
    /* notifications are optional */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<TimerState>(TIMER_KEY, IDLE_TIMER, (raw) => sanitizeTimer(raw, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const lastPhase = useRef<string | null>(null);

  // Tick once per second while running. Time is derived from timestamps,
  // so a throttled background tab still shows the right value when it wakes.
  useEffect(() => {
    if (state.status !== 'running') return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.status]);

  const elapsed = elapsedMs(state, now);
  const pomodoro = state.mode === 'pomodoro' && state.status !== 'idle' ? pomodoroInfo(elapsed, state.preset) : null;

  // Pomodoro phase change → sound + notification.
  const phaseKey = pomodoro ? `${pomodoro.phase}-${pomodoro.cycle}` : null;
  useEffect(() => {
    if (phaseKey && lastPhase.current && lastPhase.current !== phaseKey && state.status === 'running') {
      beep();
      notify(pomodoro?.phase === 'break' ? 'Focus block done – take a break.' : 'Break over – back to focus.');
    }
    lastPhase.current = phaseKey;
  }, [phaseKey, pomodoro?.phase, state.status]);

  const safe = useCallback(
    (fn: () => void) => {
      try {
        setError(null);
        fn();
      } catch {
        setError('The timer hit a problem and was reset.');
        setState(IDLE_TIMER);
      }
    },
    [setState],
  );

  const start = useCallback(
    (mode: TimerMode, preset: PomodoroPreset) =>
      safe(() => {
        setState(startTimer(mode, preset, Date.now()));
        if (mode === 'pomodoro' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => undefined);
        }
      }),
    [safe, setState],
  );
  const pause = useCallback(() => safe(() => setState((s) => pauseTimer(s, Date.now()))), [safe, setState]);
  const resume = useCallback(() => safe(() => setState((s) => resumeTimer(s, Date.now()))), [safe, setState]);
  const discard = useCallback(() => safe(() => setState(IDLE_TIMER)), [safe, setState]);
  const stop = useCallback(() => {
    const minutes = focusedMinutes(state, Date.now());
    setState(IDLE_TIMER);
    return minutes;
  }, [state, setState]);
  // Finish only pauses: the session (saved in storage) stays until it is saved or discarded,
  // so closing the save sheet, a reload or iOS closing the app can't lose it.
  const finish = useCallback(() => {
    const t = Date.now();
    const minutes = focusedMinutes(state, t);
    setState((s) => pauseTimer(s, t));
    return minutes;
  }, [state, setState]);
  const restore = useCallback((saved: TimerState) => safe(() => setState(saved)), [safe, setState]);

  const value = useMemo(
    () => ({
      state,
      elapsed,
      studyMs: state.mode === 'pomodoro' ? (pomodoro?.focusMs ?? 0) : elapsed,
      pomodoro,
      error,
      start,
      pause,
      resume,
      stop,
      finish,
      discard,
      restore,
    }),
    [state, elapsed, pomodoro, error, start, pause, resume, stop, finish, discard, restore],
  );
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}
