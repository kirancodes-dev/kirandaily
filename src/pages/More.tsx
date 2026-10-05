import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { MORE_NAV } from '../components/layout/navigation';
import { PageHeader } from '../components/common/Feedback';

export default function More() {
  return (
    <div>
      <PageHeader title="More" />
      <ul className="grid gap-2 sm:grid-cols-2">
        {MORE_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  <Icon size={22} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{item.label}</span>
                  {item.description && <span className="block text-sm text-slate-600 dark:text-slate-400">{item.description}</span>}
                </span>
                <ChevronRight size={20} aria-hidden className="text-slate-400" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
