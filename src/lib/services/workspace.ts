import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { WorkspaceSettings } from '@/types';

// Default workspace settings
const defaultSettings: WorkspaceSettings = {
  name: 'My Workspace',
  settings: {
    ai: {
      brandVoice: '',
      hashtagStyle: 'moderate',
      emojiStyle: 'medium',
    },
    scheduling: {
      timezone: 'America/Denver',
    },
  },
};

// Get reference to workspace document
function getWorkspaceDoc(workspaceId: string) {
  const db = getFirebaseDb();
  return doc(db, 'workspaces', workspaceId);
}

// Get workspace settings (creates default if doesn't exist)
export async function getWorkspaceSettings(
  workspaceId: string
): Promise<WorkspaceSettings> {
  const workspaceRef = getWorkspaceDoc(workspaceId);
  const snapshot = await getDoc(workspaceRef);

  if (!snapshot.exists()) {
    // Create default settings for new workspace
    await setDoc(workspaceRef, defaultSettings);
    return defaultSettings;
  }

  return snapshot.data() as WorkspaceSettings;
}

// Update workspace settings
export async function updateWorkspaceSettings(
  workspaceId: string,
  settings: Partial<WorkspaceSettings>
): Promise<void> {
  const workspaceRef = getWorkspaceDoc(workspaceId);
  await updateDoc(workspaceRef, settings);
}

// Update AI settings
export async function updateAISettings(
  workspaceId: string,
  aiSettings: Partial<WorkspaceSettings['settings']['ai']>
): Promise<void> {
  const workspaceRef = getWorkspaceDoc(workspaceId);
  const current = await getWorkspaceSettings(workspaceId);

  await updateDoc(workspaceRef, {
    'settings.ai': {
      ...current.settings.ai,
      ...aiSettings,
    },
  });
}

// Update scheduling settings
export async function updateSchedulingSettings(
  workspaceId: string,
  schedulingSettings: Partial<WorkspaceSettings['settings']['scheduling']>
): Promise<void> {
  const workspaceRef = getWorkspaceDoc(workspaceId);
  const current = await getWorkspaceSettings(workspaceId);

  await updateDoc(workspaceRef, {
    'settings.scheduling': {
      ...current.settings.scheduling,
      ...schedulingSettings,
    },
  });
}

// Update workspace name
export async function updateWorkspaceName(
  workspaceId: string,
  name: string
): Promise<void> {
  const workspaceRef = getWorkspaceDoc(workspaceId);
  await updateDoc(workspaceRef, { name });
}

// Ensure workspace exists (call on login)
export async function ensureWorkspaceExists(workspaceId: string): Promise<void> {
  const workspaceRef = getWorkspaceDoc(workspaceId);
  const snapshot = await getDoc(workspaceRef);

  if (!snapshot.exists()) {
    await setDoc(workspaceRef, defaultSettings);
  }
}
