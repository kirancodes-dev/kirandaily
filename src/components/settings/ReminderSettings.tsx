import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, BellRing, CalendarPlus, CheckCircle2, Info } from 'lucide-react';
import { useExtras } from '../../hooks/useExtras';
import { useToast } from '../../hooks/useToast';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { SelectField } from '../common/Fields';
import {
  notificationPermission,
  pageInBackground,
  playBeep,
  requestNotificationPermission,
  showSystemNotification,
  unlockAudio,
  type NotifyPermission,
} from '../reminders/alerts';

const REMIND_OPTIONS = [
  { value: '0', label: 'At the start time' },
  { value: '5', label: '5 min before' },
  { value: '10', label: '10 min before' },
  { value: '15', label: '15 min before' },
  { value: '30', label: '30 min before' },
];

interface SwitchRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled on/off switch (a real checkbox with role="switch"). */
function SwitchRow({ label, description, checked, disabled, onChange }: SwitchRowProps) {
  const id = useId();
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <p id={`${id}-desc`} className="text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
      <span className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={`${id}-desc`}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className="h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 dark:bg-slate-600 dark:peer-checked:bg-brand-500 dark:peer-focus-visible:ring-offset-slate-900"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-[0.4375rem] top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
    </div>
  );
}

const PERMISSION_TEXT: Record<NotifyPermission, { text: string; tone: 'ok' | 'off' | 'bad' }> = {
  granted: { text: 'On — you’ll get a system alert while the planner is in the background.', tone: 'ok' },
  default: { text: 'Off — allow them to get alerts when the planner isn’t in front.', tone: 'off' },
  denied: { text: 'Blocked — allow notifications for this site in your browser or system settings, then reload.', tone: 'bad' },
  unsupported: {
    text: 'Not available here. On iPhone, add the planner to your Home Screen first (Share → Add to Home Screen) and open it from there.',
    tone: 'off',
  },
};

/** Settings: time-lock, reminders, sound, lead time and system notifications. */
export function ReminderSettings() {
  const { prefs, updatePrefs } = useExtras();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotifyPermission>(() => notificationPermission());
  const [asking, setAsking] = useState(false);

  // The permission can change in system settings while the app is open.
  useEffect(() => {
    const refresh = () => setPermission(notificationPermission());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const enable = async () => {
    setAsking(true);
    unlockAudio();
    setPermission(await requestNotificationPermission());
    setAsking(false);
  };

  const sendTest = () => {
    unlockAudio();
    const title = 'Test reminder';
    const body = 'This is how a reminder looks. Real ones come when a task starts or ends without a tick.';
    toast({ id: 'reminder-test', tone: 'info', title, body });
    if (prefs.reminderSound) playBeep('info');
    if (permission === 'granted') {
      // Shown even in front, so you can see what it looks like.
      void showSystemNotification(title, pageInBackground() ? body : 'Notifications are working.', 'reminder-test');
    }
  };

  const status = PERMISSION_TEXT[permission];
  const StatusIcon = status.tone === 'ok' ? CheckCircle2 : status.tone === 'bad' ? BellOff : Bell;

  return (
    <Card title="Reminders & time-lock" icon={<BellRing size={20} aria-hidden className="text-brand-600" />}>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <SwitchRow
          label="Time-lock"
          description="A task can only be ticked once its start time has arrived — so every green tick is real. You can still tick it later."
          checked={prefs.timeGate}
          onChange={(v) => updatePrefs({ timeGate: v })}
        />
        <SwitchRow
          label="Reminders"
          description="Alert me when a task starts and when one ends without a tick."
          checked={prefs.reminders}
          onChange={(v) => updatePrefs({ reminders: v })}
        />
        <SwitchRow
          label="Sound"
          description="Play a short beep with each reminder."
          checked={prefs.reminderSound}
          disabled={!prefs.reminders}
          onChange={(v) => {
            if (v) unlockAudio();
            updatePrefs({ reminderSound: v });
          }}
        />
        <div className="py-3">
          <SelectField
            label="Remind me"
            value={String(prefs.remindBeforeMinutes)}
            disabled={!prefs.reminders}
            onChange={(e) => updatePrefs({ remindBeforeMinutes: Number(e.target.value) })}
            options={
              REMIND_OPTIONS.some((o) => o.value === String(prefs.remindBeforeMinutes))
                ? REMIND_OPTIONS
                : [...REMIND_OPTIONS, { value: String(prefs.remindBeforeMinutes), label: `${prefs.remindBeforeMinutes} min before` }]
            }
          />
        </div>
        <div className="space-y-3 py-3">
          <div>
            <p className="font-medium">System notifications</p>
            <p role="status" className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <StatusIcon
                size={16}
                aria-hidden
                className={`mt-0.5 shrink-0 ${status.tone === 'ok' ? 'text-emerald-600' : status.tone === 'bad' ? 'text-red-600' : 'text-slate-500'}`}
              />
              <span>{status.text}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {permission === 'default' && (
              <Button variant="primary" icon={<Bell size={18} aria-hidden />} onClick={() => void enable()} disabled={asking}>
                {asking ? 'Waiting for your answer…' : 'Enable notifications'}
              </Button>
            )}
            <Button icon={<BellRing size={18} aria-hidden />} onClick={sendTest} disabled={!prefs.reminders}>
              Send a test reminder
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
          <Info size={16} aria-hidden className="shrink-0 text-sky-600" />
          How reminders reach you
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium">iPhone:</span> notifications only work when the planner is added to the Home Screen (Share → Add to Home
            Screen) and opened from there — and only while it is open or was used recently. iOS pauses web apps in the background.
          </li>
          <li>
            <span className="font-medium">Mac:</span> alerts come while the planner is open in a browser tab or installed as an app (Safari: File → Add
            to Dock).
          </li>
          <li>
            For alerts that <span className="font-medium">always</span> fire, even when the app is closed, add your timetable to Apple Calendar.
          </li>
        </ul>
        <Link
          to="/calendar"
          className="mt-2 inline-flex min-h-touch items-center gap-1.5 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          <CalendarPlus size={18} aria-hidden />
          Open Calendar → Add to Calendar
        </Link>
      </div>
    </Card>
  );
}
