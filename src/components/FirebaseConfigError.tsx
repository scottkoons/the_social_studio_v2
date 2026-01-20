'use client';

import { useAuth } from '@/contexts/AuthContext';

/**
 * Displays a friendly error message when Firebase is not configured.
 * Use this in pages that require authentication.
 */
export function FirebaseConfigError() {
  const { error, loading } = useAuth();

  if (loading || !error) {
    return null;
  }

  const isConfigError =
    error.message.includes('not configured') ||
    error.message.includes('environment variable') ||
    error.message.includes('Firebase configuration');

  if (!isConfigError) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Firebase Not Configured
          </h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          The app cannot connect to Firebase. This is usually caused by missing
          environment variables.
        </p>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            To fix this:
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
            <li>
              Copy <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">.env.local.example</code> to{' '}
              <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">.env.local</code>
            </li>
            <li>Add your Firebase credentials</li>
            <li>Restart the dev server</li>
          </ol>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-500">
          Check the browser console for detailed error information.
        </p>
      </div>
    </div>
  );
}

/**
 * Wrapper component that shows FirebaseConfigError if Firebase is not configured,
 * otherwise renders children.
 */
export function RequireFirebase({ children }: { children: React.ReactNode }) {
  const { error, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
      </div>
    );
  }

  const isConfigError =
    error &&
    (error.message.includes('not configured') ||
      error.message.includes('environment variable') ||
      error.message.includes('Firebase configuration'));

  if (isConfigError) {
    return <FirebaseConfigError />;
  }

  return <>{children}</>;
}
