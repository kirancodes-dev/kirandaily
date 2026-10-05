import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { inputClass } from './styles';

/** One-line "add item" form. */
export function InlineAdd({ label, placeholder, onAdd }: { label: string; placeholder?: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue('');
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <input aria-label={label} className={`${inputClass} mt-0`} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <button
        type="submit"
        aria-label={label}
        disabled={!value.trim()}
        className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-40"
      >
        <Plus size={20} aria-hidden />
      </button>
    </form>
  );
}
