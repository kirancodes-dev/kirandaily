import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, ExternalLink, Github, Globe, GraduationCap, Linkedin, Loader2, Code2, Pencil, Trash2, Link2 } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useExtras } from '../../hooks/useExtras';
import { useToast } from '../../hooks/useToast';
import { Avatar } from './Avatar';
import { Button } from '../common/Button';
import { EditProfileDialog } from './EditProfileDialog';
import { fileToPhotoDataUrl, PhotoError } from '../../utils/image';
import { profileLinks, type ProfileLinkId } from '../../utils/profileForm';

const LINK_ICONS: Record<ProfileLinkId, typeof Github> = {
  github: Github,
  leetcode: Code2,
  linkedin: Linkedin,
  portfolio: Globe,
};

/** Big profile card: photo (tap to change), name, headline, college, bio and links. */
export function ProfileHeader() {
  const { data } = useAppData();
  const { profileExtra: p, updateProfileExtra } = useExtras();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const links = profileLinks(p.links);
  const schoolLine = [p.college, p.semester ? `Semester ${p.semester}` : ''].filter(Boolean).join(' · ');

  const pickPhoto = () => fileRef.current?.click();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still triggers a change
    if (!file) return;
    setBusy(true);
    try {
      const photo = await fileToPhotoDataUrl(file);
      updateProfileExtra({ photo });
      toast({ id: 'kp-photo', title: 'Profile photo updated', tone: 'success', duration: 3000 });
    } catch (err) {
      toast({
        id: 'kp-photo',
        title: 'Couldn’t use that photo',
        body: err instanceof PhotoError ? err.message : 'Try a different picture (JPEG or PNG).',
        tone: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    const old = p.photo;
    updateProfileExtra({ photo: '' });
    toast({ id: 'kp-photo', title: 'Photo removed', tone: 'info', action: { label: 'Undo', onClick: () => updateProfileExtra({ photo: old }) } });
  };

  return (
    <section aria-labelledby="profile-name" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div aria-hidden className="h-20 bg-gradient-to-r from-brand-600 via-indigo-500 to-emerald-500 sm:h-24" />
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
          <button
            type="button"
            onClick={pickPhoto}
            disabled={busy}
            aria-label={p.photo ? 'Change profile photo' : 'Add profile photo'}
            className="group relative shrink-0 rounded-full ring-4 ring-white disabled:cursor-wait dark:ring-slate-900"
          >
            <Avatar size={96} />
            <span className="absolute bottom-0.5 right-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white group-hover:bg-brand-700 dark:ring-slate-900">
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Camera size={18} aria-hidden />}
            </span>
          </button>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Pencil size={18} aria-hidden />} onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-label="Choose profile photo" onChange={onFile} />

        <h2 id="profile-name" className="mt-3 break-words text-2xl font-bold tracking-tight [overflow-wrap:anywhere]">
          {data.profile.name}
        </h2>
        {p.headline && <p className="mt-0.5 break-words text-base text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">{p.headline}</p>}
        {schoolLine && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-400">
            <GraduationCap size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{schoolLine}</span>
          </p>
        )}
        {p.bio && (
          <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">{p.bio}</p>
        )}

        {links.length > 0 ? (
          <ul aria-label="Links" className="mt-4 flex flex-wrap gap-2">
            {links.map((l) => {
              const Icon = LINK_ICONS[l.id];
              return (
                <li key={l.id} className="min-w-0 max-w-full">
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-touch max-w-full items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <Icon size={16} aria-hidden className="shrink-0" />
                    <span>{l.label}</span>
                    <span className="hidden min-w-0 truncate text-slate-500 dark:text-slate-400 sm:inline">{l.detail}</span>
                    <ExternalLink size={14} aria-hidden className="shrink-0 text-slate-400" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-4 inline-flex min-h-touch items-center gap-2 rounded-full border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Link2 size={16} aria-hidden /> Add GitHub, LeetCode, LinkedIn…
          </button>
        )}

        <div className="-mx-1 mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button variant="ghost" className="!px-3 !text-sm" icon={<Camera size={18} aria-hidden />} onClick={pickPhoto} disabled={busy}>
            {busy ? 'Saving photo…' : p.photo ? 'Change photo' : 'Add photo'}
          </Button>
          {p.photo && (
            <Button variant="ghost" className="!px-3 !text-sm" icon={<Trash2 size={18} aria-hidden />} onClick={removePhoto} disabled={busy}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
      <EditProfileDialog open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}
