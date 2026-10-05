import { useState } from 'react';
import { Pause, Play, Square, Trash2 } from 'lucide-react';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { useAppData } from '../../hooks/useAppData';
import { formatClock } from '../../utils/timer';
import { formatMinutes } from '../../utils/date';
import { scheduleConfig } from '../../config/schedule';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Banner } from '../common/Feedback';
import { ConfirmDialog } from '../common/Modal';
import type { TimerMode } from '../../types/study';

interface Props {
  onFinish: (minutes: number, source: 'timer' | 'pomodoro', startedAt: number | null) => void;
}

export function StudyTimer({ onFinish }: Props) {
  const timer = useStudyTimer();
  const { data } = useAppData();
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const presets = [...scheduleConfig.pomodoroPresets];
  if (!presets.some((p) => p.focus === data.settings.pomodoro.focus && p.break === data.settings.pomodoro.break)) {
    presets.unshift(data.settings.pomodoro);
  }
  const [presetKey, setPresetKey] = useState(`${data.settings.pomodoro.focus}/${data.settings.pomodoro.break}`);
  const preset = presets.find((p) => `${p.focus}/${p.break}` === presetKey) ?? presets[0];
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { state, pomodoro } = timer;
  const idle = state.status === 'idle';

  return (
    <Card title="Study session">
      {timer.error && <Banner tone="error">{timer.error}</Banner>}
      {idle ? (
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Timer mode" className="grid grid-cols-2 gap-2">
            {(['stopwatch', 'pomodoro'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-touch rounded-xl px-3 font-medium ring-1 ring-inset ${
                  mode === m ? 'bg-brand-50 text-brand-800 ring-brand-600 dark:bg-brand-500/15 dark:text-brand-200' : 'ring-slate-300 dark:ring-slate-600'
                }`}
              >
                {m === 'stopwatch' ? 'Simple timer' : 'Pomodoro'}
              </button>
            ))}
          </div>
          {mode === 'pomodoro' && (
            <div role="radiogroup" aria-label="Pomodoro length" className="flex flex-wrap gap-2">
              {presets.map((p) => {
                const key = `${p.focus}/${p.break}`;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={presetKey === key}
                    onClick={() => setPresetKey(key)}
                    className={`min-h-touch rounded-xl px-4 font-medium tabular-nums ring-1 ring-inset ${
                      presetKey === key ? 'bg-brand-600 text-white ring-brand-600' : 'ring-slate-300 dark:ring-slate-600'
                    }`}
                  >
                    {p.focus}/{p.break}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-center font-mono text-5xl font-semibold tabular-nums" aria-hidden>
            00:00:00
          </p>
          <Button variant="primary" block icon={<Play size={20} aria-hidden />} onClick={() => timer.start(mode, preset)} className="text-lg">
            Start Study Session
          </Button>
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">The timer is optional — you can also just tick tasks.</p>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          {pomodoro && (
            <p className={`text-lg font-semibold ${pomodoro.phase === 'focus' ? 'text-brand-700 dark:text-brand-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {pomodoro.phase === 'focus' ? `Focus ${pomodoro.cycle + 1}` : 'Break'} · {formatClock(pomodoro.phaseRemainingMs)} left
            </p>
          )}
          <p className="font-mono text-5xl font-semibold tabular-nums" role="timer" aria-live="off" aria-label="Elapsed time">
            {formatClock(timer.elapsed)}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {state.status === 'paused' ? 'Paused · ' : ''}
            Study time: {formatMinutes(Math.floor(timer.studyMs / 60_000))}
            {pomodoro && ' (breaks not counted)'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {state.status === 'running' ? (
              <Button icon={<Pause size={20} aria-hidden />} onClick={timer.pause}>
                Pause
              </Button>
            ) : (
              <Button icon={<Play size={20} aria-hidden />} onClick={timer.resume}>
                Resume
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Square size={18} aria-hidden />}
              onClick={() => {
                const startedAt = state.startedAt;
                const source = state.mode === 'pomodoro' ? 'pomodoro' : 'timer';
                const minutes = timer.stop();
                onFinish(minutes, source, startedAt);
              }}
            >
              Finish
            </Button>
          </div>
          <Button variant="ghost" icon={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmDiscard(true)}>
            Discard session
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        danger
        title="Discard this session?"
        message="The time will not be saved."
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          timer.discard();
          setConfirmDiscard(false);
        }}
      />
    </Card>
  );
}
