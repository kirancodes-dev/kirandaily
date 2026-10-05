import { useState } from 'react';
import { useAppData } from '../../hooks/useAppData';

/** Up to two initials: "Kiran Kumar" → "KK", "kiran" → "K". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Profile photo, or initials on a brand gradient when there is none (or it fails to load). */
export function Avatar({ size = 36, className = '' }: { size?: number; className?: string }) {
  const { data } = useAppData();
  const photo = data.profileExtra.photo;
  const [failed, setFailed] = useState('');
  const initials = initialsOf(data.profile.name);
  return photo && failed !== photo ? (
    <img
      src={photo}
      alt=""
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      onError={() => setFailed(photo)}
      className={`shrink-0 select-none rounded-full bg-slate-200 object-cover dark:bg-slate-700 ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * (initials.length > 1 ? 0.36 : 0.42) }}
    >
      {initials}
    </span>
  );
}
