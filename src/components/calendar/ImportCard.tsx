import { useMemo, useRef, useState } from 'react';
import { CalendarArrowUp, Repeat, Upload } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { uid } from '../../utils/id';
import { formatShortDate, parseISODate, WEEKDAY_SHORT } from '../../utils/date';
import { markDuplicates, rangeText, timeText } from '../../utils/events';
import { importedToEvent, parseIcs, type ParsedIcsEvent } from '../../utils/ics';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Banner } from '../common/Feedback';
import { KindChip } from './EventBits';

const MAX_ICS_BYTES = 5 * 1024 * 1024;
const MAX_PREVIEW = 500;

interface Preview {
  fileName: string;
  items: { item: ParsedIcsEvent; duplicate: boolean }[];
  recurringCount: number;
  skipped: number;
  warnings: string[];
  truncated: number;
}

/** Import events from another calendar's .ics file, with a preview to pick from. */
export function ImportCard({ onShowDates }: { onShowDates: () => void }) {
  const { data, update } = useAppData();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [important, setImportant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    setError(null);
    setPreview(null);
    if (!file) return;
    try {
      if (file.size > MAX_ICS_BYTES) throw new Error('That file is too large (over 5 MB).');
      const result = parseIcs(await file.text());
      if (!result.valid) throw new Error('That isn’t a calendar file. Choose an .ics file exported from Apple, Google or Outlook Calendar.');
      if (result.events.length === 0) throw new Error('No events were found in that file.');
      const items = markDuplicates(data.events, result.events.slice(0, MAX_PREVIEW));
      setPreview({
        fileName: file.name,
        items,
        recurringCount: result.recurringCount,
        skipped: result.skipped,
        warnings: result.warnings,
        truncated: Math.max(0, result.events.length - MAX_PREVIEW),
      });
      setSelected(new Set(items.map((x, i) => (x.duplicate ? -1 : i)).filter((i) => i >= 0)));
      setImportant(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const selectable = useMemo(() => (preview ? preview.items.map((x, i) => (x.duplicate ? -1 : i)).filter((i) => i >= 0) : []), [preview]);

  const doImport = () => {
    if (!preview) return;
    const chosen = preview.items.filter((_, i) => selected.has(i)).map((x) => ({ ...importedToEvent(x.item, important || x.item.important), id: uid('evt') }));
    // Re-check against the latest data so a double tap can't import twice.
    update((d) => {
      const fresh = markDuplicates(d.events, chosen).filter((x) => !x.duplicate).map((x) => x.item);
      return { ...d, events: [...d.events, ...fresh] };
    });
    toast({
      id: 'ics-import',
      tone: 'success',
      title: `Imported ${chosen.length} ${chosen.length === 1 ? 'event' : 'events'}`,
      body: 'They are in your calendar now.',
      action: { label: 'See dates', onClick: onShowDates },
    });
    setPreview(null);
  };

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const dupCount = preview ? preview.items.filter((x) => x.duplicate).length : 0;

  return (
    <Card title="Import from a calendar file" icon={<CalendarArrowUp size={20} aria-hidden className="text-brand-600 dark:text-brand-300" />}>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Bring in dates from another calendar (an .ics file from Apple, Google or Outlook Calendar, or one your college shares). You choose which events to add; ones
        already here are skipped.
      </p>
      <div className="mt-3">
        <Button icon={<Upload size={18} aria-hidden />} onClick={() => fileRef.current?.click()}>
          Choose .ics file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose calendar file to import"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="mt-3">
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">
              {preview.items.length} {preview.items.length === 1 ? 'event' : 'events'} in {preview.fileName}
            </h3>
            <div className="flex gap-1">
              <Button variant="ghost" className="min-h-touch px-3 text-sm" onClick={() => setSelected(new Set(selectable))}>
                Select all
              </Button>
              <Button variant="ghost" className="min-h-touch px-3 text-sm" onClick={() => setSelected(new Set())}>
                None
              </Button>
            </div>
          </div>
          {(preview.recurringCount > 0 || dupCount > 0 || preview.skipped > 0 || preview.truncated > 0 || preview.warnings.length > 0) && (
            <Banner tone="info">
              <ul className="space-y-0.5">
                {preview.recurringCount > 0 && (
                  <li>
                    {preview.recurringCount} repeating {preview.recurringCount === 1 ? 'event' : 'events'}: only the first date is imported.
                  </li>
                )}
                {dupCount > 0 && <li>{dupCount} already in your calendar (same title and date) – skipped.</li>}
                {preview.skipped > 0 && <li>{preview.skipped} cancelled or undated – left out.</li>}
                {preview.truncated > 0 && <li>Only the first {MAX_PREVIEW} are shown; {preview.truncated} more were left out.</li>}
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Banner>
          )}
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 p-2 dark:border-slate-700" aria-label="Events to import">
            {preview.items.map(({ item, duplicate }, i) => {
              const d = parseISODate(item.date);
              const extra = [rangeText(item), timeText(item)].filter(Boolean).join(' · ');
              return (
                <li key={`${item.uid}-${i}`}>
                  <label className={`flex min-h-touch items-start gap-3 rounded-xl px-2 py-2 ${duplicate ? 'opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={selected.has(i)} disabled={duplicate} onChange={() => toggle(i)} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{item.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                        <span>
                          {WEEKDAY_SHORT[d.getDay()]}, {formatShortDate(item.date)} {d.getFullYear()}
                        </span>
                        {extra && <span>{extra}</span>}
                        <KindChip kind={item.kind} />
                        {item.recurring && (
                          <span className="inline-flex items-center gap-1">
                            <Repeat size={13} aria-hidden /> repeats – first date only
                          </span>
                        )}
                        {duplicate && <span className="font-semibold">Already in your calendar</span>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <label className="flex min-h-touch items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={important} onChange={(e) => setImportant(e.target.checked)} />
            Mark them as important (star)
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setPreview(null)}>Cancel</Button>
            <Button variant="primary" onClick={doImport} disabled={selected.size === 0}>
              Import {selected.size} {selected.size === 1 ? 'event' : 'events'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
