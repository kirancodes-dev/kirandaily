import { createContext } from 'react';
import type { AppData } from '../types/app';
import type { StatsContext } from '../utils/calculations';
import type { PomodoroPreset, TimerMode, TimerState } from '../types/study';
import type { PomodoroInfo } from '../utils/timer';

export interface AppDataValue {
  data: AppData;
  /** Statistics lookups for the current data (rebuilt on every change). */
  stats: StatsContext;
  update: (fn: (data: AppData) => AppData) => void;
  replace: (data: AppData) => void;
  reset: () => void;
  /** Problems found while loading (corrupted storage etc.). */
  warnings: string[];
  dismissWarnings: () => void;
  saveError: string | null;
}

export const AppDataContext = createContext<AppDataValue | null>(null);

export interface TimerValue {
  state: TimerState;
  elapsed: number;
  studyMs: number;
  pomodoro: PomodoroInfo | null;
  error: string | null;
  start: (mode: TimerMode, preset: PomodoroPreset) => void;
  pause: () => void;
  resume: () => void;
  /** Stops the timer and returns the focused minutes to record. */
  stop: () => number;
  discard: () => void;
}

export const TimerContext = createContext<TimerValue | null>(null);
