/**
 * Cloud sync engine (local-first).
 *
 * The browser copy (localStorage) stays the source of truth for the UI, so
 * the app is instant and works offline. The engine mirrors it to the cloud
 * chunk by chunk (see chunks.ts):
 *
 *  - Local change  → changed chunks are uploaded (debounced). Every upload
 *    is a compare-and-set: it only replaces the cloud chunk if the cloud
 *    still has the version this device last saw; otherwise the newer cloud
 *    version is fetched and merged first, so no device overwrites another.
 *  - Remote change → if this device has no unsynced edits in that chunk the
 *    cloud version is taken; if both changed (e.g. two devices offline) the
 *    chunk is merged by item id so nothing is lost, then re-uploaded.
 *  - First sign-in → empty cloud: upload. Fresh device: download.
 *    Both have data: the user chooses merge / cloud / this device.
 *
 * `synced[chunkId]` remembers the hash both sides agreed on last time; it
 * is how the engine tells "changed here" from "changed there".
 * The backend is an interface, so the logic is unit tested without Firebase.
 */
import type { AppData } from '../types/app';
import { repairData } from '../utils/storage';
import {
  chunkHash,
  emptyChunk,
  untouchedHash,
  isChunkId,
  isPristine,
  joinChunks,
  mergeChunk,
  splitData,
  toPlain,
  type ChunkData,
  type Chunks,
} from './chunks';

export interface RemoteChunk {
  id: string;
  data: ChunkData;
  editedAt: number;
  device: string;
}

export interface FetchResult {
  chunks: RemoteChunk[];
  /** False when the server could not be reached and a local cache was used. */
  fromServer: boolean;
}

export interface SnapshotMeta {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export interface CloudBackend {
  fetchAll(uid: string): Promise<FetchResult>;
  subscribe(uid: string, onChange: (chunks: RemoteChunk[], meta: SnapshotMeta) => void, onError: (e: unknown) => void): () => void;
  /**
   * Writes a chunk only if the cloud copy still hashes to `expectedHash`
   * (undefined = missing or empty). Must reject with SyncConflictError otherwise.
   */
  write(uid: string, chunk: RemoteChunk & { hash: string }, expectedHash: string | undefined): Promise<void>;
}

/** The cloud chunk changed since this device last saw it. */
export class SyncConflictError extends Error {
  readonly code = 'sync-conflict';
  constructor() {
    super('Cloud data changed on another device');
  }
}

/** Compare-and-set check shared by every backend. */
export function matchesExpected(id: string, currentHash: string | undefined, expectedHash: string | undefined): boolean {
  const empty = chunkHash(emptyChunk(id));
  return (currentHash ?? empty) === (expectedHash ?? empty);
}

function isConflict(e: unknown): boolean {
  return e instanceof SyncConflictError || (e as { code?: string })?.code === 'sync-conflict';
}

function isOfflineError(e: unknown): boolean {
  const code = String((e as { code?: string })?.code ?? '');
  const msg = String((e as { message?: string })?.message ?? '');
  return code.includes('unavailable') || /offline/i.test(msg);
}

export type SyncState = 'idle' | 'connecting' | 'synced' | 'saving' | 'offline' | 'error' | 'needs-choice';

export interface SyncStatus {
  state: SyncState;
  message?: string;
  lastSyncedAt?: number;
}

export interface SyncMeta {
  uid: string;
  synced: Record<string, string>;
}

export type SyncChoice = 'merge' | 'cloud' | 'device';

export interface EngineOptions {
  backend: CloudBackend;
  getLocal: () => AppData;
  applyLocal: (data: AppData) => void;
  loadMeta: () => SyncMeta | null;
  saveMeta: (meta: SyncMeta | null) => void;
  onStatus: (status: SyncStatus) => void;
  deviceId: string;
  debounceMs?: number;
  isOnline?: () => boolean;
}

/** Firestore documents are limited to 1 MiB; stay well below. */
export const MAX_CHUNK_BYTES = 900_000;

export function describeSyncError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'The cloud refused the change. Check that firestore.rules is published (see README → Cloud sync).';
  if (code.includes('unavailable')) return 'Cloud is unreachable right now. Changes are kept on this device and will sync later.';
  if (code.includes('resource-exhausted')) return 'Firebase free quota reached for today. Changes are kept on this device and will sync later.';
  return 'Cloud sync had a problem. Your data is safe on this device.';
}

export class SyncEngine {
  private uid: string | null = null;
  private synced: Record<string, string> = {};
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Chunk id → hash currently being written. */
  private inflight = new Map<string, string>();
  private choiceRemote: RemoteChunk[] | null = null;
  private status: SyncStatus = { state: 'idle' };
  private lastSyncedAt: number | undefined;
  private readonly debounceMs: number;
  private readonly isOnline: () => boolean;

  constructor(private readonly o: EngineOptions) {
    this.debounceMs = o.debounceMs ?? 1200;
    this.isOnline = o.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  }

