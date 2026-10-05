import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isCloudConfigured } from '../config/firebase';
import { useAppData } from '../hooks/useAppData';
import { SyncEngine, type SyncChoice, type SyncMeta, type SyncStatus } from '../sync/engine';
import { describeSignInError, loadFirebase, type CloudUser, type FirebaseServices } from '../sync/firebaseBackend';
import { uid as randomId } from '../utils/id';
import { SyncContext } from './contexts';

const META_KEY = 'kiran-planner:sync';
const DEVICE_KEY = 'kiran-planner:device';

function loadMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    const m = raw ? (JSON.parse(raw) as SyncMeta) : null;
    return m && typeof m.uid === 'string' && m.synced && typeof m.synced === 'object' ? m : null;
  } catch {
    return null;
  }
}

function saveMeta(meta: SyncMeta | null) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    /* storage full / private mode */
  }
}

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = randomId('device');
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'device';
  }
}

/** Connects the local app data to Firestore when cloud sync is configured. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, replace } = useAppData();
  const dataRef = useRef(data);
  const engineRef = useRef<SyncEngine | null>(null);
  const servicesRef = useRef<FirebaseServices | null>(null);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' });
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCloudConfigured) return;
    let cancelled = false;
    let unsubscribeUser: (() => void) | undefined;
    loadFirebase()
      .then((services) => {
        if (cancelled) return;
        servicesRef.current = services;
        const engine = new SyncEngine({
          backend: services.backend,
          getLocal: () => dataRef.current,
          applyLocal: (next) => {
            dataRef.current = next;
            replace(next);
          },
          loadMeta,
          saveMeta,
          onStatus: setStatus,
          deviceId: deviceId(),
        });
        engineRef.current = engine;
        unsubscribeUser = services.onUser((u) => {
          setUser(u);
          setReady(true);
          if (u) {
            if (engine.signedInUid !== u.uid) void engine.start(u.uid);
          } else {
            engine.stop(false);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
          setStatus({ state: 'error', message: 'Cloud sync could not load. Check your internet connection and reload.' });
        }
      });
    return () => {
      cancelled = true;
      unsubscribeUser?.();
      engineRef.current?.stop(false);
      engineRef.current = null;
    };
  }, [replace]);

  // Every local change → (debounced) upload.
  useEffect(() => {
    dataRef.current = data;
    engineRef.current?.notifyLocalChange();
  }, [data]);

  // Connectivity and leaving the app.
  useEffect(() => {
    if (!isCloudConfigured) return;
    const onConnectivity = () => engineRef.current?.connectivityChanged();
    const onHide = () => {
      if (document.visibilityState === 'hidden') void engineRef.current?.flush();
    };
    window.addEventListener('online', onConnectivity);
    window.addEventListener('offline', onConnectivity);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('online', onConnectivity);
      window.removeEventListener('offline', onConnectivity);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const signIn = useCallback(async () => {
    setSignInError(null);
    try {
      const services = servicesRef.current ?? (await loadFirebase());
      servicesRef.current = services;
      await services.signIn();
    } catch (e) {
      setSignInError(describeSignInError(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    const engine = engineRef.current;
    if (engine) {
      await engine.flush().catch(() => undefined);
      engine.stop(true);
    }
    await servicesRef.current?.signOut();
  }, []);

  const syncNow = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.signedInUid) return;
    if (engine.currentStatus.state === 'error' || engine.currentStatus.state === 'offline') void engine.start(engine.signedInUid);
    else void engine.flush();
  }, []);

  const resolveChoice = useCallback((choice: SyncChoice) => void engineRef.current?.resolveChoice(choice), []);
  const clearSignInError = useCallback(() => setSignInError(null), []);

  const value = useMemo(
    () => ({ configured: isCloudConfigured, ready, user, status, signIn, signOut, syncNow, resolveChoice, signInError, clearSignInError }),
    [ready, user, status, signIn, signOut, syncNow, resolveChoice, signInError, clearSignInError],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
