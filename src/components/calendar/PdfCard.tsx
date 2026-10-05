import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileText, HardDriveDownload, Paperclip, RefreshCw, Share, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { checkPdf, deleteFile, fileStoreAvailable, formatBytes, getFile, putFile, SEMESTER_PDF_KEY, type StoredFileMeta } from '../../utils/fileStore';
import { formatShortDate, todayISO } from '../../utils/date';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Banner } from '../common/Feedback';
import { ConfirmDialog } from '../common/Modal';

type State =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'empty' }
  | { status: 'stored'; meta: StoredFileMeta; blob: Blob };

const linkClass =
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-medium ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:ring-slate-600 dark:hover:bg-slate-800';

/** The official calendar PDF, kept on this device only (IndexedDB). */
export function PdfCard({ sourceLabel }: { sourceLabel: string }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>(() => (fileStoreAvailable() ? { status: 'loading' } : { status: 'unavailable' }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [url, setUrl] = useState<string | null>(null);
  const show = (rec: { meta: StoredFileMeta; blob: Blob } | null) => setState(rec ? { status: 'stored', ...rec } : { status: 'empty' });

  useEffect(() => {
    if (!fileStoreAvailable()) return;
    let alive = true;
    getFile(SEMESTER_PDF_KEY)
      .then((rec) => alive && show(rec))
      .catch(() => alive && setState({ status: 'unavailable' }));
    return () => {
      alive = false;
    };
  }, []);

  // An object URL for "View PDF", freed again when the file changes or the page closes.
  const blob = state.status === 'stored' ? state.blob : null;
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const canShare = useMemo(() => {
    try {
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['%PDF'], 'x.pdf', { type: 'application/pdf' })] });
    } catch {
      return false;
    }
  }, []);

  const onFile = async (file: File | undefined) => {
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const problem = checkPdf(file);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const meta = await putFile(SEMESTER_PDF_KEY, file);
      show({ meta, blob: file });
      toast({ id: 'pdf', tone: 'success', title: 'PDF saved on this device', body: meta.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The PDF could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmRemove(false);
    try {
      await deleteFile(SEMESTER_PDF_KEY);
      show(null);
      toast({ id: 'pdf', tone: 'info', title: 'PDF removed from this device' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The PDF could not be removed.');
    }
  };

  const share = async () => {
    if (state.status !== 'stored') return;
    const file = new File([state.blob], state.meta.name, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: state.meta.name });
    } catch {
      /* cancelled */
    }
  };

  return (
    <Card title="Official calendar PDF" icon={<FileText size={20} aria-hidden className="text-brand-600 dark:text-brand-300" />}>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Keep the original “Calendar of Events” at hand. It is stored <strong>only on this device</strong> (in this browser) and is <strong>not synced</strong> or included
        in backups. The dates from it are already in the app — those sync to your other devices.
      </p>

      <div className="mt-3">
        {state.status === 'loading' && <p className="text-sm text-slate-500">Checking this device…</p>}
        {state.status === 'unavailable' && (
          <Banner tone="warning">This browser can’t keep files on the device (private browsing or storage blocked). The dates in the app still work.</Banner>
        )}
        {state.status === 'empty' && (
          <Button variant="primary" icon={<Paperclip size={18} aria-hidden />} onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Saving…' : 'Attach semester calendar PDF'}
          </Button>
        )}
        {state.status === 'stored' && url && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xs font-bold text-red-700 dark:bg-red-500/20 dark:text-red-200">
                PDF
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{state.meta.name}</span>
                <span className="block text-sm text-slate-600 dark:text-slate-400">
                  {formatBytes(state.meta.size)} · saved {formatShortDate(todayISO(new Date(state.meta.savedAt)))} · this device only
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className={`${linkClass} bg-brand-600 text-white ring-brand-600 hover:bg-brand-700 dark:hover:bg-brand-700`}>
                <ExternalLink size={18} aria-hidden />
                View PDF
              </a>
              {canShare && (
                <Button icon={<Share size={18} aria-hidden />} onClick={share}>
                  Share
                </Button>
              )}
              <a href={url} download={state.meta.name} className={linkClass}>
                <HardDriveDownload size={18} aria-hidden />
                Save a copy
              </a>
              <Button variant="ghost" icon={<RefreshCw size={18} aria-hidden />} onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? 'Saving…' : 'Replace'}
              </Button>
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="inline-flex min-h-touch items-center gap-2 rounded-xl px-4 font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                <Trash2 size={18} aria-hidden />
                Remove
              </button>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose semester calendar PDF"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {error && (
          <div className="mt-3">
            <Banner tone="error" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </div>
        )}
      </div>
      {sourceLabel && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Dates in the app: {sourceLabel}. Max PDF size 20 MB.</p>}

      <ConfirmDialog
        open={confirmRemove}
        danger
        title="Remove the PDF?"
        message="The PDF is deleted from this device. The semester dates in the app stay."
        confirmLabel="Remove PDF"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      />
    </Card>
  );
}
