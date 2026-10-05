import { useState } from 'react';
import { useAppData } from '../../hooks/useAppData';
import { scheduleConfig } from '../../config/schedule';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TextField } from '../common/Fields';

export function TargetSettings() {
  const { data, update } = useAppData();
  const [targets, setTargets] = useState({
    weekday: String(data.settings.studyTargets.weekday),
    saturday: String(data.settings.studyTargets.saturday),
    sunday: String(data.settings.studyTargets.sunday),
  });
  const [pomo, setPomo] = useState({ focus: String(data.settings.pomodoro.focus), break: String(data.settings.pomodoro.break) });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    const t = { weekday: Number(targets.weekday), saturday: Number(targets.saturday), sunday: Number(targets.sunday) };
    if (Object.values(t).some((n) => !Number.isFinite(n) || n < 0 || n > 24)) return setMessage({ ok: false, text: 'Study targets must be 0–24 hours.' });
    const p = { focus: Number(pomo.focus), break: Number(pomo.break) };
    if (!Number.isInteger(p.focus) || p.focus < 1 || p.focus > 240 || !Number.isInteger(p.break) || p.break < 0 || p.break > 120)
      return setMessage({ ok: false, text: 'Pomodoro: focus 1–240 min, break 0–120 min (whole minutes).' });
    update((d) => ({ ...d, settings: { ...d.settings, studyTargets: t, pomodoro: p } }));
    setMessage({ ok: true, text: 'Saved.' });
  };

  return (
    <Card title="Study targets & timer">
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Mon–Fri (h)" type="number" step="0.5" min={0} max={24} value={targets.weekday} onChange={(e) => setTargets({ ...targets, weekday: e.target.value })} />
        <TextField label="Saturday (h)" type="number" step="0.5" min={0} max={24} value={targets.saturday} onChange={(e) => setTargets({ ...targets, saturday: e.target.value })} />
        <TextField label="Sunday (h)" type="number" step="0.5" min={0} max={24} value={targets.sunday} onChange={(e) => setTargets({ ...targets, sunday: e.target.value })} />
      </div>
      <h3 className="mt-4 text-sm font-medium">Default Pomodoro</h3>
      <div className="mt-1 flex flex-wrap gap-2">
        {scheduleConfig.pomodoroPresets.map((p) => (
          <Button
            key={`${p.focus}/${p.break}`}
            aria-pressed={pomo.focus === String(p.focus) && pomo.break === String(p.break)}
            variant={pomo.focus === String(p.focus) && pomo.break === String(p.break) ? 'primary' : 'secondary'}
            onClick={() => setPomo({ focus: String(p.focus), break: String(p.break) })}
          >
            {p.focus}/{p.break}
          </Button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <TextField label="Focus (min)" type="number" min={1} max={240} value={pomo.focus} onChange={(e) => setPomo({ ...pomo, focus: e.target.value })} />
        <TextField label="Break (min)" type="number" min={0} max={120} value={pomo.break} onChange={(e) => setPomo({ ...pomo, break: e.target.value })} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" onClick={save}>
          Save targets
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
