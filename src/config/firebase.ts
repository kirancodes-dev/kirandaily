/**
 * ─────────────────────────────────────────────────────────────
 *  FIREBASE (CLOUD SYNC) CONFIGURATION
 * ─────────────────────────────────────────────────────────────
 *  Paste the values from Firebase Console → Project settings →
 *  "Your apps" → Web app → SDK setup and configuration → Config.
 *
 *  These values are NOT secrets — Google designs the web config to be
 *  public. Your data is protected by Google sign-in and the rules in
 *  firestore.rules (only you can read or write your own data).
 *
 *  While apiKey is empty the app runs local-only (no sign-in, no sync).
 *  VITE_FIREBASE_* environment variables override the pasted values.
 * ─────────────────────────────────────────────────────────────
 */
// ⬇️  Paste your Firebase web app config here (Firebase Console → Project settings → Your apps).
const pastedConfig = {
  apiKey: 'AIzaSyDWUsRc_dNLS8-vc416mvqwgUfypOKnLiQ',
  authDomain: 'agenda-e8a71.firebaseapp.com',
  projectId: 'agenda-e8a71',
  storageBucket: 'agenda-e8a71.firebasestorage.app',
  messagingSenderId: '734119157016',
  appId: '1:734119157016:web:ba1ebaca10f2d1f01ad26d',
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || pastedConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || pastedConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || pastedConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || pastedConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || pastedConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || pastedConfig.appId,
};

/** Local testing against the Firebase emulators (`npm run test:sync`). Never set for the real site. */
export const useFirebaseEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === 'true';

export const isCloudConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
