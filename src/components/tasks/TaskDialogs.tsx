import { useCallback, useState } from 'react';
import { CalendarClock, CheckCircle2, Circle, Clock, Copy, Pencil, SkipForward, Trash2, Undo2 } from 'lucide-react';
import type { Task } from '../../types/task';
import { Modal, ConfirmDialog } from '../common/Modal';
import { Button } from '../common/Button';
import { TaskForm } from './TaskForm';
import { MoveDialog } from './MoveDialog';
import { toRecurrence, type TaskFormValues } from '../../utils/taskForm';
import { useTasks } from '../../hooks/useTasks';
import { useExtras } from '../../hooks/useExtras';
import { useToast } from '../../hooks/useToast';
import { formatLongDate, formatTime12 } from '../../utils/date';
import { availableFrom, canMarkDone, dropEarlyTick, gateMessage, tickRemovedMessage } from '../../utils/timeGate';

type DialogState =
  | { kind: 'none' }
  | { kind: 'actions'; task: Task }
  | { kind: 'edit'; task: Task | null; date: string }
  | { kind: 'move'; task: Task }
  | { kind: 'delete'; task: Task };

/**
 * The ONE place every tick goes through (task cards, the action sheet, the
 * week grid, reminders). With the time-lock on (prefs.timeGate) a task can't
 * be ticked before it starts: nothing changes and an alert explains why.
 * Un-ticking is always allowed (skipping goes through `skip`, never gated).
 * Returns true when the task was toggled.
 */
export function useTaskToggle() {
  const { toggle } = useTasks();
  const { prefs } = useExtras();
  const { toast } = useToast();
  const gateOn = prefs.timeGate;
  return useCallback(
    (task: Task): boolean => {
      if (!task.completed) {
        const now = new Date();
        if (!canMarkDone(task, now, gateOn)) {
          const msg = gateMessage(task, now);
          toast({ id: 'time-gate', tone: 'warning', title: msg.title, body: msg.body, duration: 6000 });
          return false;
        }
      }
      toggle(task);
      return true;
    },
    [toggle, gateOn, toast],
  );
}

/**
 * All task dialogs (actions sheet, add/edit form, reschedule, delete).
 * Usage: const dlg = useTaskDialogs(); … dlg.openActions(task) … {dlg.element}
 */
