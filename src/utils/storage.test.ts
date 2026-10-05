import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../data/defaultData';
import { exportJson, loadData, parseImport, repairData, saveData, type StorageAdapter } from './storage';

function memoryAdapter(initial: string | null = null) {
  const store = { raw: initial, backups: [] as string[] };
  const adapter: StorageAdapter = {
    load: () => store.raw,
    save: (raw) => {
      store.raw = raw;
    },
    backup: (raw) => store.backups.push(raw),
  };
  return { store, adapter };
}

describe('storage', () => {
  it('loads defaults for a new user and persists changes', () => {
    const { store, adapter } = memoryAdapter();
    const first = loadData(adapter);
    expect(first.warnings).toEqual([]);
    const changed = { ...first.data, profile: { ...first.data.profile, name: 'K' } };
    expect(saveData(changed, adapter)).toBeNull();
    expect(loadData(adapter).data.profile.name).toBe('K');
    expect(store.backups).toHaveLength(0);
  });

  it('survives corrupted localStorage and keeps a backup', () => {
    const { store, adapter } = memoryAdapter('{not json');
    const result = loadData(adapter);
    expect(result.data.templates.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/corrupted/);
    expect(store.backups).toEqual(['{not json']);
  });

  it('repairs partially invalid data instead of crashing', () => {
    const data = createDefaultData();
    const broken = {
      ...data,
      settings: 'oops',
      notes: [{ id: 'n1', title: 'ok', content: '', category: 'java', date: '2026-10-05', updatedAt: '' }, { id: 'n2' }],
      tasks: [
        { id: 'a', date: '2026-10-05', title: 'X', category: 'java', startTime: '25:00', endTime: '10:00', duration: 0, completed: false, skipped: false, notes: '', priority: 'low', recurring: null },
      ],
      templates: data.templates.filter((t) => t.key !== 'gym'),
    };
    const { data: fixed, warnings } = repairData(broken);
    expect(fixed.settings.studyTargets.weekday).toBe(4);
    expect(fixed.notes).toHaveLength(1);
    expect(fixed.tasks).toHaveLength(0); // invalid time
    expect(fixed.templates.some((t) => t.key === 'gym')).toBe(true);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('round-trips export → import', () => {
    const data = createDefaultData();
    data.notes.push({ id: 'n1', title: 'Loops', content: 'for/while', category: 'java', date: '2026-10-05', updatedAt: '' });
    const result = parseImport(exportJson(data));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(data);
  });

  it('rejects invalid imports with readable errors', () => {
    expect(parseImport('hello')).toEqual({ ok: false, errors: ['The file is not valid JSON.'] });
    const bad = createDefaultData() as unknown as Record<string, unknown>;
    bad.tasks = [{ id: 'x', date: 'yesterday' }];
    const r = parseImport(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/tasks\.0/);
  });

  it('renames duplicate ids on import', () => {
    const data = createDefaultData();
    const note = { id: 'dup', title: 'a', content: '', category: 'java' as const, date: '2026-10-05', updatedAt: '' };
    data.notes = [note, { ...note, title: 'b' }];
    const r = parseImport(JSON.stringify(data));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(new Set(r.data.notes.map((n) => n.id)).size).toBe(2);
      expect(r.warnings.join(' ')).toMatch(/Duplicate id/);
    }
  });

  it('loads data saved by v1.0 (before profile/events/prefs existed) without warnings', () => {
    const v10 = createDefaultData() as unknown as Record<string, unknown>;
    for (const k of ['profileExtra', 'events', 'prefs', 'semesterInfo']) delete v10[k];
    const { store, adapter } = memoryAdapter(JSON.stringify(v10));
    const result = loadData(adapter);
    expect(result.warnings).toEqual([]);
    expect(store.backups).toHaveLength(0);
    expect(result.data.events.length).toBeGreaterThan(30); // semester calendar added
    expect(result.data.prefs.timeGate).toBe(true);
    // Old backups still import.
    const imported = parseImport(JSON.stringify({ app: 'kiran-planner', exportedAt: '', data: v10 }));
    expect(imported.ok).toBe(true);
  });

  it('rejects a profile photo that is not an image data URL', () => {
    const data = createDefaultData();
    const bad = { ...data, profileExtra: { ...data.profileExtra, photo: 'javascript:alert(1)' } };
    expect(parseImport(JSON.stringify(bad)).ok).toBe(false);
    const { data: repaired, warnings } = repairData(bad);
    expect(repaired.profileExtra.photo).toBe('');
    expect(warnings.join(' ')).toMatch(/profileExtra/);
  });
});
