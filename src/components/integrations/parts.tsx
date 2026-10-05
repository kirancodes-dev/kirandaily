import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, CloudOff, ExternalLink as ExternalIcon, Pencil, RefreshCw } from 'lucide-react';
import { Button, IconButton } from '../common/Button';
import { TextField } from '../common/Fields';
import { useAppData } from '../../hooks/useAppData';
import { useExtras } from '../../hooks/useExtras';
import { useToast } from '../../hooks/useToast';
import type { CodingStatsState } from '../../hooks/useCodingStats';
import { browserStorage, formatAgo, pruneCache, restoreCache } from '../../utils/integrations/cache';
import { percentShares } from '../../utils/integrations/leetcode';
import { normalizeUsername, SERVICE_NAMES, type Service } from '../../utils/integrations/usernames';

/** Shared building blocks for the GitHub and LeetCode cards. */

export function IntegrationCard({
  title,
  icon,
  actions,
  busy,
  children,
  testId,
  level = 2,
}: {
  title: ReactNode;
  icon: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  children: ReactNode;
  testId?: string;
  /** Heading level of the title (3 when the cards sit under a "Coding profiles" heading). */
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <section
      aria-busy={busy || undefined}
      data-testid={testId}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Heading className="flex min-w-0 items-center gap-2 text-lg font-semibold">
          {icon}
          <span className="truncate">{title}</span>
        </Heading>
        {actions && <div className="-my-2 -mr-2 flex shrink-0 items-center">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Link to an outside site, always in a new tab without access back to this app. */
export function ExternalLink({ href, children, className = '', icon = true }: { href: string; children: ReactNode; className?: string; icon?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${className}`}>
      {children}
      {icon && <ExternalIcon size={14} className="shrink-0 opacity-70" aria-hidden />}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function CardActions({
  service,
  loading,
  onRefresh,
  onEdit,
}: {
  service: Service;
  loading: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
}) {
  const name = SERVICE_NAMES[service];
  return (
    <>
      {onRefresh && (
        <IconButton label={loading ? `Refreshing ${name} stats` : `Refresh ${name} stats`} onClick={onRefresh} aria-busy={loading || undefined}>
          <RefreshCw size={18} aria-hidden className={loading ? 'motion-safe:animate-spin' : ''} />
        </IconButton>
      )}
      {onEdit && (
        <IconButton label={`Change ${name} username`} onClick={onEdit}>
          <Pencil size={18} aria-hidden />
        </IconButton>
      )}
    </>
  );
}

/**
 * "Updated 3 h ago", or why the shown data may be old. Only the state ("Updated",
 * "Refreshing…", "Offline", the error) is a live region; the age next to it ticks every
 * minute and would otherwise be read out by VoiceOver each time.
 */
export function StatusLine<T>({ state, now, onRetry }: { state: CodingStatsState<T>; now: number; onRetry: () => void }) {
  const age =
    state.fetchedAt !== null ? (
      <time dateTime={new Date(state.fetchedAt).toISOString()}>{formatAgo(state.fetchedAt, now)}</time>
    ) : null;
  let live: ReactNode;
  let rest: ReactNode = null;
  let icon: ReactNode = null;
  let tone = '';
  if (state.loading) {
    icon = <RefreshCw size={14} aria-hidden className="mt-0.5 shrink-0 motion-safe:animate-spin" />;
    live = 'Refreshing…';
    rest = age && <> (showing data from {age})</>;
  } else if (state.offline) {
    icon = <CloudOff size={14} aria-hidden className="mt-0.5 shrink-0" />;
    live = 'Offline ·';
    rest = age && <> Updated {age}</>;
  } else if (state.error) {
    icon = <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />;
    tone = 'text-amber-800 dark:text-amber-300';
    live = `Couldn’t refresh: ${state.error.message}`;
    rest = age && <> Showing data from {state.fetchedAt !== null && now - state.fetchedAt < 60_000 ? 'a moment ago' : age}.</>;
  } else {
    live = 'Updated';
    rest = age && <> {age}</>;
  }
  return (
    <div className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 ${tone}`}>
      <p className="flex items-start gap-1.5">
        {icon}
        <span>
          <span role="status">{live}</span>
          {rest}
        </span>
      </p>
      {state.error && !state.loading && !state.offline && (
        <button type="button" onClick={onRetry} className="min-h-touch rounded-lg px-2 font-semibold text-brand-700 underline dark:text-brand-300">
          Retry
        </button>
      )}
    </div>
  );
}

/** First load (nothing cached yet). Free APIs can take a while to wake up. */
const SKELETON = 'rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800';

export function LoadingBlock({ service, slow, compact }: { service: Service; slow: boolean; compact?: boolean }) {
  return (
    <div role="status" className="space-y-3">
      {service === 'github' ? (
        <div className="flex items-center gap-3" aria-hidden>
          <div className={`h-14 w-14 !rounded-full ${SKELETON}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 w-1/2 ${SKELETON}`} />
            <div className={`h-3 w-1/3 ${SKELETON}`} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4" aria-hidden>
          <div className={`h-10 w-20 rounded-lg ${SKELETON}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-2 w-3/4 ${SKELETON}`} />
            <div className={`h-2 w-1/2 ${SKELETON}`} />
            <div className={`h-2 w-1/4 ${SKELETON}`} />
          </div>
        </div>
      )}
      {!compact && <div className="h-24 rounded-xl bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800/70" aria-hidden />}
      <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
        <RefreshCw size={14} aria-hidden className="mt-1 shrink-0 motion-safe:animate-spin" />
        {slow
          ? service === 'leetcode'
            ? 'Waking up the free LeetCode stats service – the first load can take up to half a minute…'
            : 'Still loading – GitHub is slow to answer right now…'
          : `Loading your ${SERVICE_NAMES[service]} stats…`}
      </p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry, onEdit }: { message: string; onRetry: () => void; onEdit: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
      <p className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <span>{message}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" icon={<RefreshCw size={16} aria-hidden />} onClick={onRetry}>
          Retry
        </Button>
        <Button onClick={onEdit}>Change username</Button>
      </div>
    </div>
  );
}

export function OfflineBlock({ service }: { service: Service }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <CloudOff size={18} aria-hidden className="shrink-0" />
      You’re offline. Your {SERVICE_NAMES[service]} stats will load when you’re back online.
    </p>
  );
}

/**
 * Inline "Connect" form. Accepts a username, "@username" or a profile link and saves
 * the bare username to the profile links (the same field the Profile editor uses).
 */
export function ConnectForm({
  service,
  initial = '',
  onDone,
  onCancel,
  allowDisconnect,
}: {
  service: Service;
  initial?: string;
  onDone?: () => void;
  onCancel?: () => void;
  allowDisconnect?: boolean;
}) {
  const { profileExtra } = useExtras();
  const { update } = useAppData();
  const { toast } = useToast();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const name = SERVICE_NAMES[service];

  // Functional update so an Undo later never overwrites the other links with stale values.
  const save = (username: string) =>
    update((d) => ({ ...d, profileExtra: { ...d.profileExtra, links: { ...d.profileExtra.links, [service]: username } } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const username = normalizeUsername(value, service);
    if (!username) {
      setError(
        value.trim()
          ? `That doesn’t look like a ${name} username. Use letters, numbers, - or _ (or paste your profile link).`
          : `Enter your ${name} username.`,
      );
      return;
    }
    save(username);
    onDone?.();
  };

  const disconnect = () => {
    const previous = profileExtra.links[service];
    // Nothing of a disconnected account stays on the device; Undo puts it back.
    const removed = pruneCache(browserStorage(), service, null);
    save('');
    onDone?.();
    toast({
      id: `disconnect-${service}`,
      title: `${name} disconnected`,
      tone: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          restoreCache(browserStorage(), removed);
          save(previous);
        },
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate aria-label={`Connect ${name}`} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <TextField
          label={`${name} username`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={service === 'github' ? 'username or github.com/… link' : 'username or leetcode.com/u/… link'}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          error={error}
          className="flex-1"
        />
        <div className="flex gap-2 sm:mt-6">
          <Button type="submit" variant="primary" className="flex-1 sm:flex-none">
            Connect
          </Button>
          {onCancel && (
            <Button onClick={onCancel} className="flex-1 sm:flex-none">
              Cancel
            </Button>
          )}
        </div>
      </div>
      {allowDisconnect && (
        <button
          type="button"
          onClick={disconnect}
          className="min-h-touch rounded-lg text-sm font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
        >
          Disconnect {name}
        </button>
      )}
    </form>
  );
}

/** Empty state: what connecting does + the form. */
export function ConnectPanel({ service, children }: { service: Service; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{children}</p>
      <ConnectForm service={service} />
    </div>
  );
}

/** Easy / Medium / Hard with numbers and their share of all solved problems (shares add up to 100%). */
export function DifficultyBars({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const shares = percentShares([easy, medium, hard]);
  const rows = [
    { label: 'Easy', value: easy, bar: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300' },
    { label: 'Medium', value: medium, bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { label: 'Hard', value: hard, bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  ];
  return (
    <ul className="space-y-2.5" aria-label="Solved by difficulty">
      {rows.map((r, i) => {
        const pct = shares[i];
        return (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className={`font-medium ${r.text}`}>{r.label}</span>
              <span>
                <span className="font-semibold tabular-nums">{r.value.toLocaleString('en-US')}</span>
                <span className="text-slate-500 dark:text-slate-400"> · {pct}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
              <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
