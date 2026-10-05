import { useAppData } from '../../hooks/useAppData';

/** Profile photo or initial. */
export function Avatar({ size = 36, className = '' }: { size?: number; className?: string }) {
  const { data } = useAppData();
  const photo = data.profileExtra.photo;
  const initial = (data.profile.name || '?').trim().slice(0, 1).toUpperCase();
  return photo ? (
    <img src={photo} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
