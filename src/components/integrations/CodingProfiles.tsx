import { ShieldCheck } from 'lucide-react';
import { GitHubCard } from './GitHubCard';
import { LeetCodeStatsCard } from './LeetCodeStatsCard';

/** SLOT (feature: GitHub & LeetCode) – coding profile cards on the Profile page. */
export function CodingProfiles() {
  return (
    <section aria-labelledby="coding-profiles-title" className="space-y-3">
      <div>
        <h2 id="coding-profiles-title" className="text-xl font-bold tracking-tight">
          Coding profiles
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">Your real GitHub and LeetCode activity, refreshed automatically.</p>
      </div>
      <GitHubCard />
      <LeetCodeStatsCard />
      <p className="flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
        Stats come from public APIs; nothing is stored except a cache on this device.
      </p>
    </section>
  );
}