export function useTaskDialogs() {
  const [state, setState] = useState<DialogState>({ kind: 'none' });
  const close = () => setState({ kind: 'none' });
  const ops = useTasks();
  const toggle = useTaskToggle();
  const { prefs } = useExtras();
  const { toast } = useToast();

  /**
   * Time-lock for moves and edits: a ticked task moved / edited to a slot that
   * hasn't started yet loses its tick (no green tick ahead of time — and no
   * "move it to now, tick, move it back" trick). Returns the task to store.
   */
  const honest = (after: Task): Task => {
    const now = new Date();
    const next = dropEarlyTick(after, now, prefs.timeGate);
    if (next !== after) {
      const msg = tickRemovedMessage(next, now);
      toast({ id: `tick-removed-${next.id}`, tone: 'info', title: msg.title, body: msg.body, duration: 7000 });
    }
    return next;
  };

  const move = (task: Task, date: string, startTime: string, endTime: string) => {
    const next = honest({ ...task, date, startTime, endTime });
    ops.move({ ...task, completed: next.completed, completedAt: next.completedAt }, date, startTime, endTime);
  };

  const handleSubmit = (task: Task | null, v: TaskFormValues) => {
    const rec = toRecurrence(v);
    if (!task) {
      const base = {
        date: v.date,
        title: v.title,
        category: v.category,
        startTime: v.startTime,
        endTime: v.endTime,
        completed: false,
        skipped: false,
        notes: v.notes,
        priority: v.priority,
        recurring: null,
        subjectId: v.category === 'college' && v.subjectId ? v.subjectId : undefined,
      };
      if (rec) {
        ops.addTemplate({
          title: v.title,
          category: v.category,
          startTime: v.startTime,
          endTime: v.endTime,
          priority: v.priority,
          notes: v.notes,
          recurrence: rec,
          startDate: v.date,
        });
      } else ops.add(base);
    } else if (task.templateId && v.scope === 'series') {
      // The day's own copy follows the series' new times: untick it first if they haven't started.
      const day = honest({ ...task, title: v.title, startTime: v.startTime, endTime: v.endTime });
      if (day.completed !== task.completed) ops.save({ ...task, completed: false, completedAt: undefined });
      ops.updateSeries(task, {
        title: v.title,
        category: v.category,
        startTime: v.startTime,
        endTime: v.endTime,
        priority: v.priority,
        notes: v.notes,
        ...(rec ? { recurrence: rec } : {}),
      });
    } else {
      const updated: Task = honest({
        ...task,
        title: v.title,
        date: v.date,
        category: v.category,
        startTime: v.startTime,
        endTime: v.endTime,
        priority: v.priority,
        notes: v.notes,
        subjectId: v.category === 'college' ? v.subjectId || undefined : undefined,
      });
      if (!task.templateId && rec) ops.makeRecurring(updated, rec);
      else ops.save(updated);
    }
    close();
  };

  let element: JSX.Element | null = null;
  if (state.kind === 'actions') {
    const t = state.task;
    const go = (next: DialogState) => setState(next);
    const done = t.completed && !t.skipped;
    const locked = !t.completed && !canMarkDone(t, new Date(), prefs.timeGate);
    element = (
      <Modal open title={t.title} onClose={close}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          {formatLongDate(t.date)} · {formatTime12(t.startTime)} – {formatTime12(t.endTime)}
        </p>
        <div className="grid gap-2">
          <Button
            icon={
              done ? (
                <Circle size={18} aria-hidden />
              ) : locked ? (
                <Clock size={18} aria-hidden className="text-slate-500" />
              ) : (
                <CheckCircle2 size={18} aria-hidden className="text-emerald-600" />
              )
            }
            onClick={() => {
              // Close first: the "not yet" alert can't show above an open dialog.
              close();
              toggle(t);
            }}
            block
            className={`justify-start ${locked ? 'text-slate-500 dark:text-slate-400' : ''}`}
            aria-label={done ? 'Mark not done' : locked ? `Mark done (available from ${availableFrom(t, new Date())})` : 'Mark done'}
          >
            {done ? 'Mark not done' : 'Mark done'}
            {locked && <span className="text-sm font-normal">· from {availableFrom(t, new Date())}</span>}
          </Button>
          <Button icon={<Pencil size={18} aria-hidden />} onClick={() => go({ kind: 'edit', task: t, date: t.date })} block className="justify-start">
            Edit
          </Button>
          <Button icon={<CalendarClock size={18} aria-hidden />} onClick={() => go({ kind: 'move', task: t })} block className="justify-start">
            Move / reschedule
          </Button>
          <Button
            icon={<Copy size={18} aria-hidden />}
            onClick={() => {
              ops.duplicate(t);
              close();
            }}
            block
            className="justify-start"
          >
            Duplicate
          </Button>
          <Button
            icon={t.skipped ? <Undo2 size={18} aria-hidden /> : <SkipForward size={18} aria-hidden />}
            onClick={() => {
              ops.skip(t, !t.skipped);
              close();
            }}
            block
            className="justify-start"
          >
            {t.skipped ? 'Undo skip' : 'Skip today'}
          </Button>
          <Button icon={<Trash2 size={18} aria-hidden />} onClick={() => go({ kind: 'delete', task: t })} block className="justify-start text-red-700 dark:text-red-400">
            Delete
          </Button>
        </div>
      </Modal>
    );
  } else if (state.kind === 'edit') {
    element = (
      <TaskForm
        open
        task={state.task}
        defaultDate={state.date}
        onClose={close}
        onSubmit={(v) => handleSubmit(state.kind === 'edit' ? state.task : null, v)}
      />
    );
  } else if (state.kind === 'move') {
    element = <MoveDialog task={state.task} onClose={close} onMove={(d, s, e) => (move(state.task, d, s, e), close())} />;
  } else if (state.kind === 'delete') {
    const t = state.task;
    const tpl = ops.templateOf(t);
    element = tpl ? (
      <Modal open title="Delete repeating task" onClose={close}>
        <p className="mb-3">“{t.title}” repeats. What should be deleted?</p>
        <div className="grid gap-2">
          <Button
            block
            onClick={() => {
              ops.remove(t);
              close();
            }}
          >
            Only this day
          </Button>
          <Button
            block
            variant="danger"
            disabled={tpl.locked}
            onClick={() => {
              ops.endSeries(t);
              close();
            }}
          >
            This and all following days
          </Button>
          {tpl.locked && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Gym is protected and stays in your schedule every day. You can skip or move a single day instead.
            </p>
          )}
          <Button block variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
      </Modal>
    ) : (
      <ConfirmDialog
        open
        danger
        title="Delete task?"
        message={`“${t.title}” will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={close}
        onConfirm={() => {
          ops.remove(t);
          close();
        }}
      />
    );
  }

  return {
    element,
    openActions: (task: Task) => setState({ kind: 'actions', task }),
    openAdd: (date: string) => setState({ kind: 'edit', task: null, date }),
    openEdit: (task: Task) => setState({ kind: 'edit', task, date: task.date }),
    openMove: (task: Task) => setState({ kind: 'move', task }),
    toggle,
  };
}
