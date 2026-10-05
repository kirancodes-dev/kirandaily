import { Award, BookOpen, Check, CheckCircle2, Code2, Coffee, Crown, Dumbbell, Flame, GraduationCap, Languages, Lock, Star, Sunrise } from 'lucide-react';
import { Card } from '../common/Card';
import type { Badge, BadgeIcon, BadgeTone } from '../../utils/gamification';

const ICONS: Record<BadgeIcon, typeof Award> = {
  check: Check,
  flame: Flame,
  dumbbell: Dumbbell,
  book: BookOpen,
  graduation: GraduationCap,
  code: Code2,
  coffee: Coffee,
  languages: Languages,
  star: Star,
  crown: Crown,
  sunrise: Sunrise,
};

/** Full class names (Tailwind needs them literally). */
const TONES: Record<BadgeTone, { icon: string; card: string }> = {
  emerald: { icon: 'bg-emerald-500 text-white', card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' },
  orange: { icon: 'bg-orange-500 text-white', card: 'border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10' },
  rose: { icon: 'bg-rose-500 text-white', card: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10' },
  red: { icon: 'bg-red-500 text-white', card: 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' },
  indigo: { icon: 'bg-indigo-500 text-white', card: 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10' },
  violet: { icon: 'bg-violet-500 text-white', card: 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10' },
  fuchsia: { icon: 'bg-fuchsia-500 text-white', card: 'border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10' },
  teal: { icon: 'bg-teal-500 text-white', card: 'border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10' },
  sky: { icon: 'bg-sky-500 text-white', card: 'border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10' },
  amber: { icon: 'bg-amber-500 text-white', card: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' },
};

/** The locked badge you're closest to. */
function nextUp(badges: Badge[]): Badge | undefined {
  return badges
    .filter((b) => !b.unlocked)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
}

export function BadgesCard({ badges }: { badges: Badge[] }) {
  const unlocked = badges.filter((b) => b.unlocked).length;
  const next = nextUp(badges);
  return (
    <Card
      title="Badges"
      icon={<Award size={20} className="text-amber-500" aria-hidden />}
      actions={
        <span className="text-sm font-medium tabular-nums text-slate-600 dark:text-slate-400">
          {unlocked} of {badges.length} unlocked
        </span>
      }
    >
      {next && (
        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span className="font-semibold">Next up:</span> {next.name} <span className="tabular-nums">({next.progressLabel})</span> — {next.description}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {badges.map((b) => {
          const Icon = ICONS[b.icon];
          const tone = TONES[b.tone];
          const pct = Math.min(100, Math.round((b.current / b.target) * 100));
          return (
            <li
              key={b.id}
              data-badge={b.id}
              className={`flex min-w-0 flex-col rounded-xl border p-3 ${
                b.unlocked ? tone.card : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    b.unlocked ? `${tone.icon} shadow-sm` : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  <Icon size={20} aria-hidden />
                  {!b.unlocked && (
                    <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white ring-2 ring-white dark:bg-slate-600 dark:ring-slate-900">
                      <Lock size={9} aria-hidden />
                    </span>
                  )}
                </span>
                <p className={`min-w-0 font-semibold leading-tight ${b.unlocked ? '' : 'text-slate-600 dark:text-slate-400'}`}>{b.name}</p>
              </div>
              <p className="mt-1.5 flex-1 text-xs leading-snug text-slate-600 dark:text-slate-400">{b.description}</p>
              {b.unlocked ? (
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={16} aria-hidden /> Unlocked
                </p>
              ) : (
                <div className="mt-2">
                  <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-slate-400 dark:bg-slate-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-400">
                    <span className="sr-only">Locked, progress </span>
                    {b.progressLabel}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