  get currentStatus(): SyncStatus {
    return this.status;
  }

  get signedInUid(): string | null {
    return this.uid;
  }

  /** Called after sign-in (and on every app start while signed in). */
  async start(uid: string): Promise<void> {
    this.stop(false);
    this.uid = uid;
    this.setStatus({ state: 'connecting' });
    let result: FetchResult;
    try {
      result = await this.o.backend.fetchAll(uid);
    } catch (e) {
      if (this.uid === uid) this.setStatus({ state: 'error', message: describeSyncError(e) });
      return;
    }
    if (this.uid !== uid) return; // signed out meanwhile
    const remote = result.chunks.filter((c) => isChunkId(c.id));
    const meta = this.o.loadMeta();
    const known = meta?.uid === uid;

    if (known) {
      // Returning device: continue from the last agreed state.
      this.synced = { ...meta.synced };
      this.applyRemote(remote);
    } else if (!result.fromServer && remote.length === 0) {
      // Never synced and offline: don't guess, wait for the network.
      this.setStatus({ state: 'offline', message: 'Connect to the internet to finish setting up sync.' });
      return;
    } else if (remote.length === 0) {
      // First device: the cloud is empty, upload everything.
      this.synced = {};
    } else if (isPristine(this.o.getLocal())) {
      // New device with nothing on it: download.
      this.takeCloud(remote);
    } else {
      this.choiceRemote = remote;
      this.setStatus({ state: 'needs-choice' });
      return;
    }
    this.persist();
    this.listen();
    await this.flush();
  }

  /** Answer to "this device and the cloud both have data". */
  async resolveChoice(choice: SyncChoice): Promise<void> {
    const remote = this.choiceRemote;
    if (!remote || !this.uid) return;
    this.choiceRemote = null;
    if (choice === 'cloud') {
      this.takeCloud(remote);
    } else {
      // Treat the cloud as the common base; this device's chunks become the edits.
      this.synced = Object.fromEntries(remote.map((r) => [r.id, chunkHash(r.data)]));
      if (choice === 'merge') {
        const local = splitData(this.o.getLocal());
        for (const r of remote) local.set(r.id, mergeChunk(r.id, local.get(r.id), r.data)!);
        this.apply(local);
      }
      // 'device': nothing to apply; months only in the cloud are uploaded empty (replaced).
    }
    this.persist();
    this.listen();
    await this.flush();
  }

