import { BookOpen, CheckCircle2, Code2, Dumbbell, Flame, Languages, Zap } from 'lucide-react';
import { StatTile } from '../common/Card';
import { formatHours } from '../../utils/date';
import { XP_RULES, type ActivitySummary } from '../../utils/gamification';
import { scheduleConfig } from '../../config/schedule';

const fmt = (n: number) => n.toLocaleString('en-US');

/** Level card + the numbers that matter, all from real data. */
export function ProfileStats({ activity }: { activity: ActivitySummary }) {
  const { level, totals, streak, todayXp } = activity;
  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="sr-only">
        Your stats
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 rounded-2xl bg-gradient-to-br sm:col-span-3 lg:col-span-2 lg:row-span-2 from-brand-600 to-indigo-800 p-4 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-brand-100">
                <Zap size={16} aria-hidden className="fill-current" /> Level
              </p>
              <p className="text-4xl font-bold tabular-nums">{level.level}</p>
              <p className="font-semibold">{level.title}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{fmt(level.xp)} XP</p>
              <p className="text-sm text-brand-100">+{fmt(todayXp.total)} today</p>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress to level ${level.level + 1}`}
            aria-valuenow={level.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/20"
          >
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-emerald-400" style={{ width: `${level.pct}%` }} />
          </div>
          <p className="mt-1 text-sm tabular-nums text-brand-100">
            {fmt(level.xpIntoLevel)} / {fmt(level.xpForNext)} XP · {fmt(level.xpToNext)} to level {level.level + 1}
          </p>
          <details className="mt-2 text-sm">
            <summary className="inline-flex min-h-touch cursor-pointer items-center font-medium text-white underline decoration-white/40 underline-offset-4">
              How to earn XP
            </summary>
            <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-brand-50 sm:grid-cols-2">
              <li>+{XP_RULES.task} per task done (+{XP_RULES.highPriority} if high priority)</li>
              <li>+1 per {XP_RULES.studyMinutesPerXp} study minutes</li>
              <li>
                +{XP_RULES.streakDay} per streak day ({scheduleConfig.streakDayThreshold}%+)
              </li>
              <li>+{XP_RULES.perfectDay} bonus for a perfect day (100%)</li>
              <li>+{XP_RULES.dsaProblem} per DSA problem</li>
              <li>+1 per {XP_RULES.germanWordsPerXp} German words</li>
            </ul>
            <p className="mt-1 text-brand-100">Only finished work counts — nothing in the future, nothing ticked early.</p>
          </details>
        </div>

        <StatTile icon={<BookOpen size={16} aria-hidden />} label="Study" value={`${formatHours(totals.studyMinutes)} h`} hint="in total" />
        <StatTile
          icon={<CheckCircle2 size={16} aria-hidden />}
          label="Tasks done"
          value={fmt(totals.tasksCompleted)}
          hint={`${totals.activeDays} active day${totals.activeDays === 1 ? '' : 's'}`}
        />
        <StatTile
          icon={<Flame size={16} aria-hidden className="text-orange-500" />}
          label="Day streak"
          value={`${streak.current} day${streak.current === 1 ? '' : 's'}`}
          hint={`Best ${streak.longest}`}
        />
        <StatTile icon={<Dumbbell size={16} aria-hidden />} label="Gym days" value={fmt(totals.gymDays)} />
        <StatTile icon={<Code2 size={16} aria-hidden />} label="DSA problems" value={fmt(totals.dsaProblems)} />
        <StatTile icon={<Languages size={16} aria-hidden />} label="German words" value={fmt(totals.germanWords)} />
      </div>
    </section>
  );
}
