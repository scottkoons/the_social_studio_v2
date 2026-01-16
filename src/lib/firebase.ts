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

// Required environment variable keys with human-readable descriptions
const REQUIRED_ENV_VARS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'API Key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'Auth Domain',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'Project ID',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'Storage Bucket',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'Messaging Sender ID',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'App ID',
} as const;

type EnvVarKey = keyof typeof REQUIRED_ENV_VARS;

// Module-level singletons (lazy initialized)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let initializationError: Error | null = null;
let hasLoggedEnvStatus = false;

/**
 * Checks if an environment variable is properly set (not empty, undefined, or literal "undefined")
 */
function isEnvVarSet(key: string): boolean {
  const value = process.env[key];
  return Boolean(value && value !== 'undefined' && value.trim() !== '');
}

/**
 * Logs a grouped console message showing environment variable status.
 * Only logs once per session to avoid spam.
 */
function logEnvVarStatus(missingVars: EnvVarKey[], presentVars: EnvVarKey[]): void {
  if (hasLoggedEnvStatus) return;
  hasLoggedEnvStatus = true;

  // Only log in browser (not during SSR/build)
  if (typeof window === 'undefined') return;

  const allMissing = missingVars.length === Object.keys(REQUIRED_ENV_VARS).length;

  console.group(
    `%c🔥 Firebase Configuration ${missingVars.length > 0 ? 'ERROR' : 'OK'}`,
    `color: ${missingVars.length > 0 ? '#ef4444' : '#22c55e'}; font-weight: bold; font-size: 14px;`
  );

  if (missingVars.length > 0) {
    console.log(
      '%c❌ Missing environment variables:',
      'color: #ef4444; font-weight: bold;'
    );
    missingVars.forEach((key) => {
      console.log(`   • ${key} (${REQUIRED_ENV_VARS[key]})`);
    });
  }

  if (presentVars.length > 0 && !allMissing) {
    console.log(
      '%c✅ Present environment variables:',
      'color: #22c55e; font-weight: bold;'
    );
    presentVars.forEach((key) => {
      console.log(`   • ${key} (${REQUIRED_ENV_VARS[key]})`);
    });
  }

  if (missingVars.length > 0) {
    console.log('');
    console.log(
      '%c📋 To fix this:',
      'color: #3b82f6; font-weight: bold;'
    );
    console.log('   1. Copy .env.local.example to .env.local');
    console.log('   2. Fill in your Firebase credentials from Firebase Console');
    console.log('   3. Restart the dev server (Ctrl+C, then npm run dev)');
    console.log('');
    console.log(
      '%c📖 See README.md "Firebase Setup (Required)" for detailed instructions.',
      'color: #8b5cf6;'
    );
  }

  console.groupEnd();
}

/**
 * Validates that all required Firebase environment variables are present.
 * Returns the config object if valid, throws descriptive error if not.
 */
function getValidatedFirebaseConfig(): Record<string, string> {
  const envVarKeys = Object.keys(REQUIRED_ENV_VARS) as EnvVarKey[];

  const missingVars = envVarKeys.filter((key) => !isEnvVarSet(key));
  const presentVars = envVarKeys.filter((key) => isEnvVarSet(key));

  // Log status in development (only once)
  if (process.env.NODE_ENV === 'development') {
    logEnvVarStatus(missingVars, presentVars);
  }

  if (missingVars.length > 0) {
    const errorMessage =
      `Firebase configuration error: Missing ${missingVars.length} required environment variable(s).\n\n` +
      `Missing:\n${missingVars.map((k) => `  • ${k}`).join('\n')}\n\n` +
      `To fix:\n` +
      `  1. Create .env.local from .env.local.example\n` +
      `  2. Add your Firebase credentials\n` +
      `  3. Restart the dev server\n\n` +
      `See README.md for detailed setup instructions.`;

    throw new Error(errorMessage);
  }

  // Build and return the config object
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
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

  // Check if there was a previous initialization error (prevents retry loops)
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
 * Does NOT log errors or trigger the grouped console output.
 */
export function isFirebaseAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if already initialized successfully
  if (app) {
    return true;
  }

  // Check if there was a previous error
  if (initializationError) {
    return false;
  }

  // Check if all env vars are present
  const envVarKeys = Object.keys(REQUIRED_ENV_VARS) as EnvVarKey[];
  return envVarKeys.every((key) => isEnvVarSet(key));
}

/**
 * Returns the cached initialization error, if any.
 * Useful for displaying error states in UI without re-throwing.
 */
export function getFirebaseInitError(): Error | null {
  return initializationError;
}

/**
 * @deprecated Use getFirebaseAuth(), getFirebaseDb(), getFirebaseStorage() instead.
 * These exports are kept for backwards compatibility but may be null.
 */
export { app, auth, db, storage, googleProvider };