  /** Stop syncing (sign-out). `forget` clears the sync memory for this device. */
  stop(forget: boolean): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.uid = null;
    this.choiceRemote = null;
    this.inflight.clear();
    this.synced = {};
    if (forget) this.o.saveMeta(null);
    this.setStatus({ state: 'idle' });
  }

  /** Local data changed (debounced upload). */
  notifyLocalChange(): void {
    if (!this.uid || this.choiceRemote) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  /** Network came back / went away. */
  connectivityChanged(): void {
    if (!this.uid) return;
    if (!this.isOnline()) {
      this.setStatus(this.offlineStatus());
      return;
    }
    if (this.status.state === 'offline' && !this.unsubscribe && !this.choiceRemote) {
      void this.start(this.uid); // finish an interrupted first sign-in
      return;
    }
    void this.flush();
  }

  /** Upload every chunk that changed since the last sync. */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const uid = this.uid;
    if (!uid || this.choiceRemote) return;
    const chunks = splitData(this.o.getLocal());
    const ids = new Set([...chunks.keys(), ...Object.keys(this.synced)]);
    const jobs: Promise<'ok' | 'conflict' | 'offline' | { error: unknown }>[] = [];
    let tooLarge: string | null = null;

    for (const id of ids) {
      if (this.inflight.has(id)) continue; // one write per chunk at a time; re-checked when it finishes
      const chunk = chunks.get(id) ?? emptyChunk(id);
      if (!chunk) continue;
      const hash = chunkHash(chunk);
      const base = this.synced[id];
      if (hash === (base ?? untouchedHash(id))) continue;
      const data = toPlain(chunk);
      if (JSON.stringify(data).length > MAX_CHUNK_BYTES) {
        tooLarge = id;
        continue;
      }
      this.inflight.set(id, hash);
      jobs.push(
        this.o.backend
          .write(uid, { id, data, hash, editedAt: Date.now(), device: this.o.deviceId }, base)
          .then(() => {
            if (this.uid === uid) {
              this.synced[id] = hash;
              this.persist();
            }
            return 'ok' as const;
          })
          .catch((e: unknown) => (isConflict(e) ? ('conflict' as const) : isOfflineError(e) ? ('offline' as const) : { error: e }))
          .finally(() => {
            if (this.inflight.get(id) === hash) this.inflight.delete(id);
          }),
      );
    }

    if (tooLarge) {
      this.setStatus({ state: 'error', message: `Too much data in ${tooLarge} to sync. Export a backup and delete old notes or sessions.` });
    }
    if (jobs.length === 0) {
      if (!tooLarge && this.inflight.size === 0 && this.status.state !== 'error' && !this.hasDirty()) this.markSynced();
      return;
    }
    this.setStatus(this.isOnline() ? { state: 'saving', lastSyncedAt: this.lastSyncedAt } : this.offlineStatus());
    const results = await Promise.all(jobs);
    if (this.uid !== uid) return;

    const failure = results.find((r): r is { error: unknown } => typeof r === 'object');
    if (failure) {
      this.setStatus({ state: 'error', message: describeSyncError(failure.error), lastSyncedAt: this.lastSyncedAt });
      return; // retried on the next change, reconnect or "Sync now"
    }
    if (results.includes('offline')) {
      this.setStatus(this.offlineStatus());
      return; // retried when the connection comes back
    }
    if (results.includes('conflict')) {
      // Another device wrote first: fetch its version, merge, then upload again.
      try {
        const latest = await this.o.backend.fetchAll(uid);
        if (this.uid !== uid) return;
        this.applyRemote(latest.chunks.filter((c) => isChunkId(c.id)));
      } catch (e) {
        this.setStatus(isOfflineError(e) ? this.offlineStatus() : { state: 'error', message: describeSyncError(e) });
        return;
      }
    }
    if (this.hasDirty()) this.notifyLocalChange();
    else if (this.inflight.size === 0 && !tooLarge) this.markSynced();
  }

  /* ───────────────────────── internals ───────────────────────── */

  private listen() {
    if (!this.uid || this.unsubscribe) return;
    const uid = this.uid;
    this.unsubscribe = this.o.backend.subscribe(
      uid,
      (chunks, meta) => {
        if (this.uid !== uid || this.choiceRemote) return;
        this.applyRemote(chunks.filter((c) => isChunkId(c.id)));
        if (meta.fromCache) return;
        // Connected to the server: push anything still waiting (e.g. edits made offline).
        if (this.hasDirty()) this.notifyLocalChange();
        else if (this.inflight.size === 0 && !meta.hasPendingWrites && this.status.state !== 'error') this.markSynced();
      },
      (e) => {
        if (this.uid === uid) this.setStatus({ state: 'error', message: describeSyncError(e) });
      },
    );
  }

  /** Apply remote chunks that changed since the last agreed state. */
  private applyRemote(remote: RemoteChunk[]) {
    const local = splitData(this.o.getLocal());
    let changed = false;
    for (const r of remote) {
      const remoteHash = chunkHash(r.data);
      const base = this.synced[r.id];
      if (remoteHash === base) continue; // nothing new
      if (this.inflight.get(r.id) === remoteHash) {
        this.synced[r.id] = remoteHash; // our own write echoing back before its promise resolved
        continue;
      }
      const localChunk = local.get(r.id) ?? emptyChunk(r.id) ?? undefined;
      const localHash = chunkHash(localChunk);
      this.synced[r.id] = remoteHash;
      if (localHash === remoteHash) continue;
      const localDirty = localHash !== (base ?? untouchedHash(r.id));
      local.set(r.id, localDirty ? mergeChunk(r.id, localChunk, r.data)! : r.data);
      changed = true;
    }
    this.persist();
    if (changed) {
      this.apply(local);
      this.notifyLocalChange(); // merged chunks go back up
    }
  }

  /** Any chunk with local edits that are not in the cloud yet (and not being written). */
  private hasDirty(): boolean {
    const chunks = splitData(this.o.getLocal());
    for (const id of new Set([...chunks.keys(), ...Object.keys(this.synced)])) {
      if (this.inflight.has(id)) continue;
      const chunk = chunks.get(id) ?? emptyChunk(id);
      if (chunk && chunkHash(chunk) !== (this.synced[id] ?? untouchedHash(id))) return true;
    }
    return false;
  }

  private offlineStatus(): SyncStatus {
    return { state: 'offline', message: 'Offline — changes are saved on this device and will sync later.', lastSyncedAt: this.lastSyncedAt };
  }

  private takeCloud(remote: RemoteChunk[]) {
    const chunks: Chunks = new Map(remote.map((r) => [r.id, r.data]));
    this.synced = Object.fromEntries(remote.map((r) => [r.id, chunkHash(r.data)]));
    this.apply(chunks);
  }

  private apply(chunks: Chunks) {
    const { data } = repairData(joinChunks(chunks, this.o.getLocal()));
    this.o.applyLocal(data);
  }

  private markSynced() {
    this.lastSyncedAt = Date.now();
    this.setStatus({ state: this.isOnline() ? 'synced' : 'offline', lastSyncedAt: this.lastSyncedAt });
  }

  private persist() {
    if (this.uid) this.o.saveMeta({ uid: this.uid, synced: { ...this.synced } });
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.o.onStatus(status);
  }
}
