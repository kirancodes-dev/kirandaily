import { describe, expect, it } from 'vitest';
import { elapsedMs, formatClock, pauseTimer, pomodoroInfo, resumeTimer, sanitizeTimer, startTimer, studyMsForTimer, IDLE_TIMER } from './timer';

const MIN = 60_000;

describe('timer', () => {
  it('tracks elapsed time with pause and resume using timestamps', () => {
    let t = startTimer('stopwatch', { focus: 25, break: 5 }, 0);
    expect(formatClock(elapsedMs(t, 0))).toBe('00:00:00');
    t = pauseTimer(t, 10 * MIN);
    expect(elapsedMs(t, 99 * MIN)).toBe(10 * MIN); // paused time doesn't count
    t = resumeTimer(t, 100 * MIN);
    expect(elapsedMs(t, 105 * MIN)).toBe(15 * MIN);
    // Tab was asleep for an hour: still correct.
    expect(formatClock(elapsedMs(t, 165 * MIN))).toBe('01:15:00');
  });

  it('computes pomodoro phases and counts only focus time', () => {
    const p = { focus: 25, break: 5 };
    expect(pomodoroInfo(0, p)).toMatchObject({ phase: 'focus', cycle: 0, phaseRemainingMs: 25 * MIN, focusMs: 0 });
    expect(pomodoroInfo(27 * MIN, p)).toMatchObject({ phase: 'break', cycle: 1, phaseRemainingMs: 3 * MIN, focusMs: 25 * MIN });
    expect(pomodoroInfo(65 * MIN, p)).toMatchObject({ phase: 'focus', cycle: 2, focusMs: 55 * MIN });
    const t = startTimer('pomodoro', { focus: 50, break: 10 }, 0);
    expect(studyMsForTimer(t, 70 * MIN)).toBe(60 * MIN);
  });

  it('recovers from corrupted timer state', () => {
    expect(sanitizeTimer('garbage', 0)).toEqual(IDLE_TIMER);
    expect(sanitizeTimer({ status: 'running', mode: 'stopwatch', preset: { focus: 25, break: 5 }, accumulatedMs: -5 }, 0)).toEqual(IDLE_TIMER);
    const old = startTimer('stopwatch', { focus: 25, break: 5 }, 0);
    expect(sanitizeTimer(old, 30 * 3600_000).status).toBe('paused');
  });
});
