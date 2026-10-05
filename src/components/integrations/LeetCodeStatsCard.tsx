import { useMemo, useState } from 'react';
import { CodeXml } from 'lucide-react';
import { useExtras } from '../../hooks/useExtras';
import { useLeetCodeStats, useNow } from '../../hooks/useCodingStats';
import { useToday } from '../../hooks/useToday';
import { plural, type DayCount } from '../../utils/integrations/contrib';
import type { LeetCodeStats } from '../../utils/integrations/leetcode';
import { normalizeUsername, profileUrl } from '../../utils/integrations/usernames';
import { addDays } from '../../utils/date';
import { ContribGraph } from './ContribGraph';
import { CardActions, ConnectForm, ConnectPanel, DifficultyBars, ErrorBlock, ExternalLink, IntegrationCard, LoadingBlock, OfflineBlock, StatusLine } from './parts';

/** LeetCode solved counts and submission calendar (Profile page). */
export function LeetCodeStatsCard() {
  const { profileExtra } = useExtras();
  const raw = profileExtra.links.leetcode.trim();
  const username = raw ? normalizeUsername(raw, 'leetcode') : null;
  const stats = useLeetCodeStats(username);
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const icon = <CodeXml size={20} className="text-amber-600 dark:text-amber-400" aria-hidden />;

  if (!raw) {
    return (
      <IntegrationCard title="LeetCode" icon={icon} testId="leetcode-card" level={3}>
        <ConnectPanel service="leetcode">
          Connect LeetCode to see how many problems you’ve solved (Easy / Medium / Hard) and your daily submissions.
        </ConnectPanel>
      </IntegrationCard>
    );
  }

  if (!username || editing) {
    return (
      <IntegrationCard title="LeetCode" icon={icon} testId="leetcode-card" level={3}>
        {!username && (
          <p role="alert" className="mb-3 text-sm text-amber-800 dark:text-amber-300">
            “{raw}” isn’t a valid LeetCode username. Fix it below.
          </p>
        )}
        <ConnectForm
          service="leetcode"
          initial={username ?? raw}
          onDone={() => setEditing(false)}
          onCancel={username ? () => setEditing(false) : undefined}
          allowDisconnect
        />
      </IntegrationCard>
    );
  }

  return (
    <IntegrationCard
      title="LeetCode"
      icon={icon}
      busy={stats.loading}
      testId="leetcode-card" level={3}
      actions={<CardActions service="leetcode" loading={stats.loading} onRefresh={stats.refresh} onEdit={() => setEditing(true)} />}
    >
      {stats.data ? (
        <>
          <LeetCodeBody data={stats.data} />
          <StatusLine state={stats} now={now} onRetry={stats.refresh} />
        </>
      ) : stats.error ? (
        <ErrorBlock message={stats.error.message} onRetry={stats.refresh} onEdit={() => setEditing(true)} />
      ) : stats.offline ? (
        <OfflineBlock service="leetcode" />
      ) : (
        <LoadingBlock service="leetcode" slow={stats.slow} />
      )}
    </IntegrationCard>
  );
}

function LeetCodeBody({ data }: { data: LeetCodeStats }) {
  const today = useToday();
  const days: DayCount[] = useMemo(() => Object.entries(data.calendar).map(([date, count]) => ({ date, count })), [data.calendar]);
  const yearTotal = useMemo(() => {
    const from = addDays(today, -365);
    return days.reduce((s, d) => (d.date > from && d.date <= today ? s + d.count : s), 0);
  }, [days, today]);
  const todayCount = data.calendar[today] ?? 0;
  const link = profileUrl('leetcode', data.username);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-8">
        <div className="flex flex-wrap items-end justify-between gap-3 sm:block">
          <div>
            <p className="text-4xl font-bold leading-none tabular-nums" data-testid="leetcode-total">
              {data.totalSolved.toLocaleString('en-US')}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">problems solved</p>
          </div>
          <div className="space-y-0.5 text-right text-sm text-slate-600 dark:text-slate-400 sm:mt-3 sm:text-left">
            {data.ranking !== undefined && (
              <p>
                Rank <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">#{data.ranking.toLocaleString('en-US')}</span>
              </p>
            )}
            <p>
              Today: <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{plural(todayCount, ['submission', 'submissions'])}</span>
            </p>
          </div>
        </div>
        <DifficultyBars easy={data.easy} medium={data.medium} hard={data.hard} />
      </div>

      <div>
        <p className="mb-2 text-sm text-slate-700 dark:text-slate-300">
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{yearTotal.toLocaleString('en-US')}</span> submission
          {yearTotal === 1 ? '' : 's'} in the last year
        </p>
        <ContribGraph days={days} endDate={today} label="LeetCode submissions, last 12 months" unit={['submission', 'submissions']} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {link && (
          <ExternalLink href={link} className="min-h-touch font-medium text-brand-700 hover:underline dark:text-brand-300">
            Open LeetCode profile
          </ExternalLink>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400">via {data.source}</span>
      </div>
    </div>
  );
}
