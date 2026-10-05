import { BookOpen, CheckCircle2, Dumbbell, Moon, XCircle } from 'lucide-react';
import { StatTile } from '../common/Card';
import { ProgressBar } from '../common/Progress';
import type { DayStats } from '../../utils/calculations';
import { formatHours, formatMinutes } from '../../utils/date';

interface Props {
  stats: DayStats;
  sleepTargetMinutes: number;
  sleepHours?: number;
  onLogSleep: () => void;
}

export function TodayStats({ stats, sleepTargetMinutes, sleepHours, onLogSleep }: Props) {
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
        <div className="mt-3">
          <ProgressBar value={pct} label="Today’s completion" showValue={false} tone="green" />
        </div>
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
              <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <XCircle size={22} aria-hidden /> Not completed
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
