import { useState } from 'react';
import { CalendarClock, Copy, Pencil, SkipForward, Trash2, Undo2 } from 'lucide-react';
import type { Task } from '../../types/task';
import { Modal, ConfirmDialog } from '../common/Modal';
import { Button } from '../common/Button';
import { TaskForm } from './TaskForm';
import { MoveDialog } from './MoveDialog';
import { toRecurrence, type TaskFormValues } from '../../utils/taskForm';
import { useTasks } from '../../hooks/useTasks';
import { formatLongDate, formatTime12 } from '../../utils/date';

type DialogState =
  | { kind: 'none' }
  | { kind: 'actions'; task: Task }
  | { kind: 'edit'; task: Task | null; date: string }
  | { kind: 'move'; task: Task }
  | { kind: 'delete'; task: Task };

/**
 * All task dialogs (actions sheet, add/edit form, reschedule, delete).
 * Usage: const dlg = useTaskDialogs(); … dlg.openActions(task) … {dlg.element}
 */
export function useTaskDialogs() {
  const [state, setState] = useState<DialogState>({ kind: 'none' });
  const close = () => setState({ kind: 'none' });
  const ops = useTasks();

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
      const updated: Task = {
        ...task,
        title: v.title,
        date: v.date,
        category: v.category,
        startTime: v.startTime,
        endTime: v.endTime,
        priority: v.priority,
        notes: v.notes,
        subjectId: v.category === 'college' ? v.subjectId || undefined : undefined,
      };
      if (!task.templateId && rec) ops.makeRecurring(updated, rec);
      else ops.save(updated);
    }
    close();
  };

  let element: JSX.Element | null = null;
  if (state.kind === 'actions') {
    const t = state.task;
    const go = (next: DialogState) => setState(next);
    element = (
      <Modal open title={t.title} onClose={close}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          {formatLongDate(t.date)} · {formatTime12(t.startTime)} – {formatTime12(t.endTime)}
        </p>
        <div className="grid gap-2">
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
    element = <MoveDialog task={state.task} onClose={close} onMove={(d, s, e) => (ops.move(state.task, d, s, e), close())} />;
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
    toggle: ops.toggle,
  };
}
