import { useId, useRef, useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SelectField, TextArea, TextField } from '../common/Fields';
import { useAppData } from '../../hooks/useAppData';
import { useExtras } from '../../hooks/useExtras';
import { useToast } from '../../hooks/useToast';
import {
  PROFILE_LIMITS,
  formValuesFrom,
  validateProfileForm,
  type ProfileFormErrors,
  type ProfileFormValues,
} from '../../utils/profileForm';

const SEMESTERS = [{ value: '', label: 'Not set' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))];

/** Usernames and links: no auto-capitalising or auto-correct on iPhone. */
const PLAIN = { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const;

export function EditProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <EditProfileForm onClose={onClose} /> : null;
}

function EditProfileForm({ onClose }: { onClose: () => void }) {
  const { data, update } = useAppData();
  const { profileExtra, updateProfileExtra } = useExtras();
  const { toast } = useToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<ProfileFormValues>(() => formValuesFrom(data.profile.name, profileExtra));
  const [errors, setErrors] = useState<ProfileFormErrors>({});

  const set = (key: keyof ProfileFormValues) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateProfileForm(values);
    if (!result.value) {
      setErrors(result.errors);
      // Take the user to the first problem.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const { name, extra } = result.value;
    update((d) => ({ ...d, profile: { ...d.profile, name } }));
    updateProfileExtra(extra);
    toast({ title: 'Profile saved', tone: 'success', duration: 3000 });
    onClose();
  };

  return (
    <Modal
      open
      title="Edit profile"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary">
            Save profile
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label="Name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          autoComplete="name"
          maxLength={PROFILE_LIMITS.name}
          required
        />
        <TextField
          label="Headline"
          value={values.headline}
          onChange={set('headline')}
          error={errors.headline}
          placeholder="B.Tech CSE · 3rd year"
          maxLength={PROFILE_LIMITS.headline}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField
            label="College"
            value={values.college}
            onChange={set('college')}
            error={errors.college}
            autoComplete="organization"
            maxLength={PROFILE_LIMITS.college}
          />
          <SelectField label="Semester" value={values.semester} onChange={set('semester')} error={errors.semester} options={SEMESTERS} />
        </div>
        <TextArea
          label="Bio"
          value={values.bio}
          onChange={set('bio')}
          error={errors.bio}
          maxLength={PROFILE_LIMITS.bio}
          hint={`${values.bio.length}/${PROFILE_LIMITS.bio}`}
          placeholder="What are you working towards this semester?"
        />

        <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">Links</legend>
          <TextField
            label="GitHub username"
            value={values.github}
            onChange={set('github')}
            error={errors.github}
            placeholder="kirancodes-dev"
            hint="Just the username — or paste your profile link."
            maxLength={120}
            {...PLAIN}
          />
          <TextField
            label="LeetCode username"
            value={values.leetcode}
            onChange={set('leetcode')}
            error={errors.leetcode}
            placeholder="your_leetcode_name"
            maxLength={120}
            {...PLAIN}
          />
          <TextField
            label="LinkedIn URL"
            type="url"
            inputMode="url"
            value={values.linkedin}
            onChange={set('linkedin')}
            error={errors.linkedin}
            placeholder="https://www.linkedin.com/in/…"
            maxLength={PROFILE_LIMITS.url}
            {...PLAIN}
          />
          <TextField
            label="Portfolio URL"
            type="url"
            inputMode="url"
            value={values.portfolio}
            onChange={set('portfolio')}
            error={errors.portfolio}
            placeholder="https://…"
            maxLength={PROFILE_LIMITS.url}
            {...PLAIN}
          />
        </fieldset>
      </form>
    </Modal>
  );
}
