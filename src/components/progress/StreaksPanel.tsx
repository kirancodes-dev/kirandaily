import { Flame, Trophy } from 'lucide-react';
import { Card } from '../common/Card';
import { useStreaks } from '../../hooks/useProgress';
import { STREAK_LABELS, STREAK_RULES, type StreakKind } from '../../utils/streaks';

export function StreaksPanel({ today }: { today: string }) {
  const streaks = useStreaks(today);
  return (
    <Card title="Streaks" icon={<Flame size={20} className="text-orange-500" aria-hidden />}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(streaks) as StreakKind[]).map((k) => (
          <li key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="font-medium">{STREAK_LABELS[k]}</p>
            <p className="text-2xl font-bold tabular-nums">
              {streaks[k].current} <span className="text-sm font-normal">day{streaks[k].current === 1 ? '' : 's'}</span>
            </p>
            <p className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
              <Trophy size={14} aria-hidden /> Longest: {streaks[k].longest}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{STREAK_RULES[k]}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        One missed day never breaks a streak — only two in a row do. Special days (birthdays, parties, outings) are ignored.
      </p>
    </Card>
  );
}
