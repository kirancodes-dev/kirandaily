import { BookOpen, CheckCircle2, Dumbbell, Flame, Moon, XCircle } from 'lucide-react';
import { StatTile } from '../common/Card';
import { ProgressBar } from '../common/Progress';
import type { DayStats } from '../../utils/calculations';
import { formatHours, formatMinutes } from '../../utils/date';
import { isStreakDay, tasksToStreakDay, type StreakResult } from '../../utils/streaks';
import { scheduleConfig } from '../../config/schedule';

interface Props {
  stats: DayStats;
  sleepTargetMinutes: number;
  sleepHours?: number;
  onLogSleep: () => void;
  /** Current Day streak (only shown for today). */
  streak?: StreakResult;
  isToday: boolean;
}

const THRESHOLD = scheduleConfig.streakDayThreshold;

export function TodayStats({ stats, sleepTargetMinutes, sleepHours, onLogSleep, streak, isToday }: Props) {
  const pct = stats.completionPct ?? 0;
  const studyPct = stats.targetMinutes ? (stats.studyMinutes / stats.targetMinutes) * 100 : 0;
  return (
    <section aria-label="Today at a glance" className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Today’s completion</p>
            <p className="text-4xl font-bold tabular-nums">{stats.completionPct === null ? '—' : `${pct}%`}</p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {stats.completed} of {stats.total - stats.skipped} tasks
            {stats.skipped > 0 && ` · ${stats.skipped} skipped`}
          </p>
        </div>
        <div className="relative mt-3">
          <ProgressBar value={pct} label="Today’s completion" showValue={false} tone="green" />
          {/* Marker at the streak threshold */}
          <span
            aria-hidden
            className="absolute -top-1 h-4 w-0.5 rounded bg-orange-500"
            style={{ left: `${THRESHOLD}%` }}
          />
        </div>
        <StreakLine stats={stats} streak={streak} isToday={isToday} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={<BookOpen size={16} aria-hidden />}
          label="Study target"
          value={`${formatHours(stats.targetMinutes)} h`}
          hint={`${formatHours(stats.studyMinutes)} h done`}
        />
        <StatTile
          icon={<BookOpen size={16} aria-hidden />}
          label="Study completed"
          value={formatMinutes(stats.studyMinutes)}
          hint={<ProgressBar value={studyPct} label="Study target progress" showValue={false} size="sm" />}
        />
        <StatTile
          icon={<Dumbbell size={16} aria-hidden />}
          label="Gym"
          value={
            stats.gymDone ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={22} aria-hidden /> Done
              </span>
            ) : (
              // Wraps onto two lines in a narrow phone tile instead of spilling out.
              <span className="flex items-center gap-1 text-xl leading-tight text-slate-700 sm:text-2xl dark:text-slate-300">
                <XCircle size={22} aria-hidden className="shrink-0" /> <span className="min-w-0">Not completed</span>
              </span>
            )
          }
        />
        <button
          type="button"
          onClick={onLogSleep}
          className="rounded-2xl text-left focus-visible:outline"
          aria-label={`Sleep: ${formatHours(sleepTargetMinutes)} hours target${sleepHours !== undefined ? `, logged ${sleepHours} hours` : ''}. Log sleep`}
        >
          <StatTile
            icon={<Moon size={16} aria-hidden />}
            label="Sleep"
            value={`${formatHours(sleepTargetMinutes)} h target`}
            hint={sleepHours !== undefined ? `Slept ${sleepHours} h · edit` : 'Tap to log last night'}
          />
        </button>
      </div>
    </section>
  );
}

function StreakLine({ stats, streak, isToday }: Pick<Props, 'stats' | 'streak' | 'isToday'>) {
  if (stats.completionPct === null) return null;
  const counted = isStreakDay(stats);
  const left = tasksToStreakDay(stats);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      {streak && (
        <p className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-300">
          <Flame size={18} aria-hidden />
          {streak.current}-day streak
          <span className="font-normal text-slate-600 dark:text-slate-400">· best {streak.longest}</span>
        </p>
      )}
      <p role="status" className={counted ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
        {counted
          ? `✓ ${isToday ? 'Today counts' : 'This day counted'} for your streak (${THRESHOLD}%+)`
          : `${left} more task${left === 1 ? '' : 's'} to reach ${THRESHOLD}%${isToday ? ' and keep the streak' : ''}`}
      </p>
    </div>
  );
}
