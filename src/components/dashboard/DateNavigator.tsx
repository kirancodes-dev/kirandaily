import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../common/Button';
import { addDays } from '../../utils/date';

interface Props {
  date: string;
  today: string;
  onChange: (date: string) => void;
  step?: number;
  label?: string;
}

export function DateNavigator({ date, today, onChange, step = 1, label = 'day' }: Props) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label={`Previous ${label}`} onClick={() => onChange(addDays(date, -step))}>
        <ChevronLeft size={22} aria-hidden />
      </IconButton>
      <input
        type="date"
        aria-label="Choose date"
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="min-h-touch w-[9.5rem] rounded-xl border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
      <IconButton label={`Next ${label}`} onClick={() => onChange(addDays(date, step))}>
        <ChevronRight size={22} aria-hidden />
      </IconButton>
      {date !== today && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="min-h-touch rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
        >
          Today
        </button>
      )}
    </div>
  );
}
