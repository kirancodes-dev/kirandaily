import { useSync } from '../../hooks/useSync';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

/** Shown once when this device and the cloud both already have planner data. */
export function SyncChoiceDialog() {
  const { status, resolveChoice, signOut } = useSync();
  if (status.state !== 'needs-choice') return null;
  return (
    <Modal open title="Your data is in two places" onClose={() => void signOut()}>
      <p className="mb-4 text-slate-700 dark:text-slate-300">
        Your cloud account already has planner data, and this device has its own. What should happen?
      </p>
      <div className="grid gap-2">
        <Button variant="primary" block onClick={() => resolveChoice('merge')} className="h-auto flex-col items-start py-3 text-left">
          <span>Merge both (recommended)</span>
          <span className="text-sm font-normal opacity-90">Keeps tasks, sessions and notes from both. Nothing is deleted.</span>
        </Button>
        <Button block onClick={() => resolveChoice('cloud')} className="h-auto flex-col items-start py-3 text-left">
          <span>Use the cloud data</span>
          <span className="text-sm font-normal text-slate-600 dark:text-slate-400">Replaces what is on this device.</span>
        </Button>
        <Button block onClick={() => resolveChoice('device')} className="h-auto flex-col items-start py-3 text-left">
          <span>Use this device’s data</span>
          <span className="text-sm font-normal text-slate-600 dark:text-slate-400">Replaces what is in the cloud.</span>
        </Button>
        <Button variant="ghost" block onClick={() => void signOut()}>
          Cancel and sign out
        </Button>
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Tip: export a backup in Settings first if you are unsure.</p>
    </Modal>
  );
}
