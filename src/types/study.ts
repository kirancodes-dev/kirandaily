import type { CategoryId } from './task';

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD (day the session started)
  category: CategoryId;
  topic: string;
  /** Focused minutes (rounded to whole minutes, min 1). */
  minutes: number;
  startedAt: string; // ISO
  source: 'timer' | 'pomodoro' | 'manual';
  /** Task completed together with this session (its planned time is then not counted twice). */
  taskId?: string;
  subjectId?: string;
}

export type TimerMode = 'stopwatch' | 'pomodoro';

export interface PomodoroPreset {
  focus: number; // minutes
  break: number; // minutes
}

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  mode: TimerMode;
  preset: PomodoroPreset;
  /** Wall-clock ms when the session was first started. */
  startedAt: number | null;
  /** Wall-clock ms when the current running segment began. */
  segmentStart: number | null;
  /** Running time (ms) accumulated before the current segment. */
  accumulatedMs: number;
}
