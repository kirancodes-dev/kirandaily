import { useState } from 'react';
import { AlertTriangle, FolderGit2, Github, Star } from 'lucide-react';
import { useExtras } from '../../hooks/useExtras';
import { useGitHubStats, useNow } from '../../hooks/useCodingStats';
import { useToday } from '../../hooks/useToday';
import { formatAgo } from '../../utils/integrations/cache';
import type { GitHubStats } from '../../utils/integrations/github';
import { addDays, formatShortDate, toISODate } from '../../utils/date';
import { normalizeUsername } from '../../utils/integrations/usernames';
import { ContribGraph } from './ContribGraph';
import { CardActions, ConnectForm, ConnectPanel, ErrorBlock, ExternalLink, IntegrationCard, LoadingBlock, OfflineBlock, StatusLine } from './parts';

/** GitHub profile, contribution graph and recently pushed repos (Profile page). */
export function GitHubCard() {
  const { profileExtra } = useExtras();
  const raw = profileExtra.links.github.trim();
  const username = raw ? normalizeUsername(raw, 'github') : null;
  const stats = useGitHubStats(username);
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const icon = <Github size={20} aria-hidden />;

  if (!raw) {
    return (
      <IntegrationCard title="GitHub" icon={icon} testId="github-card" level={3}>
        <ConnectPanel service="github">
          Connect your GitHub to see your contribution graph, streak and latest repos here. Only public data is used – no password or token.
        </ConnectPanel>
      </IntegrationCard>
    );
  }

  if (!username || editing) {
    return (
      <IntegrationCard title="GitHub" icon={icon} testId="github-card" level={3}>
        {!username && (
          <p role="alert" className="mb-3 text-sm text-amber-800 dark:text-amber-300">
            “{raw}” isn’t a valid GitHub username. Fix it below.
          </p>
        )}
        <ConnectForm
          service="github"
          initial={username ?? raw}
          onDone={() => setEditing(false)}
          onCancel={username ? () => setEditing(false) : undefined}
          allowDisconnect
        />
      </IntegrationCard>
    );
  }

  const { data } = stats;
  return (
    <IntegrationCard
      title="GitHub"
      icon={icon}
      busy={stats.loading}
      testId="github-card" level={3}
      actions={<CardActions service="github" loading={stats.loading} onRefresh={stats.refresh} onEdit={() => setEditing(true)} />}
    >
      {data ? (
        <>
          <GitHubBody data={data} now={now} />
          <StatusLine state={stats} now={now} onRetry={stats.refresh} />
        </>
      ) : stats.error ? (
        <ErrorBlock message={stats.error.message} onRetry={stats.refresh} onEdit={() => setEditing(true)} />
      ) : stats.offline ? (
        <OfflineBlock service="github" />
      ) : (
        <LoadingBlock service="github" slow={stats.slow} />
      )}
    </IntegrationCard>
  );
}

function GitHubBody({ data, now }: { data: GitHubStats; now: number }) {
  const today = useToday();
  const { profile, repos, calendar, staleParts } = data;
  const [avatarFailed, setAvatarFailed] = useState(false);
  // Push events cover the last 90 days – or less for a busy account (GitHub keeps 300 events).
  const ninetyDays = addDays(today, -89);
  const eventsFrom = calendar?.from && calendar.from > ninetyDays ? calendar.from : ninetyDays;
  const eventsRange = eventsFrom > ninetyDays ? `since ${formatShortDate(eventsFrom)}` : 'last 90 days';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {profile.avatarUrl && !avatarFailed ? (
          <img
            onError={() => setAvatarFailed(true)}
            src={profile.avatarUrl}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-14 w-14 shrink-0 rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
          />
        ) : (
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800" aria-hidden>
            <Github size={26} />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight">{profile.name ?? profile.login}</p>
          <ExternalLink href={profile.htmlUrl} className="min-h-touch text-sm text-slate-600 hover:underline dark:text-slate-400">
            @{profile.login}
          </ExternalLink>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {[
          ['Repos', profile.publicRepos],
          ['Followers', profile.followers],
          ['Following', profile.following],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{Number(value).toLocaleString('en-US')}</dd>
          </div>
        ))}
      </dl>

      <div>
        {calendar ? (
          <>
            <p className="mb-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{calendar.total.toLocaleString('en-US')}</span>{' '}
              {calendar.source === 'contributions'
                ? `contribution${calendar.total === 1 ? '' : 's'} in the last year`
                : `commit${calendar.total === 1 ? '' : 's'} · recent activity (${eventsRange})`}
            </p>
            {staleParts?.calendar !== undefined && <OlderCopyNote what="the graph" since={staleParts.calendar} now={now} />}
            <ContribGraph
              days={calendar.days}
              endDate={today}
              weeks={calendar.source === 'contributions' ? 53 : 14}
              from={calendar.source === 'events' ? eventsFrom : calendar.days[0]?.date}
              until={staleParts?.calendar !== undefined ? toISODate(new Date(staleParts.calendar)) : undefined}
              label={calendar.source === 'contributions' ? 'GitHub contributions, last 12 months' : `GitHub commits, ${eventsRange}`}
              unit={calendar.source === 'contributions' ? ['contribution', 'contributions'] : ['commit', 'commits']}
            />
          </>
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            The contribution graph couldn’t be loaded just now. It’ll try again automatically in a few minutes, or tap Refresh.
          </p>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Recently pushed</h4>
        {repos && staleParts?.repos !== undefined && <OlderCopyNote what="the repositories" since={staleParts.repos} now={now} />}
        {repos === null ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Repositories couldn’t be loaded right now.</p>
        ) : repos.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No public repositories yet – your first push will show up here.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {repos.map((r) => (
              <li key={r.htmlUrl} className="min-w-0">
                <a
                  href={r.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full min-h-touch rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <FolderGit2 size={16} className="shrink-0 text-slate-500" aria-hidden />
                    <span className="truncate font-medium text-brand-700 dark:text-brand-300">{r.name}</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                  {r.description && <span className="mt-1 line-clamp-2 block text-sm text-slate-600 dark:text-slate-400">{r.description}</span>}
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {r.language && (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
                        {r.language}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Star size={12} aria-hidden />
                      <span className="tabular-nums">{r.stars}</span>
                      <span className="sr-only"> {r.stars === 1 ? 'star' : 'stars'}</span>
                    </span>
                    {r.pushedAt && <span>pushed {formatAgo(Date.parse(r.pushedAt), now)}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


/** A part that failed to refresh is shown from the cache – and says so. */
function OlderCopyNote({ what, since, now }: { what: string; since: number; now: number }) {
  return (
    <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
      <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        Couldn’t refresh {what} – showing {what === 'the graph' ? 'it' : 'them'} from {formatAgo(since, now)}.
      </span>
    </p>
  );
}
