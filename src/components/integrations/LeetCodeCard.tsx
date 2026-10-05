import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CodeXml } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useExtras } from '../../hooks/useExtras';
import { useLeetCodeStats, useNow } from '../../hooks/useCodingStats';
import { useToday } from '../../hooks/useToday';
import { dsaProblemStats } from '../../utils/calculations';
import { plural } from '../../utils/integrations/contrib';
import { normalizeUsername, profileUrl } from '../../utils/integrations/usernames';
import { CardActions, ConnectForm, ErrorBlock, ExternalLink, IntegrationCard, LoadingBlock, OfflineBlock, StatusLine } from './parts';

const DIFFICULTY = [
  { key: 'easy', label: 'Easy', dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300' },
  { key: 'medium', label: 'Medium', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  { key: 'hard', label: 'Hard', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
] as const;

/** SLOT (feature: GitHub & LeetCode) – LeetCode stats on the DSA page. */
export function LeetCodeCard() {
  const { data: appData } = useAppData();
  const { profileExtra } = useExtras();
  const today = useToday();
  const raw = profileExtra.links.leetcode.trim();
  const username = raw ? normalizeUsername(raw, 'leetcode') : null;
  const stats = useLeetCodeStats(username);
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const logged = useMemo(() => dsaProblemStats(appData, today).total, [appData, today]);
  const icon = <CodeXml size={20} className="text-amber-600 dark:text-amber-400" aria-hidden />;

  if (!username || editing) {
    return (
      <IntegrationCard title="LeetCode" icon={icon} testId="leetcode-dsa-card">
        {raw && !username ? (
          <p role="alert" className="mb-3 text-sm text-amber-800 dark:text-amber-300">
            “{raw}” isn’t a valid LeetCode username. Fix it below.
          </p>
        ) : !raw ? (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            Connect LeetCode to see your real solved count next to the problems you log here.
          </p>
        ) : null}
        <ConnectForm
          service="leetcode"
          initial={username ?? raw}
          onDone={() => setEditing(false)}
          onCancel={editing ? () => setEditing(false) : undefined}
          allowDisconnect={!!raw}
        />
      </IntegrationCard>
    );
  }

  const data = stats.data;
  const link = profileUrl('leetcode', username);
  return (
    <IntegrationCard
      title={
        link ? (
          <ExternalLink href={link} className="hover:underline">
            LeetCode
          </ExternalLink>
        ) : (
          'LeetCode'
        )
      }
      icon={icon}
      busy={stats.loading}
      testId="leetcode-dsa-card"
      actions={<CardActions service="leetcode" loading={stats.loading} onRefresh={stats.refresh} onEdit={() => setEditing(true)} />}
    >
      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div>
              <p className="text-3xl font-bold leading-none tabular-nums">{data.totalSolved.toLocaleString('en-US')}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">solved</p>
            </div>
            <dl className="grid min-w-[12rem] flex-1 grid-cols-3 gap-2">
              {DIFFICULTY.map((d) => (
                <div key={d.key} className="rounded-xl bg-slate-50 px-2 py-1.5 text-center dark:bg-slate-800/70">
                  <dt className={`flex items-center justify-center gap-1 text-xs font-medium ${d.text}`}>
                    <span className={`h-2 w-2 rounded-full ${d.dot}`} aria-hidden />
                    {d.label}
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums">{data[d.key].toLocaleString('en-US')}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <li>
              Today:{' '}
              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {plural(data.calendar[today] ?? 0, ['submission', 'submissions'])}
              </span>
            </li>
            <li>
              You logged <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{logged.toLocaleString('en-US')}</span> in the app
            </li>
          </ul>
          <Link
            to="/profile"
            className="mt-2 inline-flex min-h-touch items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Submission calendar on your profile <ChevronRight size={16} aria-hidden />
          </Link>
          <StatusLine state={stats} now={now} onRetry={stats.refresh} />
        </>
      ) : stats.error ? (
        <ErrorBlock message={stats.error.message} onRetry={stats.refresh} onEdit={() => setEditing(true)} />
      ) : stats.offline ? (
        <OfflineBlock service="leetcode" />
      ) : (
        <LoadingBlock service="leetcode" slow={stats.slow} compact />
      )}
    </IntegrationCard>
  );
}
