import { Trash2 } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { COLOR_OPTIONS, CHIP_CLASSES } from '../../utils/categoryStyles';
import { slug, uid } from '../../utils/id';
import type { CategoryColor, CategoryDef } from '../../types/task';
import { Card } from '../common/Card';
import { IconButton } from '../common/Button';
import { InlineAdd } from '../common/InlineAdd';
import { inputClass } from '../common/styles';

export function CategorySettings() {
  const { data, update } = useAppData();
  const patch = (id: string, p: Partial<CategoryDef>) => update((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const inUse = (id: string) => data.templates.some((t) => t.category === id) || data.tasks.some((t) => t.category === id) || data.sessions.some((s) => s.category === id);

  return (
    <Card title="Learning categories">
      <ul className="space-y-2">
        {data.categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP_CLASSES[c.color]}`} aria-hidden>
              {c.label}
            </span>
            <input
              aria-label={`Name of category ${c.label}`}
              className={`${inputClass} mt-0 w-auto min-w-0 flex-1`}
              defaultValue={c.label}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.label) patch(c.id, { label: v });
                else e.target.value = c.label;
              }}
            />
            <select
              aria-label={`Colour of ${c.label}`}
              className={`${inputClass} mt-0 w-28`}
              value={c.color}
              onChange={(e) => patch(c.id, { color: e.target.value as CategoryColor })}
            >
              {COLOR_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <label className="flex min-h-touch items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={c.isStudy} disabled={c.builtIn} onChange={(e) => patch(c.id, { isStudy: e.target.checked })} />
              Study
            </label>
            <IconButton
              label={c.builtIn ? `${c.label} is built in` : inUse(c.id) ? `${c.label} is in use` : `Delete ${c.label}`}
              disabled={c.builtIn || inUse(c.id)}
              onClick={() => update((d) => ({ ...d, categories: d.categories.filter((x) => x.id !== c.id) }))}
            >
              <Trash2 size={18} aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <InlineAdd
          label="Add category"
          placeholder="e.g. SQL, Spring Boot, Aptitude"
          onAdd={(label) =>
            update((d) => ({
              ...d,
              categories: [...d.categories, { id: `${slug(label) || 'cat'}-${uid().slice(0, 4)}`, label, isStudy: true, builtIn: false, color: 'lime' }],
            }))
          }
        />
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Built-in categories can be renamed but not deleted. “Study” categories count towards study hours.
      </p>
    </Card>
  );
}
