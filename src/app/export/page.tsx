'use client';

import { useState, useMemo, useCallback } from 'react';
import { AuthGuard, Navbar } from '@/components/layout';
import { usePosts } from '@/hooks';
import {
  prepareExport,
  generateCSV,
  downloadCSV,
  getDateRange,
  formatExportFilename,
  type ExportValidation,
} from '@/lib/export';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  EmptyState,
  DocumentIcon,
  Spinner,
  toast,
} from '@/components/ui';
import type { Post } from '@/types';

type Platform = 'facebook' | 'instagram';

export default function ExportPage() {
  const { posts, loading: postsLoading } = usePosts();

  // Platform selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(
    new Set(['facebook', 'instagram'])
  );

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Filter posts that are ready for export (have generated content)
  const exportablePosts = useMemo(() => {
    return posts.filter(
      (post) =>
        post.status === 'generated' ||
        post.status === 'edited' ||
        post.status === 'exported'
    );
  }, [posts]);

  // Get date range
  const dateRange = useMemo(() => getDateRange(exportablePosts), [exportablePosts]);

  // Prepare export validations for each platform
  const fbValidation = useMemo(
    () => prepareExport(exportablePosts, 'facebook'),
    [exportablePosts]
  );
  const igValidation = useMemo(
    () => prepareExport(exportablePosts, 'instagram'),
    [exportablePosts]
  );

  // Toggle platform selection
  const togglePlatform = useCallback((platform: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        // Don't allow deselecting if it's the only one selected
        if (next.size > 1) {
          next.delete(platform);
        }
      } else {
        next.add(platform);
      }
      return next;
    });
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const platforms = Array.from(selectedPlatforms);

      if (platforms.length === 1) {
        // Single platform - download single CSV
        const platform = platforms[0];
        const validation = platform === 'facebook' ? fbValidation : igValidation;

        if (validation.valid.length === 0) {
          toast.error(`No valid posts to export for ${platform}`);
          return;
        }

        const csv = generateCSV(validation.valid);
        const filename = formatExportFilename(platform, dateRange);
        downloadCSV(csv, filename);
        toast.success(`Downloaded ${validation.valid.length} ${platform} posts`);
      } else {
        // Both platforms - download separate CSVs
        let downloadedCount = 0;

        if (fbValidation.valid.length > 0) {
          const fbCSV = generateCSV(fbValidation.valid);
          const fbFilename = formatExportFilename('facebook', dateRange);
          downloadCSV(fbCSV, fbFilename);
          downloadedCount++;
        }

        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (igValidation.valid.length > 0) {
          const igCSV = generateCSV(igValidation.valid);
          const igFilename = formatExportFilename('instagram', dateRange);
          downloadCSV(igCSV, igFilename);
          downloadedCount++;
        }

        if (downloadedCount > 0) {
          toast.success(
            `Downloaded ${fbValidation.valid.length} Facebook and ${igValidation.valid.length} Instagram posts`
          );
        } else {
          toast.error('No valid posts to export');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export');
    } finally {
      setIsExporting(false);
    }
  }, [selectedPlatforms, fbValidation, igValidation, dateRange]);

  // Calculate totals
  const totalValidPosts =
    (selectedPlatforms.has('facebook') ? fbValidation.valid.length : 0) +
    (selectedPlatforms.has('instagram') ? igValidation.valid.length : 0);

  const totalWarnings =
    (selectedPlatforms.has('facebook')
      ? fbValidation.warnings.missingCaption.length +
        fbValidation.warnings.missingImage.length +
        fbValidation.warnings.missingTime.length
      : 0) +
    (selectedPlatforms.has('instagram')
      ? igValidation.warnings.missingCaption.length +
        igValidation.warnings.missingImage.length +
        igValidation.warnings.missingTime.length
      : 0);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Export"
            subtitle="Download Buffer-compatible CSV files"
          />

          {postsLoading ? (
            <Card padding="lg">
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            </Card>
          ) : exportablePosts.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={<DocumentIcon className="h-6 w-6" />}
                title="No posts ready for export"
                description="Generate AI captions for your posts first on the Review page"
                action={
                  <Button onClick={() => (window.location.href = '/review')}>
                    Go to Review
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              {/* Platform Selection */}
              <Card padding="lg" className="mb-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Select Platforms
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Choose which platforms to include in your export
                  </p>
                </div>

                <div className="space-y-3">
                  <PlatformOption
                    platform="facebook"
                    isSelected={selectedPlatforms.has('facebook')}
                    onToggle={() => togglePlatform('facebook')}
                    validation={fbValidation}
                  />
                  <PlatformOption
                    platform="instagram"
                    isSelected={selectedPlatforms.has('instagram')}
                    onToggle={() => togglePlatform('instagram')}
                    validation={igValidation}
                  />
                </div>
              </Card>

              {/* Export Summary */}
              <Card padding="lg" className="mb-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Export Summary
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Date Range</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {dateRange}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Posts Ready</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {totalValidPosts}
                    </span>
                  </div>
                  {totalWarnings > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Posts with Warnings
                      </span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {totalWarnings}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  {showPreview ? 'Hide details' : 'Show details'}
                </button>

                {showPreview && (
                  <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                    {selectedPlatforms.has('facebook') && (
                      <PlatformDetails
                        platform="facebook"
                        validation={fbValidation}
                      />
                    )}
                    {selectedPlatforms.has('instagram') && (
                      <PlatformDetails
                        platform="instagram"
                        validation={igValidation}
                      />
                    )}
                  </div>
                )}
              </Card>

              {/* Export Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleExport}
                  isLoading={isExporting}
                  disabled={totalValidPosts === 0}
                  size="lg"
                >
                  <DownloadIcon className="mr-2 h-5 w-5" />
                  Download{' '}
                  {selectedPlatforms.size === 2 ? 'CSVs' : 'CSV'}
                </Button>
              </div>

              {/* CSV Format Info */}
              <div className="mt-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Buffer CSV Format
                </h3>
                <code className="block whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">
                  Text,Media URL,Scheduled Date,Scheduled Time{'\n'}
                  &quot;Your caption here...&quot;,https://...,2025-01-20,11:30
                </code>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

interface PlatformOptionProps {
  platform: Platform;
  isSelected: boolean;
  onToggle: () => void;
  validation: ExportValidation;
}

function PlatformOption({
  platform,
  isSelected,
  onToggle,
  validation,
}: PlatformOptionProps) {
  const PlatformIcon = platform === 'facebook' ? FacebookIcon : InstagramIcon;
  const platformColor = platform === 'facebook' ? 'text-facebook' : 'text-instagram';
  const platformBgColor = platform === 'facebook' ? 'bg-facebook/10' : 'bg-instagram/10';
  const totalWarnings =
    validation.warnings.missingCaption.length +
    validation.warnings.missingImage.length +
    validation.warnings.missingTime.length;

  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <div className={`rounded-lg p-2 ${platformBgColor}`}>
        <PlatformIcon className={`h-5 w-5 ${platformColor}`} />
      </div>
      <div className="flex-1">
        <span className="font-medium text-gray-900 dark:text-white">
          {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </span>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{validation.valid.length} ready</span>
          {totalWarnings > 0 && (
            <>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400">
                {totalWarnings} with warnings
              </span>
            </>
          )}
        </div>
      </div>
    </label>
  );
}

interface PlatformDetailsProps {
  platform: Platform;
  validation: ExportValidation;
}

function PlatformDetails({ platform, validation }: PlatformDetailsProps) {
  const { warnings } = validation;
  const hasWarnings =
    warnings.missingCaption.length > 0 ||
    warnings.missingImage.length > 0 ||
    warnings.missingTime.length > 0;

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {platform.charAt(0).toUpperCase() + platform.slice(1)}
      </h4>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-gray-600 dark:text-gray-400">
            {validation.valid.length} posts ready to export
          </span>
        </div>
        {warnings.missingCaption.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-amber-600 dark:text-amber-400">
              {warnings.missingCaption.length} missing caption
            </span>
          </div>
        )}
        {warnings.missingImage.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-amber-600 dark:text-amber-400">
              {warnings.missingImage.length} missing image
            </span>
          </div>
        )}
        {warnings.missingTime.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-amber-600 dark:text-amber-400">
              {warnings.missingTime.length} missing scheduled time
            </span>
          </div>
        )}
        {!hasWarnings && validation.valid.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">
              No posts ready
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
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

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}
