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

/**
 * Fingerprint of a chunk version: one short hash per part (each list item,
 * each object field) together with its place in the chunk. Kept for the
 * version both devices last agreed on, it is the "base" of a three-way merge:
 * a part whose hash is still in the base was not changed on that side.
 */
export type ChunkPrint = string[];

type Path = string[];

/** Lists merged item by item, and the key of an item ("" = can't be keyed). */
const LIST_KEYS: Record<string, (item: unknown) => unknown> = {
  exclusions: (x) => x,
  dayLogs: (x) => (x as { date?: unknown })?.date,
  weeklyReviews: (x) => (x as { weekStart?: unknown })?.weekStart,
};

function itemKey(list: string, item: unknown): string {
  const key = (LIST_KEYS[list] ?? ((x: unknown) => (x as { id?: unknown })?.id))(item);
  return typeof key === 'string' && key ? key : '';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function keyedList(list: string, v: unknown): boolean {
  return Array.isArray(v) && v.every((x) => itemKey(list, x) !== '');
}

/**
 * Which parts are merged inside: the chunk, its sections (lists item by
 * item, objects field by field), small nested objects such as
 * settings.studyTargets or profileExtra.links, and roadmaps down to each
 * topic. A list item (a task, a note, an event…) is one unit.
 */
function looksInside(path: Path, node: unknown, inItem: boolean): boolean {
  const list = path[path.length - 1];
  const container = isPlainObject(node) || keyedList(list, node);
  if (!container) return false;
  if (path.length <= 1) return true;
  if (path[0] === 'roadmaps') return path.length <= 5;
  return !inItem && isPlainObject(node) && path.length <= 3;
}

function partHash(path: Path, json: string): string {
  return hashString(`${JSON.stringify(path)}${json}`).slice(0, 10);
}

/** Children of a container node: [key, value, isListItem]. */
function children(path: Path, node: unknown): [string, unknown, boolean][] {
  if (Array.isArray(node)) {
    const list = path[path.length - 1];
    return node.map((x) => [itemKey(list, x), x, true]);
  }
  return Object.entries(node as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, v, false]);
}

export function chunkPrint(chunk: ChunkData | null | undefined): ChunkPrint {
  const out: string[] = [];
  const walk = (path: Path, node: unknown, inItem: boolean) => {
    if (!looksInside(path, node, inItem)) return;
    for (const [key, child, isItem] of children(path, node)) {
      const p = [...path, key];
      out.push(partHash(p, stableStringify(child)));
      walk(p, child, inItem || isItem);
    }
  };
  walk([], chunk ?? null, false);
  return out;
}

const defaultPrints = new Map<string, { hash: string; print: ChunkPrint }>();

/** Hash and fingerprint of a chunk in the untouched first-run state (an empty month, the default core / ext). */
export function defaultBase(id: string): { hash: string; print: ChunkPrint } {
  const key = id === CORE_ID || id === EXT_ID ? id : 'month';
  let base = defaultPrints.get(key);
  if (!base) {
    const chunk = key === 'month' ? emptyMonth() : splitData(createDefaultData()).get(key)!;
    base = { hash: chunkHash(chunk), print: chunkPrint(chunk) };
    defaultPrints.set(key, base);
  }
  return base;
}

const STATUS_RANK: Record<string, number> = { not_started: 0, in_progress: 1, completed: 2 };

/** Both devices changed the same part: a roadmap topic keeps the more advanced status, anything else this device's version. */
function resolveConflict(path: Path, local: unknown, remote: unknown): unknown {
  if (path[0] === 'roadmaps' && path.length === 6) {
    const rank = (t: unknown) => STATUS_RANK[String((t as { status?: unknown })?.status)] ?? 0;
    return rank(remote) > rank(local) ? remote : local;
  }
  return local;
}

interface MergeOptions {
  /** Keep a part one side deleted (first sign-in "merge both": nothing is deleted). */
  keepDeleted?: boolean;
}

function merge3(path: Path, l: unknown, r: unknown, base: Set<string>, inItem: boolean, o: MergeOptions): unknown {
  if (l === undefined) return r === undefined || (!o.keepDeleted && base.has(partHash(path, stableStringify(r)))) ? undefined : r;
  if (r === undefined) return !o.keepDeleted && base.has(partHash(path, stableStringify(l))) ? undefined : l;
  const sl = stableStringify(l);
  const sr = stableStringify(r);
  if (sl === sr) return l;
  if (path.length > 0) {
    if (base.has(partHash(path, sl))) return r; // only the other device changed it
    if (base.has(partHash(path, sr))) return l; // only this device changed it
  }
  if (looksInside(path, l, inItem) && looksInside(path, r, inItem) && Array.isArray(l) === Array.isArray(r)) {
    if (Array.isArray(l) && Array.isArray(r)) {
      const list = path[path.length - 1];
      const mine = new Map(l.map((x) => [itemKey(list, x), x]));
      const theirs = new Map(r.map((x) => [itemKey(list, x), x]));
      // The other device's order, then items only this device has.
      const keys = [...new Set([...theirs.keys(), ...mine.keys()])];
      return keys.map((k) => merge3([...path, k], mine.get(k), theirs.get(k), base, true, o)).filter((x) => x !== undefined);
    }
    const lo = l as Record<string, unknown>;
    const ro = r as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(lo), ...Object.keys(ro)])) {
      const v = merge3([...path, k], lo[k], ro[k], base, inItem, o);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return resolveConflict(path, l, r);
}

/**
 * Merges a chunk changed on two devices (three-way, against `base`, the
 * fingerprint of the version both last agreed on). A part only one device
 * changed takes that device's version, deletions included, so a device that
 * merely holds an older copy never brings old values back. Parts both
 * changed are merged inside (lists by id, objects by field); a real
 * conflict keeps this device's version, except that a roadmap topic keeps
 * the more advanced status. Without a base every part counts as changed on
 * both sides: lists are combined (nothing is lost) and this device wins.
 */
export function mergeChunk(
  _id: string,
  local: ChunkData | undefined,
  remote: ChunkData | undefined,
  base?: ChunkPrint | null,
  options: MergeOptions = {},
): ChunkData | undefined {
  if (!local) return remote;
  if (!remote) return local;
  return merge3([], local, remote, new Set(base ?? []), false, options) as ChunkData;
}

/** True when the data is exactly the untouched first-run state. */
export function isPristine(data: AppData): boolean {
  return stableStringify(data) === stableStringify(createDefaultData());
}
