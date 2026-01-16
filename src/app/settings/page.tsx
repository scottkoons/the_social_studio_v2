'use client';

import { useState, useEffect } from 'react';
import { AuthGuard, Navbar } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/hooks';
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Textarea,
  RadioGroup,
  Spinner,
  toast,
} from '@/components/ui';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { workspace, loading, updateAI } = useWorkspace();

  const [brandVoice, setBrandVoice] = useState('');
  const [hashtagStyle, setHashtagStyle] = useState<'minimal' | 'moderate' | 'heavy'>('moderate');
  const [emojiStyle, setEmojiStyle] = useState<'low' | 'medium' | 'high'>('medium');
  const [saving, setSaving] = useState(false);

  // Load workspace settings when available
  useEffect(() => {
    if (workspace?.settings?.ai) {
      setBrandVoice(workspace.settings.ai.brandVoice || '');
      setHashtagStyle(workspace.settings.ai.hashtagStyle || 'moderate');
      setEmojiStyle(workspace.settings.ai.emojiStyle || 'medium');
    }
  }, [workspace]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAI({
        brandVoice,
        hashtagStyle,
        emojiStyle,
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Settings"
            subtitle="Configure your workspace and AI preferences"
          />

          <div className="space-y-6">
            {/* AI Settings */}
            <Card padding="none">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI Settings
                </h2>
              </CardHeader>
              <CardContent padding="lg" className="space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  <>
                    <Textarea
                      label="Brand Voice"
                      placeholder="Describe your brand's tone and personality. E.g., 'Friendly and casual, focused on craft beer and community. Use local Colorado references when appropriate.'"
                      value={brandVoice}
                      onChange={(e) => setBrandVoice(e.target.value)}
                      helperText="This will be included in all AI caption generation prompts"
                      rows={4}
                    />

                    <RadioGroup
                      label="Hashtag Density"
                      value={hashtagStyle}
                      onChange={setHashtagStyle}
                      options={[
                        { value: 'minimal', label: 'Minimal', description: '3-5 hashtags' },
                        { value: 'moderate', label: 'Moderate', description: '6-10 hashtags' },
                        { value: 'heavy', label: 'Heavy', description: '10-15 hashtags' },
                      ]}
                    />

                    <RadioGroup
                      label="Emoji Usage"
                      value={emojiStyle}
                      onChange={setEmojiStyle}
                      options={[
                        { value: 'low', label: 'Low', description: '0-1 emojis per post' },
                        { value: 'medium', label: 'Medium', description: '2-4 emojis per post' },
                        { value: 'high', label: 'High', description: '5+ emojis per post' },
                      ]}
                    />

                    <div className="pt-4">
                      <Button onClick={handleSave} isLoading={saving}>
                        Save AI Settings
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card padding="none">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Appearance
                </h2>
              </CardHeader>
              <CardContent padding="lg">
                <RadioGroup
                  label="Theme"
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: 'light', label: 'Light', description: 'Always use light mode' },
                    { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
                    { value: 'system', label: 'System', description: 'Match your device settings' },
                  ]}
                />
              </CardContent>
            </Card>

            {/* Account */}
            <Card padding="none">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Account
                </h2>
              </CardHeader>
              <CardContent padding="lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user?.displayName || 'User'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user?.email}
                    </p>
                  </div>
                  <Button variant="danger" onClick={signOut}>
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
