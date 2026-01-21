'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { AuthGuard, Navbar } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts, useWorkspace, useDebouncedCallback } from '@/hooks';
import {
  updatePost,
  updatePostFacebook,
  updatePostInstagram,
  changePostDate,
  deletePost,
} from '@/lib/services';
import { generateCaptions } from '@/lib/aiGeneration';
import { Timestamp } from 'firebase/firestore';
import { formatTime12Hour } from '@/components/ui';
import {
  PageHeader,
  Card,
  Button,
  Modal,
  ModalFooter,
  StatusBadge,
  EmptyState,
  CalendarIcon,
  PhotoIcon,
  Spinner,
  toast,
  TimePicker,
  HashtagInput,
  Textarea,
} from '@/components/ui';
import { clsx } from 'clsx';
import type { Post } from '@/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const { user } = useAuth();
  const { posts, loading: postsLoading } = usePosts();

  // Current month state
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Selected day for modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Drag-and-drop state
  const [draggedDate, setDraggedDate] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Create calendar grid
    const days: Array<{ date: string; dayNumber: number; isCurrentMonth: boolean }> = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        dayNumber: day,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date: date.toISOString().split('T')[0],
        dayNumber: day,
        isCurrentMonth: true,
      });
    }

    // Next month days (fill to complete grid)
    const remainingDays = 42 - days.length; // 6 rows of 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        dayNumber: day,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Create a map of posts by date
  const postsByDate = useMemo(() => {
    const map = new Map<string, Post>();
    posts.forEach((post) => {
      map.set(post.date, post);
    });
    return map;
  }, [posts]);

  // Navigation handlers
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Get today's date string
  const today = new Date().toISOString().split('T')[0];

  // Drag-and-drop handlers
  const handleDragStart = useCallback((date: string) => {
    setDraggedDate(date);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedDate(null);
    setDropTargetDate(null);
  }, []);

  const handleDragOver = useCallback((date: string) => {
    setDropTargetDate(date);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetDate(null);
  }, []);

  const handleDrop = useCallback(async (targetDate: string) => {
    if (!user || !draggedDate || draggedDate === targetDate) {
      setDraggedDate(null);
      setDropTargetDate(null);
      return;
    }

    setIsMoving(true);
    try {
      const result = await changePostDate(user.uid, draggedDate, targetDate);
      if (result.success) {
        toast.success('Post moved successfully');
      } else {
        toast.error(result.error || 'Failed to move post');
      }
    } catch (error) {
      console.error('Error moving post:', error);
      toast.error('Failed to move post');
    } finally {
      setIsMoving(false);
      setDraggedDate(null);
      setDropTargetDate(null);
    }
  }, [user, draggedDate]);

  // Get selected post for modal
  const selectedPost = selectedDate ? postsByDate.get(selectedDate) : null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Calendar"
            subtitle="Visual overview of your schedule"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={goToPreviousMonth}>
                  <ChevronLeftIcon className="h-5 w-5" />
                </Button>
                <Button variant="secondary" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="ghost" onClick={goToNextMonth}>
                  <ChevronRightIcon className="h-5 w-5" />
                </Button>
              </div>
            }
          />

          {/* Month/Year Header */}
          <div className="mb-4 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>

          {postsLoading ? (
            <Card padding="lg">
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            </Card>
          ) : (
            <Card padding="none">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarData.map((day, index) => {
                  const post = postsByDate.get(day.date);
                  const isDayToday = day.date === today;

                  return (
                    <CalendarDay
                      key={day.date}
                      date={day.date}
                      dayNumber={day.dayNumber}
                      isCurrentMonth={day.isCurrentMonth}
                      isToday={isDayToday}
                      post={post}
                      onClick={() => day.isCurrentMonth && setSelectedDate(day.date)}
                      isLastRow={index >= 35}
                      today={today}
                      isDragging={draggedDate === day.date}
                      isDropTarget={dropTargetDate === day.date}
                      isMoving={isMoving}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    />
                  );
                })}
              </div>
            </Card>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-facebook" />
              <span>Facebook</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-instagram" />
              <span>Instagram</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border border-primary-500 bg-primary-100 dark:bg-primary-900/30" />
              <span>Today</span>
            </div>
            <div className="ml-auto text-xs">
              <span className="text-gray-400">Tip:</span> Drag posts to reschedule
            </div>
          </div>
        </main>

        {/* Edit Modal */}
        {selectedDate && (
          <DayEditModal
            date={selectedDate}
            post={selectedPost}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>
    </AuthGuard>
  );
}

interface CalendarDayProps {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  post?: Post;
  onClick: () => void;
  isLastRow: boolean;
  today: string;
  isDragging: boolean;
  isDropTarget: boolean;
  isMoving: boolean;
  onDragStart: (date: string) => void;
  onDragEnd: () => void;
  onDragOver: (date: string) => void;
  onDragLeave: () => void;
  onDrop: (targetDate: string) => void;
}

function CalendarDay({
  date,
  dayNumber,
  isCurrentMonth,
  isToday,
  post,
  onClick,
  isLastRow,
  today,
  isDragging,
  isDropTarget,
  isMoving,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: CalendarDayProps) {
  const hasContent = post && (post.imageUrl || post.starterText);
  const hasGenerated = post && (post.facebook || post.instagram);
  const canDrag = isCurrentMonth && post && !isMoving;
  const canDrop = isCurrentMonth && date >= today && !post && !isMoving;

  const handleDragStart = (e: React.DragEvent) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', date);
    onDragStart(date);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(date);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    onDragLeave();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canDrop) return;
    onDrop(date);
  };

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={isCurrentMonth && !isMoving ? onClick : undefined}
      className={clsx(
        'relative flex min-h-[100px] flex-col border-b border-r border-gray-200 p-1.5 text-left transition-colors dark:border-gray-700',
        isCurrentMonth && !isMoving ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'cursor-default',
        !isLastRow ? '' : 'border-b-0',
        isToday && 'bg-primary-50 dark:bg-primary-900/20',
        isDragging && 'opacity-50 ring-2 ring-primary-500 ring-inset',
        isDropTarget && canDrop && 'bg-primary-100 dark:bg-primary-900/40 ring-2 ring-primary-400 ring-inset',
        canDrag && 'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Day Number */}
      <div
        className={`
          flex h-6 w-6 items-center justify-center rounded-full text-sm
          ${isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}
          ${isToday ? 'bg-primary-500 font-semibold text-white' : ''}
        `}
      >
        {dayNumber}
      </div>

      {/* Post Preview */}
      {post && isCurrentMonth && (
        <div className="mt-1 flex-1">
          {/* Image Thumbnail */}
          {post.imageUrl && (
            <div className="relative mb-1 h-10 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              <Image
                src={post.imageUrl}
                alt=""
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Times */}
          <div className="flex flex-col gap-0.5">
            {post.facebook?.scheduledTime && (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-facebook" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime12Hour(post.facebook.scheduledTime)}
                </span>
              </div>
            )}
            {post.instagram?.scheduledTime && (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-instagram" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime12Hour(post.instagram.scheduledTime)}
                </span>
              </div>
            )}
          </div>

          {/* Status indicator */}
          {!post.facebook && !post.instagram && hasContent && (
            <div className="absolute bottom-1 right-1">
              <div className="h-2 w-2 rounded-full bg-yellow-400" title="Needs generation" />
            </div>
          )}
          {hasGenerated && (
            <div className="absolute bottom-1 right-1">
              <div className="h-2 w-2 rounded-full bg-green-400" title="Generated" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DayEditModalProps {
  date: string;
  post?: Post | null;
  onClose: () => void;
}

function DayEditModal({ date, post, onClose }: DayEditModalProps) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleRegenerate = async () => {
    if (!user || !workspace || !post?.starterText.trim()) {
      toast.error('No starter text to regenerate from');
      return;
    }

    setIsRegenerating(true);
    try {
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

      toast.success('Captions regenerated');
    } catch (error) {
      console.error('Error regenerating:', error);
      toast.error('Failed to regenerate captions');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !post) return;

    setIsDeleting(true);
    try {
      await deletePost(user.uid, post.date);
      toast.success('Post deleted');
      onClose();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!post) {
    return (
      <Modal isOpen onClose={onClose} title={formattedDate} size="lg">
        <div className="py-8 text-center">
          <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            No post scheduled for this date
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Create a post in the Planning or Input pages
          </p>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  if (showDeleteConfirm) {
    return (
      <Modal isOpen onClose={() => setShowDeleteConfirm(false)} title="Delete Post" size="sm">
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this post? This action cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={formattedDate} size="xl">
      <div className="space-y-6">
        {/* Post Overview */}
        <div className="flex gap-4">
          {/* Image */}
          <div className="flex-shrink-0">
            {post.imageUrl ? (
              <div className="relative h-32 w-32 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                <Image
                  src={post.imageUrl}
                  alt="Post image"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <PhotoIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={post.status} />
            </div>
            {post.starterText && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Starter Text
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {post.starterText}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Platform Editors */}
        <div className="grid gap-6 md:grid-cols-2">
          <PlatformModalEditor platform="facebook" post={post} />
          <PlatformModalEditor platform="instagram" post={post} />
        </div>
      </div>

      <ModalFooter>
        <div className="flex w-full justify-between">
          <Button
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </Button>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleRegenerate}
              isLoading={isRegenerating}
              disabled={!post.starterText?.trim()}
            >
              Regenerate
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}

interface PlatformModalEditorProps {
  platform: 'facebook' | 'instagram';
  post: Post;
}

function PlatformModalEditor({ platform, post }: PlatformModalEditorProps) {
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
        if (post.status === 'generated') {
          await updatePost(user.uid, post.date, { status: 'edited' });
        }
      } catch (error) {
        console.error('Error saving:', error);
        toast.error('Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    1000
  );

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCaption(e.target.value);
    debouncedSaveCaption(e.target.value);
  };

  const handleHashtagsChange = async (newHashtags: string[]) => {
    setHashtags(newHashtags);
    if (!user || !platformData) return;

    try {
      const updateFn = platform === 'facebook' ? updatePostFacebook : updatePostInstagram;
      await updateFn(user.uid, post.date, {
        ...platformData,
        hashtags: newHashtags,
      });
    } catch (error) {
      console.error('Error saving hashtags:', error);
      toast.error('Failed to save hashtags');
    }
  };

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
    } catch (error) {
      console.error('Error saving time:', error);
      toast.error('Failed to save time');
    }
  };

  const PlatformIcon = platform === 'facebook' ? FacebookIcon : InstagramIcon;
  const platformColor = platform === 'facebook' ? 'text-facebook' : 'text-instagram';
  const platformBgColor = platform === 'facebook' ? 'bg-facebook/10' : 'bg-instagram/10';

  if (!platformData) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${platformBgColor}`}>
            <PlatformIcon className={`h-4 w-4 ${platformColor}`} />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </span>
        </div>
        <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          Not generated yet
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
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
            className="w-28"
          />
        </div>
      </div>

      {/* Caption */}
      <Textarea
        value={caption}
        onChange={handleCaptionChange}
        placeholder="Enter caption..."
        rows={3}
        className="mb-2"
      />

      {/* Hashtags */}
      <div>
        <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          Hashtags ({hashtags.length})
        </p>
        <HashtagInput
          hashtags={hashtags}
          onChange={handleHashtagsChange}
          placeholder="Add hashtag..."
        />
      </div>
    </div>
  );
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

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
