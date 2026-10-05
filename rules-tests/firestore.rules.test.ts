import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { createDefaultData } from '../src/data/defaultData';
import { splitData, toPlain, chunkHash, type CoreChunk, type MonthChunk } from '../src/sync/chunks';

let env: RulesTestEnvironment;

const data = createDefaultData();
data.notes.push({ id: 'n1', title: 'Loops', content: 'for / while', category: 'java', date: '2026-10-05', updatedAt: '' });
const chunks = splitData(data);
const core = toPlain(chunks.get('core')!) as CoreChunk;
const month = toPlain(chunks.get('m-2026-10')!) as MonthChunk;

function chunkDoc(body: unknown, extra: Record<string, unknown> = {}) {
  return { v: 1, hash: chunkHash(body as never), editedAt: Date.now(), device: 'device_test', data: body, updatedAt: serverTimestamp(), ...extra };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kiran-planner',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
beforeEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

const kiran = () => env.authenticatedContext('kiran', { email: 'kiran@example.com', email_verified: true }).firestore();
const other = () => env.authenticatedContext('mallory').firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('owner access', () => {
  it('can create, read, list and update their own chunks', async () => {
    const db = kiran();
    await assertSucceeds(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core)));
    await assertSucceeds(setDoc(doc(db, 'users/kiran/chunks/m-2026-10'), chunkDoc(month)));
    await assertSucceeds(getDoc(doc(db, 'users/kiran/chunks/core')));
    await assertSucceeds(getDocs(collection(db, 'users/kiran/chunks')));
    await assertSucceeds(setDoc(doc(db, 'users/kiran/chunks/m-2026-10'), chunkDoc({ ...month, notes: [] })));
  });

  it('can write with the compare-and-set transaction the app uses', async () => {
    const db = kiran();
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const ref = doc(db, 'users/kiran/chunks/core');
        await tx.get(ref);
        tx.set(ref, chunkDoc(core));
      }),
    );
  });
});

describe('attacks that must fail', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/kiran/chunks/core'), { ...chunkDoc(core), updatedAt: Timestamp.now() });
    });
  });

  it('blocks signed-out users', async () => {
    await assertFails(getDoc(doc(anon(), 'users/kiran/chunks/core')));
    await assertFails(getDocs(collection(anon(), 'users/kiran/chunks')));
    await assertFails(setDoc(doc(anon(), 'users/kiran/chunks/core'), chunkDoc(core)));
  });

  it("blocks other users from reading or writing Kiran's data", async () => {
    await assertFails(getDoc(doc(other(), 'users/kiran/chunks/core')));
    await assertFails(getDocs(collection(other(), 'users/kiran/chunks')));
    await assertFails(setDoc(doc(other(), 'users/kiran/chunks/core'), chunkDoc(core)));
    await assertFails(setDoc(doc(other(), 'users/kiran/chunks/m-2030-01'), chunkDoc(month)));
  });

  it('rejects bad document ids, extra or missing fields and wrong types', async () => {
    const db = kiran();
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/anything'), chunkDoc(month)));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/m-2026-1'), chunkDoc(month)));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core, { admin: true })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), { v: 1, data: core, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core, { v: 2 })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core, { hash: 'x'.repeat(33) })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core, { device: 'd'.repeat(65) })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core, { editedAt: 'yesterday' })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(core, { data: 'not a map' })));
  });

  it('rejects a faked server time', async () => {
    await assertFails(setDoc(doc(kiran(), 'users/kiran/chunks/core'), chunkDoc(core, { updatedAt: Timestamp.fromMillis(0) })));
  });

  it('rejects malformed chunk data (update bypass, schema pollution, oversized lists)', async () => {
    const db = kiran();
    const { goals: _omit, ...coreWithoutGoals } = core;
    void _omit;
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(coreWithoutGoals)));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc({ ...core, secret: 'x' })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc({ ...core, profile: 'Kiran' })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/core'), chunkDoc(month))); // month data in core
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/m-2026-10'), chunkDoc(core))); // core data in a month
    const tooManyDays = Array.from({ length: 32 }, (_, i) => ({ date: `2026-10-${String((i % 31) + 1).padStart(2, '0')}` }));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/m-2026-10'), chunkDoc({ ...month, dayLogs: tooManyDays })));
    await assertFails(setDoc(doc(db, 'users/kiran/chunks/m-2026-10'), chunkDoc({ ...month, tasks: 'lots' })));
  });

  it('never allows deletes or other collections', async () => {
    await assertFails(deleteDoc(doc(kiran(), 'users/kiran/chunks/core')));
    await assertFails(setDoc(doc(kiran(), 'users/kiran'), { name: 'Kiran' }));
    await assertFails(setDoc(doc(kiran(), 'public/notes'), { text: 'hi' }));
    await assertFails(getDoc(doc(kiran(), 'users/kiran')));
  });
});
