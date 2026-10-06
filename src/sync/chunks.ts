/**
 * Splits the app data into cloud "chunks" (Firestore documents) and back.
 *
 *   core        – profile, settings, categories, timetable templates,
 *                 subjects, roadmaps, CGPA, goals, projects
 *   m-YYYY-MM   – everything dated in that month: tasks, deleted-task
 *                 markers, day logs, study sessions, DSA/German logs,
 *                 notes and weekly reviews
 *   ext         – added in v1.1: profile details (photo, links), calendar
 *                 events (semester calendar + important dates), preferences.
 *                 A separate chunk so older app versions, which don't know
 *                 these fields, ignore it instead of overwriting it.
 *
 * Monthly chunks keep every document far below Firestore's 1 MiB limit,
 * and a day's changes only touch one or two small documents.
 * Everything here is pure (no Firebase), so it is unit tested.
 */
import type { AppData } from '../types/app';
import { createDefaultData } from '../data/defaultData';

export const CORE_KEYS = ['profile', 'settings', 'categories', 'templates', 'subjects', 'roadmaps', 'cgpa', 'goals', 'projects'] as const;
export const MONTH_KEYS = ['tasks', 'exclusions', 'dayLogs', 'sessions', 'problemLogs', 'germanLogs', 'notes', 'weeklyReviews'] as const;
export const EXT_KEYS = ['profileExtra', 'events', 'prefs', 'semesterInfo'] as const;

export type CoreChunk = Pick<AppData, (typeof CORE_KEYS)[number]>;
export type MonthChunk = Pick<AppData, (typeof MONTH_KEYS)[number]>;
export type ExtChunk = Pick<AppData, (typeof EXT_KEYS)[number]>;
export type ChunkData = CoreChunk | MonthChunk | ExtChunk;
export type Chunks = Map<string, ChunkData>;

export const CORE_ID = 'core';
export const EXT_ID = 'ext';
const FALLBACK_MONTH = '0000-00';

export function monthChunkId(date: string | undefined): string {
  return `m-${date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : FALLBACK_MONTH}`;
}

export function isChunkId(id: string): boolean {
  return id === CORE_ID || id === EXT_ID || /^m-\d{4}-\d{2}$/.test(id);
}

export function emptyMonth(): MonthChunk {
  return { tasks: [], exclusions: [], dayLogs: [], sessions: [], problemLogs: [], germanLogs: [], notes: [], weeklyReviews: [] };
}

/** Empty value for a chunk id (core and ext have no "empty", they are always present). */
export function emptyChunk(id: string): ChunkData | null {
  return id === CORE_ID || id === EXT_ID ? null : emptyMonth();
}

let defaults: { data: AppData; ext: string } | null = null;

/** The first-run data, and the hash of its ext chunk (built once). */
function firstRun() {
  if (!defaults) {
    const data = createDefaultData();
    defaults = { data, ext: chunkHash(splitData(data).get(EXT_ID)) };
  }
  return defaults;
}

/**
 * Hash of a chunk this device has never synced and never changed: an empty
 * month, or the first-run ext chunk. A device that synced under v1.0 has no
 * ext yet; comparing it with this (not with "nothing") means its untouched
 * defaults are taken from the cloud instead of overwriting it.
 */
export function untouchedHash(id: string): string {
  return id === EXT_ID ? firstRun().ext : chunkHash(emptyChunk(id));
}

/** Month an item belongs to. */
function itemDate(key: (typeof MONTH_KEYS)[number], item: unknown): string | undefined {
  if (key === 'exclusions') {
    const s = String(item);
    return s.slice(s.lastIndexOf('@') + 1);
  }
  const o = item as Record<string, unknown>;
  return (key === 'weeklyReviews' ? o.weekStart : o.date) as string | undefined;
}

export function splitData(data: AppData): Chunks {
  const chunks: Chunks = new Map();
  const core = {} as Record<string, unknown>;
  for (const k of CORE_KEYS) core[k] = data[k];
  chunks.set(CORE_ID, core as unknown as CoreChunk);
  const ext = {} as Record<string, unknown>;
  for (const k of EXT_KEYS) ext[k] = data[k];
  chunks.set(EXT_ID, ext as unknown as ExtChunk);
  for (const key of MONTH_KEYS) {
    for (const item of data[key] as unknown[]) {
      const id = monthChunkId(itemDate(key, item));
      let month = chunks.get(id) as MonthChunk | undefined;
      if (!month) {
        month = emptyMonth();
        chunks.set(id, month);
      }
      (month[key] as unknown[]).push(item);
    }
  }
  return chunks;
}

