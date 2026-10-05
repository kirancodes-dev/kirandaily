import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { Avatar } from '../profile/Avatar';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TextField } from '../common/Fields';
import type { ThemePref } from '../../types/app';

export function ProfileSettings() {
  const { data, update } = useAppData();
  const [name, setName] = useState(data.profile.name);
  const [saved, setSaved] = useState(false);
  const setTheme = (theme: ThemePref) => update((d) => ({ ...d, profile: { ...d.profile, theme } }));
  return (
    <Card title="Profile & theme">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          update((d) => ({ ...d, profile: { ...d.profile, name: name.trim() } }));
          setSaved(true);
        }}
      >
        <TextField label="Name" className="flex-1" value={name} onChange={(e) => (setName(e.target.value), setSaved(false))} error={name.trim() ? null : 'Name can’t be empty.'} />
        <Button type="submit" variant="primary" disabled={!name.trim() || name.trim() === data.profile.name}>
          Save
        </Button>
      </form>
      {saved && (
        <p role="status" className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}
      <Link
        to="/profile"
        className="mt-3 flex min-h-touch items-center gap-3 rounded-xl px-2 py-2 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
      >
        <Avatar size={36} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Edit full profile</span>
          <span className="block truncate text-sm text-slate-600 dark:text-slate-400">Photo, bio, links, level and badges</span>
        </span>
        <ChevronRight size={20} aria-hidden className="shrink-0 text-slate-400" />
      </Link>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Theme</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <label
              key={t}
              className={`flex min-h-touch cursor-pointer items-center justify-center gap-2 rounded-xl px-3 font-medium ring-1 ring-inset ${
                data.profile.theme === t ? 'bg-brand-50 text-brand-800 ring-brand-600 dark:bg-brand-500/15 dark:text-brand-200' : 'ring-slate-300 dark:ring-slate-600'
              }`}
            >
              <input type="radio" name="theme" className="sr-only" checked={data.profile.theme === t} onChange={() => setTheme(t)} />
              {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'System'}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
