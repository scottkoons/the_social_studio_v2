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

// Required environment variable keys
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

// Module-level singletons (lazy initialized)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let initializationError: Error | null = null;

/**
 * Validates that all required Firebase environment variables are present.
 * Returns the config object if valid, throws descriptive error if not.
 */
function getValidatedFirebaseConfig(): Record<string, string> {
  const config: Record<string, string | undefined> = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // In development, log which env vars are present (boolean only, not values)
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.log('[Firebase] Environment variable check:', {
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }

  // Check for missing environment variables
  const missingVars = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key] === 'undefined'
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Firebase configuration error: Missing required environment variables:\n` +
        `  ${missingVars.join('\n  ')}\n\n` +
        `Please ensure these are set in your .env.local file.\n` +
        `After adding/modifying .env.local, restart your dev server.`
    );
  }

  // TypeScript: at this point all values are guaranteed to be defined strings
  return config as Record<string, string>;
}

/**
 * Initializes Firebase app and services.
 * Called lazily on first access, NOT during module evaluation.
 */
function initializeFirebase(): FirebaseApp {
  // Return existing app if already initialized
  if (app) {
    return app;
  }

  // Check if we're on the server
  if (typeof window === 'undefined') {
    throw new Error(
      'Firebase client SDK cannot be initialized on the server. ' +
        'Ensure this code only runs in client components.'
    );
  }

  // Check if there was a previous initialization error
  if (initializationError) {
    throw initializationError;
  }

  try {
    // Validate config before initialization
    const config = getValidatedFirebaseConfig();

    // Use existing app if Firebase was initialized elsewhere, otherwise create new
    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      app = initializeApp(config);
    }

    return app;
  } catch (error) {
    // Store the error to prevent repeated initialization attempts
    initializationError = error instanceof Error ? error : new Error(String(error));
    throw initializationError;
  }
}

/**
 * Gets the Firebase Auth instance.
 * Initializes Firebase if not already done.
 * @throws Error if called on server or if Firebase config is invalid
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
 * Initializes Firebase if not already done.
 * @throws Error if called on server or if Firebase config is invalid
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
 * Initializes Firebase if not already done.
 * @throws Error if called on server or if Firebase config is invalid
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
 * Does not require Firebase app initialization.
 */
export function getGoogleProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

/**
 * Safely attempts to get Firebase Auth, returning null if unavailable.
 * Use this in components that need to handle the case where Firebase isn't ready.
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
 * Use this in components that need to handle the case where Firebase isn't ready.
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
 * Use this in components that need to handle the case where Firebase isn't ready.
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
 * Returns true if Firebase can be initialized, false otherwise.
 */
export function isFirebaseAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    getValidatedFirebaseConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use getFirebaseAuth(), getFirebaseDb(), getFirebaseStorage() instead.
 * These exports are kept for backwards compatibility but may be null.
 */
export { app, auth, db, storage, googleProvider };
