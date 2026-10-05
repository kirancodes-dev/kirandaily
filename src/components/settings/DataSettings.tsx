import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload, CalendarSync } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useToday } from '../../hooks/useToday';
import { exportJson, parseImport } from '../../utils/storage';
import { replaceTimetable } from '../../utils/taskActions';
import { createDefaultTemplates } from '../../data/defaultSchedule';
import type { AppData } from '../../types/app';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Banner } from '../common/Feedback';
import { ConfirmDialog } from '../common/Modal';

export function DataSettings() {
  const { data, replace, reset, update } = useAppData();
  const today = useToday();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: AppData; warnings: string[] } | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'timetable' | null>(null);

  const doExport = () => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiran-planner-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Backup downloaded.');
  };

  const onFile = async (file: File | undefined) => {
    setErrors(null);
    setMessage(null);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setErrors(['File is too large (over 20 MB).']);
    try {
      const result = parseImport(await file.text());
      if (result.ok) setPending({ data: result.data, warnings: result.warnings });
      else setErrors(result.errors);
    } catch {
      setErrors(['The file could not be read.']);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card title="Backup & data">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Your data is saved in this browser and, if you are signed in to cloud sync, in your cloud account. Exporting a backup now and then is still a good idea.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button icon={<Download size={18} aria-hidden />} onClick={doExport}>
          Export data (JSON)
        </Button>
        <Button icon={<Upload size={18} aria-hidden />} onClick={() => fileRef.current?.click()}>
          Import data
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose backup file to import"
          tabIndex={-1}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button icon={<CalendarSync size={18} aria-hidden />} onClick={() => setConfirm('timetable')}>
          Reload timetable from config
        </Button>
        <Button variant="danger" icon={<RotateCcw size={18} aria-hidden />} onClick={() => setConfirm('reset')}>
          Reset all data
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {message && <Banner onDismiss={() => setMessage(null)}>{message}</Banner>}
        {errors && (
          <Banner tone="error" onDismiss={() => setErrors(null)}>
            <p className="font-medium">Import refused — nothing was changed:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Banner>
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        danger
        title="Replace all data?"
        message={
          <>
            <p>The backup is valid. Importing replaces everything currently in this browser.</p>
            {pending && pending.warnings.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {pending.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </>
        }
        confirmLabel="Import"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) replace(pending.data);
          setPending(null);
          setMessage('Data imported.');
        }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        danger
        title="Reset all data?"
        message="Every task change, session, note, project, review and setting will be deleted and the default schedule restored. If cloud sync is on, the cloud copy is reset too. Export a backup first if you might need it."
        confirmLabel="Reset everything"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          reset();
          setConfirm(null);
          setMessage('All data was reset.');
        }}
      />
      <ConfirmDialog
        open={confirm === 'timetable'}
        title="Reload timetable?"
        message="Your repeating timetable is replaced from today with the one in src/config/schedule.ts. Past days, completed tasks and everything else stay."
        confirmLabel="Reload"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          update((d) => replaceTimetable(d, createDefaultTemplates(), today));
          setConfirm(null);
          setMessage('Timetable reloaded from the config file.');
        }}
      />
    </Card>
  );
}
