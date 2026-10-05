import { Link } from 'react-router-dom';
import { AlertTriangle, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useSync } from '../../hooks/useSync';

/** Small cloud status in the top bar (only when cloud sync is configured). */
export function SyncBadge() {
  const { configured, ready, user, status } = useSync();
  if (!configured || !ready) return null;

  let icon = <CloudOff size={20} aria-hidden />;
  let label = 'Not syncing — sign in to back up';
  let tone = 'text-slate-500';
  if (user) {
    switch (status.state) {
      case 'synced':
        icon = <Cloud size={20} aria-hidden />;
        label = 'Synced to cloud';
        tone = 'text-emerald-700 dark:text-emerald-400';
        break;
      case 'saving':
      case 'connecting':
        icon = <RefreshCw size={20} aria-hidden />;
        label = 'Syncing…';
        tone = 'text-brand-700 dark:text-brand-300';
        break;
      case 'offline':
        icon = <CloudOff size={20} aria-hidden />;
        label = 'Offline — will sync later';
        tone = 'text-amber-700 dark:text-amber-400';
        break;
      case 'error':
      case 'needs-choice':
        icon = <AlertTriangle size={20} aria-hidden />;
        label = status.state === 'error' ? 'Sync problem — open settings' : 'Sync needs your choice';
        tone = 'text-red-700 dark:text-red-400';
        break;
      default:
        icon = <Cloud size={20} aria-hidden />;
        label = 'Cloud sync on';
    }
  }
  return (
    <Link
      to="/settings"
      aria-label={label}
      title={label}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 ${tone}`}
    >
      {icon}
    </Link>
  );
}
