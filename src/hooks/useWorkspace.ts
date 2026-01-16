'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ensureWorkspaceExists,
  updateAISettings,
  updateSchedulingSettings,
  updateWorkspaceName,
} from '@/lib/services/workspace';
import type { WorkspaceSettings } from '@/types';

interface UseWorkspaceReturn {
  workspace: WorkspaceSettings | null;
  loading: boolean;
  error: Error | null;
  updateName: (name: string) => Promise<void>;
  updateAI: (settings: Partial<WorkspaceSettings['settings']['ai']>) => Promise<void>;
  updateScheduling: (settings: Partial<WorkspaceSettings['settings']['scheduling']>) => Promise<void>;
}

export function useWorkspace(): UseWorkspaceReturn {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Ensure workspace exists first
    ensureWorkspaceExists(user.uid).catch(console.error);

    const db = getFirebaseDb();
    const workspaceRef = doc(db, 'workspaces', user.uid);

    const unsubscribe: Unsubscribe = onSnapshot(
      workspaceRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setWorkspace(snapshot.data() as WorkspaceSettings);
        } else {
          setWorkspace(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching workspace:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const updateName = useCallback(
    async (name: string) => {
      if (!user) return;
      await updateWorkspaceName(user.uid, name);
    },
    [user]
  );

  const updateAI = useCallback(
    async (settings: Partial<WorkspaceSettings['settings']['ai']>) => {
      if (!user) return;
      await updateAISettings(user.uid, settings);
    },
    [user]
  );

  const updateScheduling = useCallback(
    async (settings: Partial<WorkspaceSettings['settings']['scheduling']>) => {
      if (!user) return;
      await updateSchedulingSettings(user.uid, settings);
    },
    [user]
  );

  return {
    workspace,
    loading,
    error,
    updateName,
    updateAI,
    updateScheduling,
  };
}
