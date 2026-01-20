'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  Unsubscribe,
  AuthError,
} from 'firebase/auth';
import {
  getFirebaseAuthSafe,
  getGoogleProvider,
  isFirebaseAvailable,
  getFirebaseInitError,
} from '@/lib/firebase';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapFirebaseUser(firebaseUser: FirebaseUser | null): User | null {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
}

/**
 * Check if an error is a user-cancelled popup (not a real error).
 */
function isPopupClosedError(error: unknown): boolean {
  if (error instanceof Error) {
    const authError = error as AuthError;
    // Firebase error codes for popup closed/cancelled by user
    return (
      authError.code === 'auth/popup-closed-by-user' ||
      authError.code === 'auth/cancelled-popup-request' ||
      authError.code === 'auth/user-cancelled'
    );
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if we've already attempted initialization (prevents retry loops)
  const initAttempted = useRef(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Prevent multiple initialization attempts
    if (initAttempted.current) {
      return;
    }
    initAttempted.current = true;

    // Check if Firebase is available before attempting to use it
    if (!isFirebaseAvailable()) {
      const initError = getFirebaseInitError();
      setError(
        initError ||
          new Error(
            'Firebase is not configured. Please check your environment variables.'
          )
      );
      setLoading(false);
      return;
    }

    // Try to get Firebase Auth (this may fail if config is invalid)
    const auth = getFirebaseAuthSafe();

    if (!auth) {
      const initError = getFirebaseInitError();
      setError(
        initError ||
          new Error('Failed to initialize Firebase Authentication.')
      );
      setLoading(false);
      return;
    }

    // Set up auth state listener
    let unsubscribe: Unsubscribe | undefined;

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          setUser(mapFirebaseUser(firebaseUser));
          setLoading(false);
          setError(null);
        },
        (authError) => {
          console.error('Auth state change error:', authError);
          setError(authError);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to set up auth listener:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    if (typeof window === 'undefined') return;

    // Check for existing error state
    if (error) {
      throw error;
    }

    const auth = getFirebaseAuthSafe();
    if (!auth) {
      throw new Error('Firebase Authentication is not available.');
    }

    try {
      const provider = getGoogleProvider();
      // Let Firebase handle the popup lifecycle entirely
      await signInWithPopup(auth, provider);
    } catch (err) {
      // Don't log or throw for user-cancelled popups (not a real error)
      if (isPopupClosedError(err)) {
        return;
      }
      // Log actual errors but don't spam console
      if (process.env.NODE_ENV === 'development') {
        console.error('Error signing in with Google:', err);
      }
      throw err;
    }
  };

  const signOut = async () => {
    if (typeof window === 'undefined') return;

    const auth = getFirebaseAuthSafe();
    if (!auth) {
      // If auth isn't available, just clear local state
      setUser(null);
      return;
    }

    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
