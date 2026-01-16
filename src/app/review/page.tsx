'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { AuthGuard, Navbar } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts, useWorkspace, useDebouncedCallback } from '@/hooks';
import {
  updatePostFacebook,
  updatePostInstagram,
  updatePost,
} from '@/lib/services';
import {
  generateCaptions,
  buildFullCaption,
  type GenerationResult,
} from '@/lib/aiGeneration';
import {
  PageHeader,
  Card,
  Button,
  Toggle,
  Badge,
  StatusBadge,
  EmptyState,
  DocumentIcon,
  PhotoIcon,
  Spinner,
  toast,
  TimePicker,
  formatTime12Hour,
  HashtagInput,
} from '@/components/ui';
import type { Post } from '@/types';
import { Timestamp } from 'firebase/firestore';

type PlatformFilter = 'all' | 'facebook' | 'instagram';

// Character limits
const FB_CHAR_LIMIT = 2200;
const IG_CHAR_LIMIT = 2200;

export default function ReviewPage() {
  const { user } = useAuth();
  const { posts, loading: postsLoading } = usePosts();
  const { workspace } = useWorkspace();

  // Filter state
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [hidePast, setHidePast] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true);

  // Bulk generation state
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Filter posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Hide past posts
    if (hidePast) {
      result = result.filter((post) => post.date >= today);
    }

    // Hide posts without content (no starter text and no image)
    if (hideEmpty) {
      result = result.filter(
        (post) => post.starterText || post.imageUrl || post.imageAssetId
      );
    }

    // Sort by date
    result.sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }, [posts, hidePast, hideEmpty, today]);

  // Posts that need generation
  const postsNeedingGeneration = useMemo(() => {
    return filteredPosts.filter(
      (post) =>
        (post.starterText || post.imageUrl) &&
        (!post.facebook || !post.instagram)
    );
  }, [filteredPosts]);

  // Handle generate all
  const handleGenerateAll = useCallback(async () => {
    if (!user || !workspace || postsNeedingGeneration.length === 0) return;

    setIsGeneratingAll(true);
    setGenerationProgress({ current: 0, total: postsNeedingGeneration.length });

    try {
      for (let i = 0; i < postsNeedingGeneration.length; i++) {
        const post = postsNeedingGeneration[i];
        setGenerationProgress({ current: i + 1, total: postsNeedingGeneration.length });

        const result = await generateCaptions(
          post.starterText,
          workspace.settings.ai
        );

        // Update the post with generated content
        await updatePost(user.uid, post.date, {
          facebook: {
            caption: result.facebook.caption,
            hashtags: result.facebook.hashtags,
            scheduledTime: post.facebook?.scheduledTime || '12:00',
            timeSource: post.facebook?.timeSource || 'ai',
          },
          instagram: {
            caption: result.instagram.caption,
            hashtags: result.instagram.hashtags,
            scheduledTime: post.instagram?.scheduledTime || '19:00',
            timeSource: post.instagram?.timeSource || 'ai',
          },
          status: 'generated',
          aiMeta: {
            model: 'mock-gpt-4',
            generatedAt: Timestamp.now(),
            confidence: result.confidence,
          },
        });
      }

      toast.success(`Generated captions for ${postsNeedingGeneration.length} posts`);
    } catch (error) {
      console.error('Error generating captions:', error);
      toast.error('Failed to generate some captions');
    } finally {
      setIsGeneratingAll(false);
      setGenerationProgress({ current: 0, total: 0 });
    }
  }, [user, workspace, postsNeedingGeneration]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Review"
            subtitle="Generate and edit AI captions for your posts"
            actions={
              <div className="flex gap-3">
                {postsNeedingGeneration.length > 0 && (
                  <Button
                    onClick={handleGenerateAll}
                    isLoading={isGeneratingAll}
                  >
                    {isGeneratingAll
                      ? `Generating ${generationProgress.current}/${generationProgress.total}`
                      : `Generate All (${postsNeedingGeneration.length})`}
                  </Button>
                )}
              </div>
            }
          />

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              {(['all', 'facebook', 'instagram'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPlatformFilter(f)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    platformFilter === f
                      ? f === 'facebook'
                        ? 'bg-facebook/10 text-facebook'
                        : f === 'instagram'
                        ? 'bg-instagram/10 text-instagram'
                        : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {f === 'facebook' && <FacebookIcon className="h-4 w-4" />}
                  {f === 'instagram' && <InstagramIcon className="h-4 w-4" />}
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-4">
              <Toggle
                label="Hide empty"
                enabled={hideEmpty}
                onChange={setHideEmpty}
              />
              <Toggle
                label="Hide past"
                enabled={hidePast}
                onChange={setHidePast}
              />
            </div>
          </div>

          {/* Posts List */}
          {postsLoading ? (
            <Card padding="lg">
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <EmptyState
              icon={<DocumentIcon className="h-6 w-6" />}
              title="No posts to review"
              description={
                posts.length === 0
                  ? 'Create a schedule and add content first'
                  : 'Try adjusting your filters'
              }
              action={
                posts.length === 0 ? (
                  <Button onClick={() => (window.location.href = '/planning')}>
                    Create Schedule
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.date}
                  post={post}
                  platformFilter={platformFilter}
                />
              ))}
            </div>
          )}

          {/* Stats */}
          {filteredPosts.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredPosts.length} of {posts.length} posts
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

interface PostCardProps {
  post: Post;
  platformFilter: PlatformFilter;
}

function PostCard({ post, platformFilter }: PostCardProps) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [isGenerating, setIsGenerating] = useState(false);

  const date = new Date(post.date + 'T00:00:00');
  const imageUrl = post.imageUrl || undefined;

  const handleGenerate = async () => {
    if (!user || !workspace) return;

    setIsGenerating(true);
    try {
      const result = await generateCaptions(
        post.starterText,
        workspace.settings.ai,
        {
          fbCaption: post.facebook?.caption,
          igCaption: post.instagram?.caption,
        }
      );

      await updatePost(user.uid, post.date, {
        facebook: {
          caption: result.facebook.caption,
          hashtags: result.facebook.hashtags,
          scheduledTime: post.facebook?.scheduledTime || '12:00',
          timeSource: post.facebook?.timeSource || 'ai',
        },
        instagram: {
          caption: result.instagram.caption,
          hashtags: result.instagram.hashtags,
          scheduledTime: post.instagram?.scheduledTime || '19:00',
          timeSource: post.instagram?.timeSource || 'ai',
        },
        status: 'generated',
        aiMeta: {
          model: 'mock-gpt-4',
          generatedAt: Timestamp.now(),
          confidence: result.confidence,
        },
      });

      toast.success('Captions generated');
    } catch (error) {
      console.error('Error generating:', error);
      toast.error('Failed to generate captions');
    } finally {
      setIsGenerating(false);
    }
  };

  const showFacebook = platformFilter === 'all' || platformFilter === 'facebook';
  const showInstagram = platformFilter === 'all' || platformFilter === 'instagram';

  return (
    <Card padding="none">
      <div className="flex flex-col lg:flex-row">
        {/* Left column - Image and date */}
        <div className="flex-shrink-0 border-b border-gray-200 p-4 lg:w-64 lg:border-b-0 lg:border-r dark:border-gray-700">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <StatusBadge status={post.status} />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleGenerate}
              isLoading={isGenerating}
            >
              {post.facebook || post.instagram ? 'Regenerate' : 'Generate'}
            </Button>
          </div>

          {imageUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
              <Image
                src={imageUrl}
                alt="Post image"
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <PhotoIcon className="h-12 w-12 text-gray-400" />
            </div>
          )}

          {post.starterText && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Starter Text
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {post.starterText}
              </p>
            </div>
          )}
        </div>

        {/* Right column - Platform captions */}
        <div className="flex flex-1 flex-col md:flex-row">
          {showFacebook && (
            <PlatformEditor
              platform="facebook"
              post={post}
              charLimit={FB_CHAR_LIMIT}
              className={showInstagram ? 'border-b md:border-b-0 md:border-r' : ''}
            />
          )}
          {showInstagram && (
            <PlatformEditor
              platform="instagram"
              post={post}
              charLimit={IG_CHAR_LIMIT}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

interface PlatformEditorProps {
  platform: 'facebook' | 'instagram';
  post: Post;
  charLimit: number;
  className?: string;
}

function PlatformEditor({ platform, post, charLimit, className = '' }: PlatformEditorProps) {
  const { user } = useAuth();
  const platformData = post[platform];

  const [caption, setCaption] = useState(platformData?.caption || '');
  const [hashtags, setHashtags] = useState<string[]>(platformData?.hashtags || []);
  const [scheduledTime, setScheduledTime] = useState(platformData?.scheduledTime || '');
  const [isSaving, setIsSaving] = useState(false);

  // Debounced save for caption
  const [debouncedSaveCaption] = useDebouncedCallback(
    async (newCaption: string) => {
      if (!user || !platformData) return;

      setIsSaving(true);
      try {
        const updateFn = platform === 'facebook' ? updatePostFacebook : updatePostInstagram;
        await updateFn(user.uid, post.date, {
          ...platformData,
          caption: newCaption,
        });
        // Mark as edited if it was previously generated
        if (post.status === 'generated') {
          await updatePost(user.uid, post.date, { status: 'edited' });
        }
      } catch (error) {
        console.error('Error saving caption:', error);
        toast.error('Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    1000
  );

  // Save hashtags
  const handleHashtagsChange = async (newHashtags: string[]) => {
    setHashtags(newHashtags);
    if (!user || !platformData) return;

    try {
      const updateFn = platform === 'facebook' ? updatePostFacebook : updatePostInstagram;
      await updateFn(user.uid, post.date, {
        ...platformData,
        hashtags: newHashtags,
      });
      if (post.status === 'generated') {
        await updatePost(user.uid, post.date, { status: 'edited' });
      }
    } catch (error) {
      console.error('Error saving hashtags:', error);
      toast.error('Failed to save hashtags');
    }
  };

  // Save time
  const handleTimeChange = async (newTime: string) => {
    setScheduledTime(newTime);
    if (!user || !platformData) return;

    try {
      const updateFn = platform === 'facebook' ? updatePostFacebook : updatePostInstagram;
      await updateFn(user.uid, post.date, {
        ...platformData,
        scheduledTime: newTime,
        timeSource: 'manual',
      });
      if (post.status === 'generated') {
        await updatePost(user.uid, post.date, { status: 'edited' });
      }
    } catch (error) {
      console.error('Error saving time:', error);
      toast.error('Failed to save time');
    }
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCaption = e.target.value;
    setCaption(newCaption);
    debouncedSaveCaption(newCaption);
  };

  const fullText = buildFullCaption(caption, hashtags);
  const charCount = fullText.length;
  const isOverLimit = charCount > charLimit;

  const PlatformIcon = platform === 'facebook' ? FacebookIcon : InstagramIcon;
  const platformColor = platform === 'facebook' ? 'text-facebook' : 'text-instagram';
  const platformBgColor = platform === 'facebook' ? 'bg-facebook/10' : 'bg-instagram/10';

  if (!platformData) {
    return (
      <div
        className={`flex flex-1 flex-col items-center justify-center p-6 text-center ${className} border-gray-200 dark:border-gray-700`}
      >
        <PlatformIcon className={`mb-2 h-8 w-8 ${platformColor} opacity-30`} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Generate captions to edit {platform}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 flex-col p-4 ${className} border-gray-200 dark:border-gray-700`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${platformBgColor}`}>
            <PlatformIcon className={`h-4 w-4 ${platformColor}`} />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isSaving && <Spinner size="sm" />}
          <TimePicker
            value={scheduledTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

      {/* Caption */}
      <div className="relative flex-1">
        <textarea
          value={caption}
          onChange={handleCaptionChange}
          placeholder="Enter caption..."
          rows={4}
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
        <div
          className={`mt-1 text-right text-xs ${
            isOverLimit
              ? 'font-medium text-red-500'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {charCount.toLocaleString()} / {charLimit.toLocaleString()}
        </div>
      </div>

      {/* Hashtags */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          Hashtags ({hashtags.length})
        </p>
        <HashtagInput
          hashtags={hashtags}
          onChange={handleHashtagsChange}
          placeholder="Add hashtag..."
        />
      </div>

      {/* Preview */}
      {caption && (
        <div className="mt-3">
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              Preview full post
            </summary>
            <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
              <p className="whitespace-pre-wrap">{fullText}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// Platform Icons
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}
