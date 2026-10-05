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

export interface SyncValue {
  /** Firebase config is filled in (src/config/firebase.ts). */
  configured: boolean;
  /** Firebase finished loading and the sign-in state is known. */
  ready: boolean;
  user: import('../sync/firebaseBackend').CloudUser | null;
  status: import('../sync/engine').SyncStatus;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => void;
  resolveChoice: (choice: import('../sync/engine').SyncChoice) => void;
  signInError: string | null;
  clearSignInError: () => void;
}

export const SyncContext = createContext<SyncValue | null>(null);

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastInput {
  /** Same id replaces an existing toast (no duplicates). */
  id?: string;
  title: string;
  body?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it hides; 0 = stays until dismissed. Default 5000. */
  duration?: number;
}

export interface ToastValue {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastValue | null>(null);