/** Rebuilds app data from chunks. The result is validated/repaired by the caller (repairData). */
export function joinChunks(chunks: Chunks, fallback: AppData = createDefaultData()): Record<string, unknown> {
  const core = (chunks.get(CORE_ID) ?? {}) as Partial<CoreChunk>;
  const out: Record<string, unknown> = { version: 1 };
  for (const k of CORE_KEYS) out[k] = core[k] ?? fallback[k];
  const ext = (chunks.get(EXT_ID) ?? {}) as Partial<ExtChunk>;
  for (const k of EXT_KEYS) out[k] = ext[k] ?? fallback[k];
  for (const k of MONTH_KEYS) out[k] = [];
  const ids = [...chunks.keys()].filter((id) => id !== CORE_ID && id !== EXT_ID).sort();
  for (const id of ids) {
    const month = chunks.get(id) as Partial<MonthChunk>;
    for (const k of MONTH_KEYS) {
      const items = month?.[k];
      if (Array.isArray(items)) (out[k] as unknown[]).push(...items);
    }
  }
  return out;
}

/* ───────────────────────── hashing ───────────────────────── */

/** JSON with sorted object keys and undefined dropped, so equal data always hashes equally. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** cyrb53 – small, fast, good-enough content hash. */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function chunkHash(chunk: ChunkData | null | undefined): string {
  return hashString(stableStringify(chunk ?? null));
}

/** Plain JSON copy (drops undefined) – what Firestore stores. */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/* ───────────────────────── merging ───────────────────────── */

function unionBy<T>(local: T[], remote: T[], key: (item: T) => string): T[] {
  const out = new Map<string, T>();
  for (const item of remote) out.set(key(item), item);
  for (const item of local) out.set(key(item), item); // this device wins on the same item
  return [...out.values()];
}

const byId = (x: unknown) => String((x as { id?: unknown }).id);

/** An object section (profile, settings…): this device's version, unless it is still the first-run default and the other side's isn't. */
function changedSide<K extends keyof AppData>(key: K, local: AppData[K] | undefined, remote: AppData[K] | undefined): AppData[K] | undefined {
  if (remote === undefined) return local;
  if (local === undefined) return remote;
  return stableStringify(local) === stableStringify(firstRun().data[key]) ? remote : local;
}

/**
 * Merges a chunk edited on two devices while offline. Lists are combined by
 * id (nothing is lost; this device wins when both changed the same item).
 * Single objects (profile, settings, roadmaps, CGPA, profile details,
 * preferences) keep this device's version, unless this device never changed
 * it from the first-run default; then the other device's version is kept.
 */
export function mergeChunk(id: string, local: ChunkData | undefined, remote: ChunkData | undefined): ChunkData | undefined {
  if (!local) return remote;
  if (!remote) return local;
  if (id === EXT_ID) {
    const l = local as ExtChunk;
    const r = remote as ExtChunk;
    return {
      ...l,
      profileExtra: changedSide('profileExtra', l.profileExtra, r.profileExtra)!,
      prefs: changedSide('prefs', l.prefs, r.prefs)!,
      semesterInfo: changedSide('semesterInfo', l.semesterInfo, r.semesterInfo)!,
      events: unionBy(l.events ?? [], r.events ?? [], byId),
    };
  }
  if (id === CORE_ID) {
    const l = local as CoreChunk;
    const r = remote as CoreChunk;
    return {
      ...l,
      profile: changedSide('profile', l.profile, r.profile)!,
      settings: changedSide('settings', l.settings, r.settings)!,
      roadmaps: changedSide('roadmaps', l.roadmaps, r.roadmaps)!,
      cgpa: changedSide('cgpa', l.cgpa, r.cgpa)!,
      categories: unionBy(l.categories ?? [], r.categories ?? [], byId),
      templates: unionBy(l.templates ?? [], r.templates ?? [], byId),
      subjects: unionBy(l.subjects ?? [], r.subjects ?? [], byId),
      goals: unionBy(l.goals ?? [], r.goals ?? [], byId),
      projects: unionBy(l.projects ?? [], r.projects ?? [], byId),
    };
  }
  const l = local as MonthChunk;
  const r = remote as MonthChunk;
  return {
    tasks: unionBy(l.tasks ?? [], r.tasks ?? [], byId),
    exclusions: unionBy(l.exclusions ?? [], r.exclusions ?? [], String),
    dayLogs: unionBy(l.dayLogs ?? [], r.dayLogs ?? [], (d) => d.date),
    sessions: unionBy(l.sessions ?? [], r.sessions ?? [], byId),
    problemLogs: unionBy(l.problemLogs ?? [], r.problemLogs ?? [], byId),
    germanLogs: unionBy(l.germanLogs ?? [], r.germanLogs ?? [], byId),
    notes: unionBy(l.notes ?? [], r.notes ?? [], byId),
    weeklyReviews: unionBy(l.weeklyReviews ?? [], r.weeklyReviews ?? [], (w) => w.weekStart),
  };
}

/** True when the data is exactly the untouched first-run state. */
export function isPristine(data: AppData): boolean {
  return stableStringify(data) === stableStringify(createDefaultData());
}
