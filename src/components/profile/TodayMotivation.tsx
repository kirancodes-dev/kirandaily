import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Quote as QuoteIcon, Sparkles, X, Zap } from 'lucide-react';
import { useDayStats } from '../../hooks/useProgress';
import { useToast } from '../../hooks/useToast';
import { useActivity } from './useActivity';
import { quoteForDate } from '../../utils/quotes';
import { celebrationKey, dayFlags, nextCelebration, parseCelebrated, XP_RULES, type Celebration } from '../../utils/gamification';
import { scheduleConfig } from '../../config/schedule';

/** Today-only card: daily quote, level + XP earned today, and a once-a-day celebration. */
export function TodayMotivation({ date, today }: { date: string; today: string }) {
  if (date !== today) return null;
  return <MotivationCard key={today} today={today} />;
}

function readCelebrated(date: string): Celebration | null {
  try {
    return parseCelebrated(localStorage.getItem(celebrationKey(date)));
  } catch {
    return null;
  }
}

function writeCelebrated(date: string, c: Celebration) {
  try {
    localStorage.setItem(celebrationKey(date), c);
  } catch {
    /* private mode etc. — worst case it celebrates again */
  }
}

const MESSAGES: Record<Celebration, { title: string; body: string }> = {
  streak: {
    title: '🔥 Streak day secured!',
    body: `${scheduleConfig.streakDayThreshold}% of today’s tasks done — today counts for your Day streak (+${XP_RULES.streakDay} XP).`,
  },
  perfect: {
    title: 'Perfect day! 🎉',
    body: `Every task done today. That’s +${XP_RULES.perfectDay} bonus XP.`,
  },
};

function MotivationCard({ today }: { today: string }) {
  const stats = useDayStats(today);
  const activity = useActivity(today);
  const { toast } = useToast();
  const quote = quoteForDate(today);
  const { streak, perfect } = dayFlags(stats);
  // Starts "not reached" so a day secured elsewhere (week view, a reminder's "Mark done")
  // is still celebrated when Today opens — the stored key keeps it to once per day.
  const prev = useRef({ streak: false, perfect: false });
  const [party, setParty] = useState<Celebration | null>(null);

  // Celebrate when today's completion reaches 80 % / 100 % — once per day (per device).
  useEffect(() => {
    const before = prev.current;
    const now = { streak, perfect };
    prev.current = now;
    const next = nextCelebration(before, now, readCelebrated(today));
    if (!next) return;
    writeCelebrated(today, next);
    setParty(next);
    toast({ id: 'kp-celebration', title: MESSAGES[next].title, body: MESSAGES[next].body, tone: 'success', duration: 6000 });
  }, [streak, perfect, today, toast]);

  const { level } = activity;
  const xpToday = activity.todayXp.total;

  return (
    <section
      aria-label="Daily motivation"
      className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-emerald-50 p-4 shadow-sm dark:border-brand-500/30 dark:from-brand-500/15 dark:via-slate-900 dark:to-emerald-500/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Link
          to="/profile"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-full bg-brand-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          aria-label={`Level ${level.level}, ${level.title}. ${level.xpToNext} XP to level ${level.level + 1}. Open your profile`}
        >
          <Zap size={16} aria-hidden className="fill-current" />
          Level {level.level} · {level.title}
        </Link>
        <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          <Sparkles size={16} aria-hidden />+{xpToday} XP today
        </span>
      </div>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-label={`Progress to level ${level.level + 1}`}
          aria-valuenow={level.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-slate-700"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${level.pct}%` }} />
        </div>
        <p className="mt-1 text-xs tabular-nums text-slate-600 dark:text-slate-400">
          {level.xpIntoLevel} / {level.xpForNext} XP · {level.xpToNext} to level {level.level + 1}
        </p>
      </div>

      <figure className="mt-3 flex gap-2">
        <QuoteIcon size={18} aria-hidden className="mt-0.5 shrink-0 text-brand-500 dark:text-brand-300" />
        <blockquote className="text-[15px] font-medium leading-snug text-slate-800 dark:text-slate-200">{quote.text}</blockquote>
      </figure>

      {party && <CelebrationBanner kind={party} onDismiss={() => setParty(null)} />}
    </section>
  );
}

/* ───────────────────────── celebration ───────────────────────── */

const CONFETTI_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];
const PIECES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 60,
  dx: ((i * 53) % 80) - 40,
  rot: ((i * 97) % 540) - 270,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

const CELEBRATION_CSS = `
@keyframes kp-confetti-fall {
  0% { transform: translate3d(0, -12px, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--dx), 180px, 0) rotate(var(--rot)); opacity: 0; }
}
@keyframes kp-glow {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); }
  100% { box-shadow: 0 0 0 16px rgba(16, 185, 129, 0); }
}
.kp-confetti-piece { position: absolute; top: 0; width: 7px; height: 11px; border-radius: 2px; opacity: 0;
  animation: kp-confetti-fall 1.7s cubic-bezier(.2,.6,.35,1) forwards; }
.kp-glow { animation: kp-glow 1.1s ease-out 2; }
@media (prefers-reduced-motion: reduce) {
  .kp-confetti-piece { display: none; }
  .kp-glow { animation: none; }
}`;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function CelebrationBanner({ kind, onDismiss }: { kind: Celebration; onDismiss: () => void }) {
  const [calm] = useState(prefersReducedMotion);
  const msg = MESSAGES[kind];
  return (
    <>
      <style>{CELEBRATION_CSS}</style>
      {!calm && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {PIECES.map((p, i) => (
            <span
              key={i}
              className="kp-confetti-piece"
              style={
                {
                  left: `${p.left}%`,
                  background: p.color,
                  borderRadius: p.round ? '999px' : undefined,
                  animationDelay: `${p.delay}ms`,
                  '--dx': `${p.dx}px`,
                  '--rot': `${p.rot}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div
        data-testid="celebration"
        className={`kp-glow relative mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-white shadow-sm ${
          kind === 'perfect' ? 'bg-gradient-to-r from-amber-500 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-emerald-600'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="font-bold">{msg.title}</p>
          <p className="text-sm text-white/90">{msg.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss celebration"
          className="-my-1 -mr-2 inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-white/90 hover:bg-white/15"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </>
  );
}
