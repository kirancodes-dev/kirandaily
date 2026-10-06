import { describe, expect, it } from 'vitest';
import { SyncConflictError, SyncEngine, matchesExpected, type CloudBackend, type RemoteChunk, type SnapshotMeta, type SyncMeta, type SyncStatus } from './engine';
import { chunkHash, isPristine, joinChunks, mergeChunk, splitData, stableStringify, toPlain } from './chunks';
import { createDefaultData } from '../data/defaultData';
import { buildStatsContext, getDayTasks } from '../utils/calculations';
import { setCompleted } from '../utils/taskActions';
import { repairData } from '../utils/storage';
import type { AppData } from '../types/app';

/* ───────────── in-memory fake of Firestore (one server, many devices) ───────────── */

type Stored = RemoteChunk & { hash: string };

class FakeServer {
  docs = new Map<string, Map<string, Stored>>();
  writes = 0;
  clients = new Set<FakeClient>();
  all(uid: string): RemoteChunk[] {
    return [...(this.docs.get(uid)?.values() ?? [])].map((d) => structuredClone(d));
  }
  put(uid: string, chunk: Stored) {
    if (!this.docs.has(uid)) this.docs.set(uid, new Map());
    this.docs.get(uid)!.set(chunk.id, structuredClone(chunk));
    this.writes++;
    for (const c of this.clients) c.notify(uid);
  }
}

class FakeClient implements CloudBackend {
  online = true;
  private listeners: { uid: string; cb: (c: RemoteChunk[], m: SnapshotMeta) => void }[] = [];
  constructor(private server: FakeServer) {
    server.clients.add(this);
  }
  async fetchAll(uid: string) {
    return this.online ? { chunks: this.server.all(uid), fromServer: true } : { chunks: [], fromServer: false };
  }
  subscribe(uid: string, cb: (c: RemoteChunk[], m: SnapshotMeta) => void) {
    const l = { uid, cb };
    this.listeners.push(l);
    if (this.online) queueMicrotask(() => cb(this.server.all(uid), { fromCache: false, hasPendingWrites: false }));
    return () => {
      this.listeners = this.listeners.filter((x) => x !== l);
    };
  }
  /** Like the Firestore transaction: needs the network and only writes over the expected version. */
  async write(uid: string, chunk: Stored, expected: string | undefined) {
    await Promise.resolve();
    if (!this.online) throw { code: 'unavailable', message: 'client is offline' };
    const current = this.server.docs.get(uid)?.get(chunk.id);
    if (!matchesExpected(chunk.id, current ? chunkHash(current.data) : undefined, expected)) throw new SyncConflictError();
    this.server.put(uid, chunk);
  }
  notify(uid: string) {
    if (!this.online) return;
    for (const l of this.listeners) if (l.uid === uid) l.cb(this.server.all(uid), { fromCache: false, hasPendingWrites: false });
  }
  setOnline(online: boolean) {
    this.online = online;
    if (online) {
      for (const l of this.listeners) l.cb(this.server.all(l.uid), { fromCache: false, hasPendingWrites: false });
    }
  }
}

function device(server: FakeServer, initial: AppData = createDefaultData()) {
  const state = { data: initial, meta: null as SyncMeta | null, status: { state: 'idle' } as SyncStatus };
  const client = new FakeClient(server);
  const engine = new SyncEngine({
    backend: client,
    getLocal: () => state.data,
    applyLocal: (d) => {
      state.data = d;
    },
    loadMeta: () => state.meta,
    saveMeta: (m) => {
      state.meta = m;
    },
    onStatus: (s) => {
      state.status = s;
    },
    deviceId: `dev-${Math.random()}`,
    debounceMs: 0,
    isOnline: () => client.online,
  });
  return {
    state,
    client,
    engine,
    edit(fn: (d: AppData) => AppData) {
      state.data = fn(state.data);
      engine.notifyLocalChange();
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 2));
};

function complete(title: string, date = '2026-10-05') {
  return (d: AppData) => setCompleted(d, getDayTasks(buildStatsContext(d), date).find((t) => t.title === title)!, true);
}

function completedTitles(d: AppData, date = '2026-10-05') {
  return getDayTasks(buildStatsContext(d), date)
    .filter((t) => t.completed)
    .map((t) => t.title)
    .sort();
}

