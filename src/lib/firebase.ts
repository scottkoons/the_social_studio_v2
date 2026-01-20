/**
 * Firebase Client SDK Configuration
 *
 * IMPORTANT: After modifying .env.local, you MUST restart the dev server.
 * Next.js only reads environment variables at build/start time.
 *
 * Required environment variables (must be in .env.local):
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

// Module-level singletons (lazy initialized)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let initializationError: Error | null = null;
let hasLoggedEnvStatus = false;

/**
 * Get Firebase config from environment variables.
 * IMPORTANT: Each env var must be accessed directly (not dynamically) for Next.js to inline them.
 */
function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/**
 * Get env var status for debugging.
 * Each var must be accessed directly for Next.js static replacement.
 */
function getEnvVarStatus() {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/**
 * Logs environment variable status once per session.
 */
function logEnvVarStatus(): void {
  if (hasLoggedEnvStatus) return;
  hasLoggedEnvStatus = true;

  if (typeof window === 'undefined') return;

  const status = getEnvVarStatus();
  const missing = Object.entries(status).filter(([, v]) => !v).map(([k]) => k);
  const present = Object.entries(status).filter(([, v]) => v).map(([k]) => k);

  console.group(
    `%c🔥 Firebase Configuration ${missing.length > 0 ? 'ERROR' : 'OK'}`,
    `color: ${missing.length > 0 ? '#ef4444' : '#22c55e'}; font-weight: bold; font-size: 14px;`
  );

  if (missing.length > 0) {
    console.log('%c❌ Missing environment variables:', 'color: #ef4444; font-weight: bold;');
    missing.forEach((key) => console.log(`   • ${key}`));
  }

  if (present.length > 0 && missing.length < 6) {
    console.log('%c✅ Present environment variables:', 'color: #22c55e; font-weight: bold;');
    present.forEach((key) => console.log(`   • ${key}`));
  }

  if (missing.length > 0) {
    console.log('');
    console.log('%c📋 To fix this:', 'color: #3b82f6; font-weight: bold;');
    console.log('   1. Copy .env.local.example to .env.local');
    console.log('   2. Fill in your Firebase credentials');
    console.log('   3. Restart the dev server (Ctrl+C, then npm run dev)');
  }

  console.groupEnd();
}

/**
 * Validates Firebase config and returns it if valid.
 */
function getValidatedFirebaseConfig(): Record<string, string> {
  const config = getFirebaseConfig();
  const status = getEnvVarStatus();
  const missing = Object.entries(status).filter(([, v]) => !v).map(([k]) => k);

  if (process.env.NODE_ENV === 'development') {
    logEnvVarStatus();
  }

  if (missing.length > 0) {
    const errorMessage =
      `Firebase configuration error: Missing ${missing.length} required environment variable(s).\n\n` +
      `Missing:\n${missing.map((k) => `  • ${k}`).join('\n')}\n\n` +
      `To fix:\n` +
      `  1. Create .env.local from .env.local.example\n` +
      `  2. Add your Firebase credentials\n` +
      `  3. Restart the dev server`;

    throw new Error(errorMessage);
  }

  return config as Record<string, string>;
}

/**
 * Initializes Firebase app and services.
 */
function initializeFirebase(): FirebaseApp {
  if (app) {
    return app;
  }

  if (typeof window === 'undefined') {
    throw new Error('Firebase client SDK cannot be initialized on the server.');
  }

  if (initializationError) {
    throw initializationError;
  }

  try {
    const config = getValidatedFirebaseConfig();

    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      app = initializeApp(config);
    }

    return app;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    throw initializationError;
  }
}

/**
 * Gets the Firebase Auth instance.
 */
export function getFirebaseAuth(): Auth {
  if (auth) {
    return auth;
  }

  const firebaseApp = initializeFirebase();
  auth = getAuth(firebaseApp);
  return auth;
}

/**
 * Gets the Firestore instance.
 */
export function getFirebaseDb(): Firestore {
  if (db) {
    return db;
  }

  const firebaseApp = initializeFirebase();
  db = getFirestore(firebaseApp);
  return db;
}

/**
 * Gets the Firebase Storage instance.
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (storage) {
    return storage;
  }

  const firebaseApp = initializeFirebase();
  storage = getStorage(firebaseApp);
  return storage;
}

/**
 * Gets the Google Auth Provider instance.
 */
export function getGoogleProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

/**
 * Safely attempts to get Firebase Auth, returning null if unavailable.
 */
export function getFirebaseAuthSafe(): Auth | null {
  try {
    return getFirebaseAuth();
  } catch {
    return null;
  }
}

/**
 * Safely attempts to get Firestore, returning null if unavailable.
 */
export function getFirebaseDbSafe(): Firestore | null {
  try {
    return getFirebaseDb();
  } catch {
    return null;
  }
}

/**
 * Safely attempts to get Firebase Storage, returning null if unavailable.
 */
export function getFirebaseStorageSafe(): FirebaseStorage | null {
  try {
    return getFirebaseStorage();
  } catch {
    return null;
  }
}

/**
 * Checks if Firebase is available and properly configured.
 */
export function isFirebaseAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (app) {
    return true;
  }

  if (initializationError) {
    return false;
  }

  const status = getEnvVarStatus();
  return Object.values(status).every(Boolean);
}

/**
 * Returns the cached initialization error, if any.
 */
export function getFirebaseInitError(): Error | null {
  return initializationError;
}

/**
 * @deprecated Use getFirebaseAuth(), getFirebaseDb(), getFirebaseStorage() instead.
 */
export { app, auth, db, storage, googleProvider };
