import { useMemo, useState } from 'react';
import { useAppData } from '../../hooks/useAppData';
import { useToday } from '../../hooks/useToday';
import { activeTemplateByKey } from '../../utils/schedule';
import { updateTemplate } from '../../utils/taskActions';
import { isValidTime } from '../../utils/date';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TextField } from '../common/Fields';
import { Link } from 'react-router-dom';

const ROWS = [
  { key: 'wake', label: 'Wake-up' },
  { key: 'gym', label: 'Gym' },
  { key: 'college', label: 'College' },
  { key: 'sleep', label: 'Sleep' },
] as const;

type Times = Record<string, { start: string; end: string }>;

/** Edits routine times. Changes apply from today; past days keep their times. */
export function RoutineSettings() {
  const { data, update } = useAppData();
  const today = useToday();
  const current = useMemo(() => {
    const out: Times = {};
    for (const r of ROWS) {
      const t = activeTemplateByKey(data.templates, r.key, today);
      if (t) out[r.key] = { start: t.startTime, end: t.endTime };
    }
    return out;
  }, [data.templates, today]);
  const [times, setTimes] = useState<Times>(current);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    for (const r of ROWS) {
      const t = times[r.key];
      if (!t) continue;
      if (!isValidTime(t.start) || !isValidTime(t.end) || t.start === t.end) {
        return setMessage({ ok: false, text: `Check the ${r.label.toLowerCase()} times.` });
      }
    }
    update((d) => {
      let next = d;
      for (const r of ROWS) {
        const tpl = activeTemplateByKey(next.templates, r.key, today);
        const t = times[r.key];
        if (tpl && t && (tpl.startTime !== t.start || tpl.endTime !== t.end)) {
          next = updateTemplate(next, tpl.id, { startTime: t.start, endTime: t.end }, today > tpl.startDate ? today : tpl.startDate);
        }
      }
      return next;
    });
    setMessage({ ok: true, text: 'Routine times saved (from today onwards).' });
  };

  return (
    <Card title="Daily routine times">
      <div className="space-y-3">
        {ROWS.map((r) =>
          times[r.key] ? (
            <fieldset key={r.key} className="grid grid-cols-2 gap-2">
              <legend className="mb-1 font-medium">{r.label}</legend>
              <TextField label="Start" type="time" value={times[r.key].start} onChange={(e) => setTimes({ ...times, [r.key]: { ...times[r.key], start: e.target.value } })} />
              <TextField label="End" type="time" value={times[r.key].end} onChange={(e) => setTimes({ ...times, [r.key]: { ...times[r.key], end: e.target.value } })} />
            </fieldset>
          ) : null,
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Gym stays every day. Other blocks can be changed in <Link to="/schedule?view=routine" className="underline">Schedule → Routine</Link>.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save}>
          Save routine
        </Button>
        {message && (
          <span role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {message.text}
          </span>
        )}
      </div>
    </Card>
  );
}
