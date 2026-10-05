import type { PomodoroPreset, TimerState } from '../types/study';

export const IDLE_TIMER: TimerState = {
  status: 'idle',
  mode: 'stopwatch',
  preset: { focus: 25, break: 5 },
  startedAt: null,
  segmentStart: null,
  accumulatedMs: 0,
};

/** Total running time. Based on wall-clock timestamps, so it stays correct while the tab sleeps. */
export function elapsedMs(state: TimerState, now: number): number {
  const running = state.status === 'running' && state.segmentStart !== null ? now - state.segmentStart : 0;
  return Math.max(0, state.accumulatedMs + Math.max(0, running));
}

export function startTimer(mode: TimerState['mode'], preset: PomodoroPreset, now: number): TimerState {
  return { status: 'running', mode, preset, startedAt: now, segmentStart: now, accumulatedMs: 0 };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', accumulatedMs: elapsedMs(state, now), segmentStart: null };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'running', segmentStart: now };
}

export interface PomodoroInfo {
  phase: 'focus' | 'break';
  /** Completed focus blocks. */
  cycle: number;
  phaseRemainingMs: number;
  /** Focus time only (breaks are not study time). */
  focusMs: number;
}

/** Pomodoro phase is a pure function of running time: focus, break, focus, break… */
export function pomodoroInfo(elapsed: number, preset: PomodoroPreset): PomodoroInfo {
  const focus = Math.max(1, preset.focus) * 60_000;
  const brk = Math.max(0, preset.break) * 60_000;
  const cycleLen = focus + brk;
  const cycles = Math.floor(elapsed / cycleLen);
  const within = elapsed - cycles * cycleLen;
  const inFocus = within < focus;
  return {
    phase: inFocus ? 'focus' : 'break',
    cycle: cycles + (inFocus ? 0 : 1),
    phaseRemainingMs: inFocus ? focus - within : cycleLen - within,
    focusMs: cycles * focus + Math.min(within, focus),
  };
}

/** Study time a timer session should record. */
export function studyMsForTimer(state: TimerState, now: number): number {
  const elapsed = elapsedMs(state, now);
  return state.mode === 'pomodoro' ? pomodoroInfo(elapsed, state.preset).focusMs : elapsed;
}

/** ms → "HH:MM:SS" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Validates a timer restored from storage; anything odd resets to idle. */
export function sanitizeTimer(value: unknown, now: number): TimerState {
  if (!value || typeof value !== 'object') return IDLE_TIMER;
  const v = value as Partial<TimerState>;
  const okStatus = v.status === 'idle' || v.status === 'running' || v.status === 'paused';
  const okMode = v.mode === 'stopwatch' || v.mode === 'pomodoro';
  const okPreset =
    !!v.preset && Number.isFinite(v.preset.focus) && v.preset.focus > 0 && Number.isFinite(v.preset.break) && v.preset.break >= 0;
  if (!okStatus || !okMode || !okPreset || typeof v.accumulatedMs !== 'number' || v.accumulatedMs < 0) return IDLE_TIMER;
  if (v.status === 'running' && (typeof v.segmentStart !== 'number' || v.segmentStart > now + 60_000)) return IDLE_TIMER;
  // A session older than 24 h is almost certainly forgotten; keep it but paused.
  const state = v as TimerState;
  if (state.status === 'running' && elapsedMs(state, now) > 24 * 3_600_000) return pauseTimer(state, now);
  return state;
}
