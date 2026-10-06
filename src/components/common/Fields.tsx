import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { inputClass as INPUT } from './styles';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
}

function FieldWrap({ id, label, hint, error, className = '', children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, hint, error, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        className={INPUT}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        // Inside a Modal, autoFocus runs before the dialog opens; the Modal focuses this instead.
        data-autofocus={rest.autoFocus || undefined}
        {...rest}
      />
    </FieldWrap>
  );
}

export function TextArea({ label, hint, error, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} rows={3} className={`${INPUT} min-h-[88px]`} aria-invalid={!!error || undefined} {...rest} />
    </FieldWrap>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  options,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} className={className}>
      <select id={id} className={INPUT} aria-invalid={!!error || undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}
