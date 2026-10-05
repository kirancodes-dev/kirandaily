import { useCallback } from 'react';
import type { CalendarEvent, Prefs, ProfileExtra } from '../types/extras';
import { useAppData } from './useAppData';
import { uid } from '../utils/id';

/** Profile details, calendar events and preferences (v1.1 data). */
export function useExtras() {
  const { data, update } = useAppData();
  const updateProfileExtra = useCallback(
    (patch: Partial<ProfileExtra>) => update((d) => ({ ...d, profileExtra: { ...d.profileExtra, ...patch } })),
    [update],
  );
  const updatePrefs = useCallback((patch: Partial<Prefs>) => update((d) => ({ ...d, prefs: { ...d.prefs, ...patch } })), [update]);
  const addEvent = useCallback(
    (e: Omit<CalendarEvent, 'id'>) => update((d) => ({ ...d, events: [...d.events, { ...e, id: uid('evt') }] })),
    [update],
  );
  const saveEvent = useCallback(
    (e: CalendarEvent) => update((d) => ({ ...d, events: d.events.map((x) => (x.id === e.id ? e : x)) })),
    [update],
  );
  const removeEvent = useCallback((id: string) => update((d) => ({ ...d, events: d.events.filter((x) => x.id !== id) })), [update]);
  return {
    profileExtra: data.profileExtra,
    events: data.events,
    prefs: data.prefs,
    semesterInfo: data.semesterInfo,
    updateProfileExtra,
    updatePrefs,
    addEvent,
    saveEvent,
    removeEvent,
  };
}
