import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { calculateCgpa } from '../utils/calculations';
import { PageHeader } from '../components/common/Feedback';
import { Card, StatTile } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { ProgressBar } from '../components/common/Progress';
import { TextField } from '../components/common/Fields';
import { uid } from '../utils/id';
import type { CgpaData } from '../types/subject';

function num(v: string) {
  return v.trim() === '' ? NaN : Number(v);
}

export default function Cgpa() {
  const { data, update } = useAppData();
  const c = data.cgpa;
  const result = calculateCgpa(c);
  const setCgpa = (patch: Partial<CgpaData>) => update((d) => ({ ...d, cgpa: { ...d.cgpa, ...patch } }));
  const nextSem = Math.min(c.totalSemesters, (c.semesters.reduce((m, s) => Math.max(m, s.semester), 0) || 0) + 1);
  const [sem, setSem] = useState({ semester: String(nextSem), sgpa: '', credits: '' });
  const [error, setError] = useState<string | null>(null);

  const addSemester = () => {
    const n = num(sem.semester);
    const g = num(sem.sgpa);
    const cr = sem.credits.trim() === '' ? undefined : num(sem.credits);
    if (!Number.isInteger(n) || n < 1 || n > c.totalSemesters) return setError(`Semester must be 1–${c.totalSemesters}.`);
    if (!Number.isFinite(g) || g < 0 || g > 10) return setError('SGPA must be between 0 and 10.');
    if (cr !== undefined && (!Number.isFinite(cr) || cr <= 0)) return setError('Credits must be a positive number.');
    if (c.semesters.some((s) => s.semester === n)) return setError(`Semester ${n} is already entered — delete it first to change it.`);
    setError(null);
    setCgpa({ semesters: [...c.semesters, { id: uid('sem'), semester: n, sgpa: g, credits: cr }].sort((a, b) => a.semester - b.semester) });
    setSem({ semester: String(Math.min(c.totalSemesters, n + 1)), sgpa: '', credits: '' });
  };

  const onNumber = (key: 'current' | 'target' | 'totalSemesters', value: string, min: number, max: number) => {
    const n = Number(value);
    if (value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) setCgpa({ [key]: key === 'totalSemesters' ? Math.round(n) : n });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="CGPA" subtitle="Approximate cumulative CGPA from your semester SGPAs." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={result.fromSemesters ? 'Calculated CGPA' : 'Current CGPA'} value={result.cgpa.toFixed(2)} hint={result.fromSemesters ? (result.weighted ? 'Credit-weighted' : 'Simple average') : 'Entered manually'} />
        <StatTile label="Target" value={c.target.toFixed(2)} />
        <StatTile label="Semesters left" value={result.remainingSemesters} />
        <StatTile
          label="Needed average"
          value={result.requiredAverage === null ? '—' : result.requiredAverage.toFixed(2)}
          hint={result.requiredAverage !== null && result.requiredAverage > 10 ? 'Not reachable — adjust the target' : 'SGPA in remaining semesters'}
        />
      </div>
      <ProgressBar value={result.progressPct} label={`Progress to ${c.target.toFixed(2)}`} tone={result.cgpa >= c.target ? 'green' : 'brand'} />

      <Card title="Settings">
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Current CGPA" type="number" step="0.01" min={0} max={10} defaultValue={c.current} onChange={(e) => onNumber('current', e.target.value, 0, 10)} />
          <TextField label="Target CGPA" type="number" step="0.01" min={0} max={10} defaultValue={c.target} onChange={(e) => onNumber('target', e.target.value, 0, 10)} />
          <TextField label="Total semesters" type="number" min={1} max={12} defaultValue={c.totalSemesters} onChange={(e) => onNumber('totalSemesters', e.target.value, 1, 12)} />
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          “Current CGPA” is used until you enter semester SGPAs. Add credits to every semester for a weighted result.
        </p>
      </Card>

      <Card title="Semester SGPA">
        {c.semesters.length > 0 && (
          <table className="mb-4 w-full text-left">
            <thead>
              <tr className="text-sm text-slate-600 dark:text-slate-400">
                <th scope="col" className="py-1 font-medium">Semester</th>
                <th scope="col" className="py-1 font-medium">SGPA</th>
                <th scope="col" className="py-1 font-medium">Credits</th>
                <th scope="col" className="py-1"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {c.semesters.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1">{s.semester}</td>
                  <td className="py-1 tabular-nums">{s.sgpa.toFixed(2)}</td>
                  <td className="py-1 tabular-nums">{s.credits ?? '—'}</td>
                  <td className="py-1 text-right">
                    <IconButton label={`Delete semester ${s.semester}`} onClick={() => setCgpa({ semesters: c.semesters.filter((x) => x.id !== s.id) })}>
                      <Trash2 size={18} aria-hidden />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Semester" type="number" min={1} max={c.totalSemesters} value={sem.semester} onChange={(e) => setSem({ ...sem, semester: e.target.value })} />
          <TextField label="SGPA" type="number" step="0.01" min={0} max={10} value={sem.sgpa} onChange={(e) => setSem({ ...sem, sgpa: e.target.value })} />
          <TextField label="Credits (optional)" type="number" min={1} value={sem.credits} onChange={(e) => setSem({ ...sem, credits: e.target.value })} />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <Button variant="primary" className="mt-3" onClick={addSemester}>
          Add semester
        </Button>
      </Card>
    </div>
  );
}
