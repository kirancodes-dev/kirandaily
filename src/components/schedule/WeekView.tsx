import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { getDayTasks, studyMinutesOnDate, studyTargetMinutes } from '../../utils/calculations';
import { addDays, dayOfWeek, formatHours, formatShortDate, startOfWeek, weekDates, WEEKDAY_SHORT } from '../../utils/date';
import { useTaskDialogs } from '../tasks/TaskDialogs';
import { TimeGrid } from './TimeGrid';
import { Button, IconButton } from '../common/Button';

interface Props {
  date: string;
  today: string;
  onDateChange: (date: string) => void;
}

export function WeekView({ date, today, onDateChange }: Props) {
  const { data, stats } = useAppData();
  const dialogs = useTaskDialogs();
  const dates = useMemo(() => weekDates(date), [date]);
  const [selected, setSelected] = useState(() => (dates.includes(today) ? today : dates[0]));
  const selectedDay = dates.includes(selected) ? selected : dates[0];

  const columns = dates.map((d) => ({
    date: d,
    label: `${WEEKDAY_SHORT[dayOfWeek(d)]} ${Number(d.slice(8))}`,
    tasks: getDayTasks(stats, d),
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous week" onClick={() => onDateChange(addDays(startOfWeek(date), -7))}>
            <ChevronLeft size={22} aria-hidden />
          </IconButton>
          <h2 className="min-w-[10rem] text-center font-semibold" aria-live="polite">
            {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
          </h2>
          <IconButton label="Next week" onClick={() => onDateChange(addDays(startOfWeek(date), 7))}>
            <ChevronRight size={22} aria-hidden />
          </IconButton>
          {!dates.includes(today) && (
            <Button variant="ghost" onClick={() => onDateChange(today)}>
              This week
            </Button>
          )}
        </div>
        <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => dialogs.openAdd(selectedDay)}>
          Add task
        </Button>
      </div>

      {/* Study targets + day selector (selector only matters on small screens) */}
      <div role="group" aria-label="Days of the week and study targets" className="grid grid-cols-7 gap-1">
        {dates.map((d) => {
          const target = studyTargetMinutes(data.settings, d);
          const done = studyMinutesOnDate(stats, d);
          const active = d === selectedDay;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              aria-pressed={active}
              aria-label={`${WEEKDAY_SHORT[dayOfWeek(d)]} ${formatShortDate(d)}: study target ${formatHours(target)} hours, ${formatHours(done)} done`}
              className={`flex min-h-[60px] flex-col items-center justify-center rounded-xl border text-sm ${
                active
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/15 lg:border-slate-200 lg:bg-white lg:dark:border-slate-800 lg:dark:bg-slate-900'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <span className={`text-xs ${d === today ? 'font-bold text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'}`}>
                {WEEKDAY_SHORT[dayOfWeek(d)]}
              </span>
              <span className="font-semibold tabular-nums">{formatHours(target)}h</span>
              <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-500">✓ {formatHours(done)}h</span>
            </button>
          );
        })}
      </div>

      <div className="lg:hidden">
        <TimeGrid columns={columns.filter((c) => c.date === selectedDay)} onSelect={dialogs.openActions} today={today} />
      </div>
      <div className="hidden lg:block">
        <TimeGrid columns={columns} onSelect={dialogs.openActions} today={today} />
      </div>
      {dialogs.element}
    </div>
  );
}
