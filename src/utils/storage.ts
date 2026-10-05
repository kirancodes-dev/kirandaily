import type { AppData } from '../types/app';
import { createDefaultData, DATA_VERSION } from '../data/defaultData';
import { appDataSchema, collectionSchemas, sectionSchemas } from './schema';
import { uid } from './id';

/**
 * Storage layer. Everything goes through a StorageAdapter, so cloud sync can
 * later be added by writing another adapter (e.g. REST API) without touching UI code.
 */
export interface StorageAdapter {
  load(): string | null;
  save(raw: string): void;
  backup(raw: string): void;
}

export const STORAGE_KEY = 'kiran-planner:data';
export const TIMER_KEY = 'kiran-planner:timer';
const BACKUP_PREFIX = 'kiran-planner:corrupt-backup:';

export const localStorageAdapter: StorageAdapter = {
  load: () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  save: (raw) => localStorage.setItem(STORAGE_KEY, raw),
  backup: (raw) => {
    try {
      localStorage.setItem(BACKUP_PREFIX + new Date().toISOString(), raw);
    } catch {
      /* storage full – nothing else we can do */
    }
  },
};

export interface LoadResult {
  data: AppData;
  /** Human-readable problems that were repaired automatically. */
  warnings: string[];
}

type Collection = keyof typeof collectionSchemas;

/** Gives duplicate ids a new id so nothing gets overwritten. */
function dedupeIds<T extends { id: string }>(items: T[], label: string, warnings: string[]): T[] {
  const seen = new Set<string>();
  return items.map((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }
    const fresh = { ...item, id: uid(label) };
    seen.add(fresh.id);
    warnings.push(`Duplicate id "${item.id}" in ${label} was renamed.`);
    return fresh;
  });
}

function dedupeByDate<T extends { date: string }>(items: T[], label: string, warnings: string[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.date)) warnings.push(`Duplicate ${label} entry for ${item.date} was merged.`);
    map.set(item.date, { ...map.get(item.date), ...item });
  }
  return [...map.values()];
}

/**
 * Best-effort repair of stored data: invalid sections fall back to defaults,
 * invalid list items are dropped, duplicate ids are renamed. Never throws.
 */
export function repairData(input: unknown): LoadResult {
  const defaults = createDefaultData();
  const warnings: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { data: defaults, warnings: ['Saved data was unreadable and has been reset.'] };
  }
  const src = input as Record<string, unknown>;
  const out = { ...defaults } as AppData;
  const target = out as unknown as Record<string, unknown>;

  for (const [key, schema] of Object.entries(sectionSchemas)) {
    const parsed = schema.safeParse(src[key]);
    if (parsed.success) target[key] = parsed.data;
    else if (src[key] !== undefined) warnings.push(`"${key}" was invalid and has been reset to defaults.`);
  }

  for (const [key, schema] of Object.entries(collectionSchemas) as [Collection, (typeof collectionSchemas)[Collection]][]) {
    const value = src[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      warnings.push(`"${key}" was not a list and has been reset.`);
      continue;
    }
    const valid: unknown[] = [];
    value.forEach((item) => {
      const parsed = schema.safeParse(item);
      if (parsed.success) valid.push(parsed.data);
    });
    if (valid.length < value.length) warnings.push(`${value.length - valid.length} invalid item(s) removed from "${key}".`);
    target[key] =
      key === 'dayLogs'
        ? dedupeByDate(valid as AppData['dayLogs'], 'day log', warnings)
        : dedupeIds(valid as { id: string }[], key, warnings);
  }

  if (Array.isArray(src.exclusions)) out.exclusions = [...new Set(src.exclusions.filter((x) => typeof x === 'string'))];

  // Never allow the protected gym routine to vanish.
  if (!out.templates.some((t) => t.key === 'gym')) {
    const gym = defaults.templates.find((t) => t.key === 'gym');
    if (gym) {
      out.templates = [...out.templates, gym];
      warnings.push('The daily gym routine was missing and has been restored.');
    }
  }
  // Make sure built-in categories exist.
  for (const c of defaults.categories) {
    if (!out.categories.some((x) => x.id === c.id)) out.categories = [...out.categories, c];
  }
  out.version = DATA_VERSION;
  return { data: out, warnings };
}

export function loadData(adapter: StorageAdapter = localStorageAdapter): LoadResult {
  const raw = adapter.load();
  if (raw === null) return { data: createDefaultData(), warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    adapter.backup(raw);
    return {
      data: createDefaultData(),
      warnings: ['Saved data was corrupted and could not be read. A backup copy was kept in browser storage; the app started fresh.'],
    };
  }
  const strict = appDataSchema.safeParse(parsed);
  if (strict.success) {
    const result = repairData(strict.data); // still dedupes ids
    return result;
  }
  adapter.backup(raw);
  return repairData(parsed);
}

export function saveData(data: AppData, adapter: StorageAdapter = localStorageAdapter): string | null {
  try {
    adapter.save(JSON.stringify(data));
    return null;
  } catch (e) {
    return e instanceof Error && e.name === 'QuotaExceededError'
      ? 'Browser storage is full. Export your data and delete old notes or sessions.'
      : 'Could not save to browser storage. Your latest change may be lost after refresh.';
  }
}

/* ───────────────────────── export / import ───────────────────────── */

export interface ExportFile {
  app: 'kiran-planner';
  exportedAt: string;
  data: AppData;
}

export function exportJson(data: AppData, now = new Date()): string {
  const file: ExportFile = { app: 'kiran-planner', exportedAt: now.toISOString(), data };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true; data: AppData; warnings: string[] } | { ok: false; errors: string[] };

/** Strict validation: the import is refused if anything is invalid (duplicates are fixed and reported). */
export function parseImport(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  if (!json || typeof json !== 'object') return { ok: false, errors: ['The file does not contain planner data.'] };
  const obj = json as Record<string, unknown>;
  const payload = obj.app === 'kiran-planner' && obj.data ? obj.data : obj;
  const parsed = appDataSchema.safeParse(payload);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'file'}: ${i.message}`);
    if (parsed.error.issues.length > 8) errors.push(`…and ${parsed.error.issues.length - 8} more problem(s).`);
    return { ok: false, errors };
  }
  const { data, warnings } = repairData(parsed.data);
  return { ok: true, data, warnings };
}
