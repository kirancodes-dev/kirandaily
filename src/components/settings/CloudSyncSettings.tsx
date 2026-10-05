import { Cloud, CloudOff, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useSync } from '../../hooks/useSync';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Banner } from '../common/Feedback';

const README_URL = 'https://github.com/kirancodes-dev/kirandaily#cloud-sync-firebase';

function statusText(state: string, lastSyncedAt?: number): string {
  const when = lastSyncedAt ? ` · last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '';
  switch (state) {
    case 'synced':
      return `All changes are saved to the cloud${when}`;
    case 'saving':
      return 'Saving changes to the cloud…';
    case 'connecting':
      return 'Connecting to the cloud…';
    case 'offline':
      return `Offline — changes are saved on this device and will sync when you are back online${when}`;
    case 'needs-choice':
      return 'Waiting for your choice: merge, cloud or this device.';
    default:
      return 'Cloud sync is on.';
  }
}

export function CloudSyncSettings() {
  const { configured, ready, user, status, signIn, signOut, syncNow, signInError, clearSignInError } = useSync();

  if (!configured) {
    return (
      <Card title="Cloud sync" icon={<CloudOff size={20} aria-hidden className="text-slate-500" />}>
        <p className="text-slate-700 dark:text-slate-300">
          Off. Your data is saved only in this browser. To keep it safe in the cloud and use it on your phone and laptop, set up a free
          Firebase project and add its config to <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">src/config/firebase.ts</code>.
        </p>
        <a href={README_URL} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex min-h-touch items-center font-medium text-brand-700 underline dark:text-brand-300">
          How to set up cloud sync
        </a>
      </Card>
    );
  }

  return (
    <Card title="Cloud sync" icon={<Cloud size={20} aria-hidden className="text-brand-600" />}>
      {!ready ? (
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      ) : user ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800" aria-hidden>
                {(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name ?? 'Signed in'}</p>
              {user.email && <p className="truncate text-sm text-slate-600 dark:text-slate-400">{user.email}</p>}
            </div>
          </div>
          {status.state === 'error' ? (
            <Banner tone="error">{status.message}</Banner>
          ) : (
            <p role="status" className="text-sm text-slate-700 dark:text-slate-300">
              {status.message && status.state !== 'offline' ? status.message : statusText(status.state, status.lastSyncedAt)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button icon={<RefreshCw size={18} aria-hidden />} onClick={syncNow}>
              Sync now
            </Button>
            <Button variant="ghost" icon={<LogOut size={18} aria-hidden />} onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Signing out stops syncing. Your data stays on this device and in the cloud.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-700 dark:text-slate-300">
            Sign in with Google to save your planner in the cloud and use it on your phone and laptop. Only you can see your data.
          </p>
          {status.state === 'error' && <Banner tone="error">{status.message}</Banner>}
          {signInError && (
            <Banner tone="error" onDismiss={clearSignInError}>
              {signInError}
            </Banner>
          )}
          <Button variant="primary" icon={<LogIn size={18} aria-hidden />} onClick={() => void signIn()}>
            Sign in with Google
          </Button>
        </div>
      )}
    </Card>
  );
}
