'use client';

import { useState, useCallback, useMemo } from 'react';
import { AuthGuard, Navbar } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts, useAssetUpload, useDebouncedCallback, useWorkspace } from '@/hooks';
import {
  createPost,
  updatePostStarterText,
  updatePostImage,
  updatePost,
  deletePost,
  deletePostsBatch,
  changePostDate,
} from '@/lib/services';
import { generateCaptions } from '@/lib/aiGeneration';
import { Timestamp } from 'firebase/firestore';
import { ImageUpload } from '@/components/ImageUpload';
import {
  PageHeader,
  Card,
  Button,
  Modal,
  ModalFooter,
  DatePicker,
  Toggle,
  Badge,
  StatusBadge,
  EmptyState,
  PhotoIcon,
  Spinner,
  toast,
} from '@/components/ui';
import type { Post } from '@/types';

type FilterType = 'all' | 'has-content' | 'missing-content';

export default function InputPage() {
  const { user } = useAuth();
  const { posts, loading: postsLoading } = usePosts();
  const { workspace } = useWorkspace();
  const { uploadImage } = useAssetUpload();

  // Filter state
  const [filter, setFilter] = useState<FilterType>('all');
  const [hidePast, setHidePast] = useState(true);

  // Selection state
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Add post modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPostDate, setNewPostDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk regeneration state
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ current: 0, total: 0 });

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Filter posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Hide past posts
    if (hidePast) {
      result = result.filter((post) => post.date >= today);
    }

    // Apply content filter
    switch (filter) {
      case 'has-content':
        result = result.filter(
          (post) => post.starterText || post.imageUrl || post.imageAssetId
        );
        break;
      case 'missing-content':
        result = result.filter(
          (post) => !post.starterText && !post.imageUrl && !post.imageAssetId
        );
        break;
    }

    // Sort by date
    result.sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }, [posts, filter, hidePast, today]);

  // Selection handlers
  const toggleSelectAll = useCallback(() => {
    if (selectedDates.size === filteredPosts.length) {
      setSelectedDates(new Set());
    } else {
      setSelectedDates(new Set(filteredPosts.map((p) => p.date)));
    }
  }, [filteredPosts, selectedDates.size]);

  const toggleSelect = useCallback((date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  // Add post handler
  const handleAddPost = useCallback(async () => {
    if (!user || !newPostDate) return;

    // Check if post already exists
    if (posts.some((p) => p.date === newPostDate)) {
      toast.error('A post already exists for this date');
      return;
    }

    setIsCreating(true);

    try {
      await createPost(user.uid, { date: newPostDate });
      toast.success('Post created');
      setShowAddModal(false);
      setNewPostDate('');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsCreating(false);
    }
  }, [user, newPostDate, posts]);

  // Delete posts handler
  const handleDeletePosts = useCallback(async () => {
    if (!user || selectedDates.size === 0) return;

    setIsDeleting(true);

    try {
      await deletePostsBatch(user.uid, Array.from(selectedDates));
      toast.success(`Deleted ${selectedDates.size} post(s)`);
      setSelectedDates(new Set());
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting posts:', error);
      toast.error('Failed to delete posts');
    } finally {
      setIsDeleting(false);
    }
  }, [user, selectedDates]);

  // Bulk regenerate handler
  const handleRegenerateSelected = useCallback(async () => {
    if (!user || !workspace || selectedDates.size === 0) return;

    const selectedPosts = posts.filter(
      (p) => selectedDates.has(p.date) && p.starterText.trim()
    );

    if (selectedPosts.length === 0) {
      toast.error('No posts with starter text to regenerate');
      return;
    }

    setIsRegenerating(true);
    setRegenProgress({ current: 0, total: selectedPosts.length });

    try {
      for (let i = 0; i < selectedPosts.length; i++) {
        const post = selectedPosts[i];
        setRegenProgress({ current: i + 1, total: selectedPosts.length });

        const result = await generateCaptions(post.starterText, workspace.settings.ai);

        await updatePost(user.uid, post.date, {
          facebook: {
            caption: result.facebook.caption,
            hashtags: result.facebook.hashtags,
            scheduledTime: post.facebook?.scheduledTime || '12:00',
            timeSource: 'ai' as const,
          },
          instagram: {
            caption: result.instagram.caption,
            hashtags: result.instagram.hashtags,
            scheduledTime: post.instagram?.scheduledTime || '19:00',
            timeSource: 'ai' as const,
          },
          status: 'generated',
          aiMeta: {
            model: result.model,
            generatedAt: Timestamp.now(),
            confidence: result.confidence,
          },
        });
      }

      toast.success(`Regenerated ${selectedPosts.length} post(s)`);
      setSelectedDates(new Set());
    } catch (error) {
      console.error('Error regenerating:', error);
      toast.error('Failed to regenerate some posts');
    } finally {
      setIsRegenerating(false);
      setRegenProgress({ current: 0, total: 0 });
    }
  }, [user, workspace, selectedDates, posts]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Input"
            subtitle="Add content to your scheduled posts"
            actions={
              <div className="flex gap-3">
                {selectedDates.size > 0 && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleRegenerateSelected}
                      isLoading={isRegenerating}
                    >
                      {isRegenerating
                        ? `Regenerating ${regenProgress.current}/${regenProgress.total}`
                        : `Regenerate (${selectedDates.size})`}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      Delete ({selectedDates.size})
                    </Button>
                  </>
                )}
                <Button onClick={() => setShowAddModal(true)}>Add Post</Button>
              </div>
            }
          />

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              {(['all', 'has-content', 'missing-content'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {f === 'all'
                    ? 'All'
                    : f === 'has-content'
                    ? 'Has Content'
                    : 'Missing Content'}
                </button>
              ))}
            </div>

            <div className="ml-auto">
              <Toggle
                label="Hide past posts"
                enabled={hidePast}
                onChange={setHidePast}
              />
            </div>
          </div>

          {/* Posts Table */}
          {postsLoading ? (
            <Card padding="lg">
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <EmptyState
              icon={<PhotoIcon className="h-6 w-6" />}
              title="No posts found"
              description={
                posts.length === 0
                  ? 'Create a schedule first, then add content here'
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
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={
                            selectedDates.size === filteredPosts.length &&
                            filteredPosts.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Day</th>
                      <th className="px-4 py-3">Image</th>
                      <th className="px-4 py-3">Starter Text</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts.map((post) => (
                      <PostRow
                        key={post.date}
                        post={post}
                        isSelected={selectedDates.has(post.date)}
                        onToggleSelect={() => toggleSelect(post.date)}
                        onUploadImage={uploadImage}
                        today={today}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Stats */}
          {filteredPosts.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredPosts.length} of {posts.length} posts
            </div>
          )}
        </main>

        {/* Add Post Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Post"
          size="sm"
        >
          <div className="space-y-4">
            <DatePicker
              label="Post Date"
              value={newPostDate}
              onChange={(e) => setNewPostDate(e.target.value)}
              min={today}
            />
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPost}
              disabled={!newPostDate}
              isLoading={isCreating}
            >
              Create Post
            </Button>
          </ModalFooter>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Posts"
          size="sm"
        >
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete {selectedDates.size} post(s)? This
            action cannot be undone.
          </p>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeletePosts}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </AuthGuard>
  );
}

interface PostRowProps {
  post: Post;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUploadImage: (file: File, postDate: string) => Promise<any>;
  today: string;
}

function PostRow({
  post,
  isSelected,
  onToggleSelect,
  onUploadImage,
  today,
}: PostRowProps) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [starterText, setStarterText] = useState(post.starterText);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [newDate, setNewDate] = useState(post.date);
  const [isChangingDate, setIsChangingDate] = useState(false);

  // Auto-generate captions after saving starter text
  const triggerGeneration = useCallback(async (text: string) => {
    if (!user || !workspace || !text.trim()) return;

    setIsGenerating(true);
    try {
      const result = await generateCaptions(text, workspace.settings.ai);

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
          model: result.model,
          generatedAt: Timestamp.now(),
          confidence: result.confidence,
        },
      });
    } catch (error) {
      console.error('Error generating captions:', error);
      // Don't show error toast - generation is automatic, user can manually regenerate in Review
    } finally {
      setIsGenerating(false);
    }
  }, [user, workspace, post.date, post.facebook, post.instagram]);

  // Debounced save for starter text
  const [debouncedSave] = useDebouncedCallback(
    async (text: string) => {
      if (!user) return;

      setIsSaving(true);
      try {
        await updatePostStarterText(user.uid, post.date, text);
        // Trigger auto-generation after saving
        triggerGeneration(text);
      } catch (error) {
        console.error('Error saving:', error);
        toast.error('Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    1000
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setStarterText(newText);
    debouncedSave(newText);
  };

  const handleImageUpload = async (file: File) => {
    await onUploadImage(file, post.date);
  };

  const handleImageUrlSubmit = async (url: string) => {
    if (!user) return;
    await updatePostImage(user.uid, post.date, undefined, url);
  };

  const handleImageRemove = async () => {
    if (!user) return;
    await updatePostImage(user.uid, post.date, undefined, undefined);
  };

  const handleDateChange = async () => {
    if (!user || newDate === post.date) {
      setIsEditingDate(false);
      return;
    }

    setIsChangingDate(true);
    try {
      const result = await changePostDate(user.uid, post.date, newDate);
      if (result.success) {
        toast.success('Date updated');
        setIsEditingDate(false);
      } else {
        toast.error(result.error || 'Failed to change date');
        setNewDate(post.date); // Reset to original
      }
    } catch (error) {
      console.error('Error changing date:', error);
      toast.error('Failed to change date');
      setNewDate(post.date);
    } finally {
      setIsChangingDate(false);
    }
  };

  const handleDateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDateChange();
    } else if (e.key === 'Escape') {
      setNewDate(post.date);
      setIsEditingDate(false);
    }
  };

  const imageUrl = post.imageUrl || undefined;
  const date = new Date(post.date + 'T00:00:00');

  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      </td>
      <td className="px-4 py-3">
        {isEditingDate ? (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              onKeyDown={handleDateKeyDown}
              onBlur={handleDateChange}
              min={today}
              disabled={isChangingDate}
              autoFocus
              className="rounded border border-primary-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            {isChangingDate && <Spinner size="sm" />}
          </div>
        ) : (
          <button
            onClick={() => setIsEditingDate(true)}
            className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
            title="Click to change date"
          >
            {date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
        {date.toLocaleDateString('en-US', { weekday: 'short' })}
      </td>
      <td className="px-4 py-3">
        <ImageUpload
          imageUrl={imageUrl}
          onUpload={handleImageUpload}
          onUrlSubmit={handleImageUrlSubmit}
          onRemove={handleImageRemove}
          compact
        />
      </td>
      <td className="px-4 py-3">
        <div className="relative">
          <textarea
            value={starterText}
            onChange={handleTextChange}
            placeholder="Enter post description..."
            rows={2}
            className="w-full min-w-[200px] max-w-md resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
          />
          {(isSaving || isGenerating) && (
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <Spinner size="sm" />
              {isGenerating && (
                <span className="text-xs text-gray-400">AI</span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={post.status} />
      </td>
    </tr>
  );
}
