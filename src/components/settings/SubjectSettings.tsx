import { Link } from 'react-router-dom';
import { useSubjects } from '../../hooks/useSubjects';
import { Card } from '../common/Card';
import { inputClass } from '../common/styles';

export function SubjectSettings() {
  const { subjects, patch } = useSubjects();
  return (
    <Card title="College subjects">
      <ol className="grid gap-2 sm:grid-cols-2">
        {subjects.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="w-6 text-right text-sm text-slate-500" aria-hidden>
              {i + 1}.
            </span>
            <input
              aria-label={`Subject ${i + 1} name`}
              className={`${inputClass} mt-0`}
              defaultValue={s.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.name) patch(s.id, { name: v });
                else e.target.value = s.name;
              }}
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Names save when you leave the field. Add or remove subjects on the <Link to="/subjects" className="underline">College</Link> page.
      </p>
    </Card>
  );
}
