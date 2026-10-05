import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useToday } from '../hooks/useToday';
import { searchData } from '../utils/search';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { inputClass } from '../components/common/styles';

export default function Search() {
  const { data } = useAppData();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const results = useMemo(() => searchData(data, query, today), [data, query, today]);

  return (
    <div className="space-y-4">
      <PageHeader title="Search" subtitle="Tasks, subjects, topics, projects, notes and goals." />
      <div className="relative">
        <SearchIcon size={20} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          autoFocus
          aria-label="Search everything"
          placeholder="e.g. HashMap, German, Subject 3…"
          className={`${inputClass} pl-10`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
          }}
        />
      </div>
      <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
        {query.trim().length < 2 ? 'Type at least 2 characters.' : `${results.length} result${results.length === 1 ? '' : 's'}`}
      </p>
      {query.trim().length >= 2 && results.length === 0 && <EmptyState title="Nothing found" />}
      <ul className="space-y-2">
        {results.map((r, i) => (
          <li key={`${r.type}-${r.title}-${i}`}>
            <Link
              to={r.to}
              className="flex min-h-touch items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{r.type}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.title}</span>
                {r.detail && <span className="block truncate text-sm text-slate-600 dark:text-slate-400">{r.detail}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