function addNote(id: string, title: string, date = '2026-10-05') {
  return (d: AppData): AppData => ({
    ...d,
    notes: [...d.notes, { id, title, content: '', category: 'java', date, updatedAt: '' }],
  });
}

/* ───────────── chunk helpers ───────────── */

describe('chunks', () => {
  it('splits by month and joins back to the same data', () => {
    let d = complete('Gym')(createDefaultData());
    d = complete('Java', '2026-11-02')(d);
    d = addNote('n1', 'Loops', '2026-12-01')(d);
    const chunks = splitData(d);
    expect([...chunks.keys()].sort()).toEqual(['core', 'ext', 'm-2026-10', 'm-2026-11', 'm-2026-12']);
    const back = repairData(joinChunks(new Map([...chunks].map(([k, v]) => [k, toPlain(v)])))).data;
    expect(stableStringify(back)).toBe(stableStringify(d));
  });

  it('hashes independent of key order and undefined fields', () => {
    expect(chunkHash({ a: 1, b: undefined, c: [1, { y: 2, x: 1 }] } as never)).toBe(chunkHash({ c: [1, { x: 1, y: 2 }], a: 1 } as never));
    expect(chunkHash({ a: 1 } as never)).not.toBe(chunkHash({ a: 2 } as never));
  });

  it('merges offline edits by id without losing either side', () => {
    const base = splitData(createDefaultData());
    const a = splitData(addNote('n1', 'A')(createDefaultData())).get('m-2026-10');
    const b = splitData(addNote('n2', 'B')(createDefaultData())).get('m-2026-10');
    const merged = mergeChunk('m-2026-10', a, b) as { notes: { id: string }[] };
    expect(merged.notes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(mergeChunk('core', base.get('core'), base.get('core'))).toEqual(base.get('core'));
  });

  it('keeps profile, events and prefs in the ext chunk and merges events by id', () => {
    const d = createDefaultData();
    d.profileExtra.links.github = 'kiran';
    const ext = splitData(d).get('ext') as { profileExtra: { links: { github: string } }; events: { id: string }[] };
    expect(ext.profileExtra.links.github).toBe('kiran');
    expect(ext.events.length).toBeGreaterThan(30);
    const mine = { ...ext, events: [...ext.events, { id: 'mine' }] };
    const theirs = { ...ext, events: [...ext.events, { id: 'theirs' }] };
    const merged = mergeChunk('ext', mine as never, theirs as never) as { events: { id: string }[] };
    expect(merged.events.map((e) => e.id)).toEqual(expect.arrayContaining(['mine', 'theirs']));
  });

  it('knows a fresh install', () => {
    expect(isPristine(createDefaultData())).toBe(true);
    expect(isPristine(addNote('n', 'x')(createDefaultData()))).toBe(false);
  });
});

/* ───────────── engine ───────────── */

describe('sync engine', () => {
  it('uploads from the first device and downloads on a fresh device, then syncs live', async () => {
    const server = new FakeServer();
    const a = device(server, complete('Gym')(createDefaultData()));
    await a.engine.start('kiran');
    await settle();
    // core + October. Profile details, calendar and preferences (ext) are still the
    // first-run defaults, so there is nothing to upload yet (see the upgrade test below).
    expect([...server.docs.get('kiran')!.keys()].sort()).toEqual(['core', 'm-2026-10']);
    expect(a.state.status.state).toBe('synced');

    const b = device(server); // fresh phone
    await b.engine.start('kiran');
    await settle();
    expect(completedTitles(b.state.data)).toEqual(['Gym']);

    b.edit(complete('Java'));
    await settle();
    expect(completedTitles(a.state.data)).toEqual(['Gym', 'Java']);

    a.edit((d) => ({ ...d, profile: { ...d.profile, name: 'Kiran K' } }));
    await settle();
    expect(b.state.data.profile.name).toBe('Kiran K');

    a.edit((d) => ({ ...d, profileExtra: { ...d.profileExtra, bio: 'CSE' }, prefs: { ...d.prefs, remindBeforeMinutes: 10 } }));
    await settle();
    expect(server.docs.get('kiran')!.has('ext')).toBe(true);
    expect(b.state.data.profileExtra.bio).toBe('CSE');
    expect(b.state.data.prefs.remindBeforeMinutes).toBe(10);

    // No echo loops: a handful of writes, not hundreds.
    expect(server.writes).toBeLessThan(10);
  });

  it('merges edits made on two devices while one was offline', async () => {
    const server = new FakeServer();
    const a = device(server);
    await a.engine.start('kiran');
    const b = device(server);
    await b.engine.start('kiran');
    await settle();

    b.client.setOnline(false);
    a.edit(complete('Gym'));
    b.edit(complete('Java'));
    b.edit(addNote('n-b', 'Offline note'));
    await settle();
    expect(completedTitles(a.state.data)).toEqual(['Gym']);

    b.client.setOnline(true);
    b.engine.connectivityChanged();
    await settle();
    for (const d of [a, b]) {
      expect(completedTitles(d.state.data)).toEqual(['Gym', 'Java']);
      expect(d.state.data.notes.map((n) => n.title)).toEqual(['Offline note']);
    }
    expect(stableStringify(a.state.data)).toBe(stableStringify(b.state.data));
  });

  it('never lets a reconnecting device overwrite newer cloud data', async () => {
    const server = new FakeServer();
    const a = device(server);
    await a.engine.start('kiran');
    const b = device(server);
    await b.engine.start('kiran');
    await settle();

    a.client.setOnline(false);
    a.edit(complete('Revision'));
    await settle();
    expect(a.state.status.state).toBe('offline');
    b.edit(complete('Dinner'));
    b.edit(addNote('n1', 'temp'));
    await settle();
    b.edit((d) => ({ ...d, notes: [] })); // deleted again – must stay deleted
    await settle();

    a.client.setOnline(true);
    a.engine.connectivityChanged();
    await settle();
    for (const d of [a, b]) {
      expect(completedTitles(d.state.data)).toEqual(['Dinner', 'Revision']);
      expect(d.state.data.notes).toHaveLength(0);
    }
    expect(a.state.status.state).toBe('synced');
  });

  it('a device upgrading from v1.0 takes the profile details another device synced, instead of wiping them', async () => {
    // Both devices synced under v1.0: the cloud and their sync memory have core, no ext.
    const server = new FakeServer();
    const core = toPlain(splitData(createDefaultData()).get('core')!);
    server.put('kiran', { id: 'core', data: core, hash: chunkHash(core), editedAt: 1, device: 'v1.0' });
    const v10 = (): SyncMeta => ({ uid: 'kiran', synced: { core: chunkHash(core) } });
    const mac = device(server);
    mac.state.meta = v10();
    const phone = device(server);
    phone.state.meta = v10();

    // The Mac opens v1.1 first and fills in the profile and reminder settings.
    await mac.engine.start('kiran');
    await settle();
    mac.edit((d) => ({
      ...d,
      profileExtra: { ...d.profileExtra, bio: 'Mac bio', links: { ...d.profileExtra.links, github: 'kirancodes-dev' } },
      prefs: { ...d.prefs, timeGate: false, remindBeforeMinutes: 10 },
    }));
    await settle();

    // Then the iPhone opens v1.1, its profile details untouched.
    await phone.engine.start('kiran');
    await settle();
    for (const d of [mac, phone]) {
      expect(d.state.data.profileExtra.links.github).toBe('kirancodes-dev');
      expect(d.state.data.profileExtra.bio).toBe('Mac bio');
      expect(d.state.data.prefs).toMatchObject({ timeGate: false, remindBeforeMinutes: 10 });
    }
    expect((server.docs.get('kiran')!.get('ext')!.data as AppData).profileExtra.bio).toBe('Mac bio');
  });

  it('"Merge both" keeps the cloud’s profile, settings and progress where this device still has the defaults', async () => {
    const server = new FakeServer();
    const mac = device(server, addNote('n-a', 'From laptop')(createDefaultData()));
    await mac.engine.start('kiran');
    await settle();
    mac.edit((d) => ({
      ...d,
      profile: { ...d.profile, name: 'Kiran K' },
      profileExtra: { ...d.profileExtra, bio: 'Mac bio' },
      prefs: { ...d.prefs, timeGate: false },
    }));
    await settle();

    // A new iPhone with one note of its own signs in and merges.
    const phone = device(server, addNote('n-b', 'From phone')(createDefaultData()));
    await phone.engine.start('kiran');
    expect(phone.state.status.state).toBe('needs-choice');
    await phone.engine.resolveChoice('merge');
    await settle();
    for (const d of [mac, phone]) {
      expect(d.state.data.notes.map((n) => n.title).sort()).toEqual(['From laptop', 'From phone']);
      expect(d.state.data.profile.name).toBe('Kiran K');
      expect(d.state.data.profileExtra.bio).toBe('Mac bio');
      expect(d.state.data.prefs.timeGate).toBe(false);
    }
  });

  it('asks before mixing two devices that both have data', async () => {
    for (const choice of ['merge', 'cloud', 'device'] as const) {
      const server = new FakeServer();
      const a = device(server, addNote('n-a', 'From laptop')(createDefaultData()));
      await a.engine.start('kiran');
      await settle();
      const b = device(server, addNote('n-b', 'From phone')(createDefaultData()));
      await b.engine.start('kiran');
      expect(b.state.status.state).toBe('needs-choice');
      expect(server.docs.get('kiran')!.get('m-2026-10')!.data).toMatchObject({ notes: [{ id: 'n-a' }] }); // untouched until answered

      await b.engine.resolveChoice(choice);
      await settle();
      const expected = { merge: ['From laptop', 'From phone'], cloud: ['From laptop'], device: ['From phone'] }[choice];
      for (const d of [a, b]) expect(d.state.data.notes.map((n) => n.title).sort(), `${choice}`).toEqual(expected);
    }
  });

  it('waits for the network before a first sync instead of overwriting the cloud', async () => {
    const server = new FakeServer();
    const a = device(server, addNote('n-a', 'Cloud copy')(createDefaultData()));
    await a.engine.start('kiran');
    await settle();
    const writes = server.writes;

    const b = device(server, addNote('n-b', 'Phone copy')(createDefaultData()));
    b.client.setOnline(false);
    await b.engine.start('kiran');
    expect(b.state.status.state).toBe('offline');
    expect(server.writes).toBe(writes);

    b.client.setOnline(true);
    b.engine.connectivityChanged();
    await settle();
    expect(b.state.status.state).toBe('needs-choice');
  });

  it('syncs deletions and keeps working after a sign-out/sign-in', async () => {
    const server = new FakeServer();
    const a = device(server, addNote('n1', 'Old note', '2026-09-20')(createDefaultData()));
    await a.engine.start('kiran');
    const b = device(server);
    await b.engine.start('kiran');
    await settle();
    expect(b.state.data.notes).toHaveLength(1);

    a.edit((d) => ({ ...d, notes: [] })); // September becomes empty
    await settle();
    expect(b.state.data.notes).toHaveLength(0);

    b.engine.stop(true);
    expect(b.state.meta).toBeNull();
    a.edit(addNote('n2', 'While B signed out'));
    await settle();
    expect(b.state.data.notes).toHaveLength(0);
    await b.engine.start('kiran'); // B is not pristine-with-different-data: same data as cloud minus new note
    await settle();
    if (b.state.status.state === 'needs-choice') await b.engine.resolveChoice('merge');
    await settle();
    expect(b.state.data.notes.map((n) => n.title)).toEqual(['While B signed out']);
  });

  it('ignores cloud chunks it does not understand (written by a newer app version)', async () => {
    const server = new FakeServer();
    server.put('kiran', { id: 'future-feature', data: { x: 1 } as never, hash: 'h', editedAt: 1, device: 'other' });
    const a = device(server, addNote('n1', 'mine')(createDefaultData()));
    await a.engine.start('kiran');
    await settle();
    expect(server.docs.get('kiran')!.get('future-feature')!.data).toEqual({ x: 1 }); // untouched
    expect(a.state.data.notes).toHaveLength(1);
  });

  it('reports cloud errors and retries the chunk later', async () => {
    const server = new FakeServer();
    const a = device(server);
    const realWrite = a.client.write.bind(a.client);
    let fail = true;
    a.client.write = (uid, chunk, expected) => (fail ? Promise.reject({ code: 'permission-denied' }) : realWrite(uid, chunk, expected));
    await a.engine.start('kiran');
    await settle();
    expect(a.state.status.state).toBe('error');
    expect(a.state.status.message).toMatch(/firestore\.rules/);

    fail = false;
    await a.engine.flush();
    await settle();
    expect(server.docs.get('kiran')!.has('core')).toBe(true);
    expect(a.state.status.state).toBe('synced');
  });
});
