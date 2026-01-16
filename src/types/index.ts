import { Timestamp } from 'firebase/firestore';

export interface Post {
  date: string;
  starterText: string;
  imageAssetId?: string;
  imageUrl?: string;

  facebook?: {
    caption: string;
    hashtags: string[];
    scheduledTime: string;
    timeSource: 'ai' | 'manual';
  };
  instagram?: {
    caption: string;
    hashtags: string[];
    scheduledTime: string;
    timeSource: 'ai' | 'manual';
  };

  status: 'draft' | 'generated' | 'edited' | 'exported';
  aiMeta?: {
    model: string;
    generatedAt: Timestamp;
    confidence: number;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Asset {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
  createdAt: Timestamp;
}

export interface WorkspaceSettings {
  name: string;
  settings: {
    ai: {
      brandVoice: string;
      hashtagStyle: 'minimal' | 'moderate' | 'heavy';
      emojiStyle: 'low' | 'medium' | 'high';
    };
    scheduling: {
      timezone: string;
    };
  };
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
