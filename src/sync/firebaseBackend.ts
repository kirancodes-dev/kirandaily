/**
 * Firebase implementation of the sync backend (Google sign-in + Firestore).
 * Loaded on demand, so the app does not download Firebase unless cloud sync
 * is configured in src/config/firebase.ts.
 *
 * Firestore layout:  users/{uid}/chunks/{core | m-YYYY-MM}
 *   { v: 1, hash, editedAt, device, data: {...}, updatedAt: serverTimestamp }
 */
import { firebaseConfig, useFirebaseEmulators } from '../config/firebase';
import { chunkHash, type ChunkData } from './chunks';
import { SyncConflictError, matchesExpected, type CloudBackend, type RemoteChunk } from './engine';

export interface CloudUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface FirebaseServices {
  backend: CloudBackend;
  onUser(cb: (user: CloudUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

let loading: Promise<FirebaseServices> | null = null;

export function loadFirebase(): Promise<FirebaseServices> {
  loading ??= init().catch((e) => {
    loading = null; // allow a retry (e.g. the first load happened offline)
    throw e;
  });
  return loading;
}

async function init(): Promise<FirebaseServices> {
  const [{ initializeApp }, authMod, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);

  let db: import('firebase/firestore').Firestore;
  try {
    // Offline cache shared by all open tabs; undefined fields are simply left out.
    db = fs.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.initializeFirestore(app, { ignoreUndefinedProperties: true });
  }

  if (useFirebaseEmulators) {
    authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    // Emulator builds only (removed from the real site): sign in without the Google
    // popup – the Auth emulator accepts an unsigned Google token. Used by e2e-sync.
    (window as unknown as { __kpEmulatorSignIn?: (email: string) => Promise<unknown> }).__kpEmulatorSignIn = (email) =>
      authMod.signInWithCredential(auth, authMod.GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
  }

  const chunksOf = (uid: string) => fs.collection(db, 'users', uid, 'chunks');
  const toRemote = (snap: import('firebase/firestore').QueryDocumentSnapshot): RemoteChunk => {
    const v = snap.data() as { data?: ChunkData; editedAt?: number; device?: string };
    return { id: snap.id, data: (v.data ?? {}) as ChunkData, editedAt: v.editedAt ?? 0, device: v.device ?? '' };
  };

  const backend: CloudBackend = {
    async fetchAll(uid) {
      try {
        const snap = await fs.getDocsFromServer(chunksOf(uid));
        return { chunks: snap.docs.map(toRemote), fromServer: true };
      } catch {
        const snap = await fs.getDocs(chunksOf(uid)); // offline: use the local cache
        return { chunks: snap.docs.map(toRemote), fromServer: false };
      }
    },
    subscribe(uid, onChange, onError) {
      return fs.onSnapshot(
        chunksOf(uid),
        { includeMetadataChanges: true },
        (snap) => onChange(snap.docs.map(toRemote), { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites }),
        onError,
      );
    },
    async write(uid, chunk, expectedHash) {
      const ref = fs.doc(chunksOf(uid), chunk.id);
      // A transaction makes this a compare-and-set: it fails offline (retried
      // later) and refuses to overwrite a version this device hasn't seen.
      await fs.runTransaction(db, async (tx) => {
        const current = await tx.get(ref);
        const currentHash = current.exists() ? chunkHash((current.data() as { data?: ChunkData }).data) : undefined;
        if (!matchesExpected(chunk.id, currentHash, expectedHash)) throw new SyncConflictError();
        tx.set(ref, {
          v: 1,
          hash: chunk.hash,
          editedAt: chunk.editedAt,
          device: chunk.device,
          data: chunk.data,
          updatedAt: fs.serverTimestamp(),
        });
      });
    },
  };

  return {
    backend,
    onUser: (cb) =>
      authMod.onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, name: u.displayName, email: u.email, photoURL: u.photoURL } : null),
      ),
    async signIn() {
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await authMod.signInWithPopup(auth, provider);
    },
    signOut: () => authMod.signOut(auth),
  };
}

/** Friendly text for sign-in failures. */
export function describeSignInError(e: unknown): string {
  const code = String((e as { code?: string })?.code ?? '');
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Sign-in was cancelled.';
  if (code.includes('popup-blocked')) return 'The sign-in window was blocked. Allow pop-ups for this site and try again.';
  if (code.includes('unauthorized-domain'))
    return 'This website is not allowed to sign in yet. In Firebase Console → Authentication → Settings → Authorized domains, add this site’s domain.';
  if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled. Turn it on in Firebase Console → Authentication → Sign-in method.';
  if (code.includes('network-request-failed')) return 'No internet connection. Try again when you are online.';
  return `Sign-in failed${code ? ` (${code})` : ''}. Please try again.`;
}
