/**
 * Export utilities for generating Buffer-compatible CSV files
 */

import type { Post } from '@/types';
import { buildFullCaption } from './aiGeneration';

export interface ExportPost {
  text: string;
  mediaUrl: string;
  scheduledDate: string;
  scheduledTime: string;
}

export interface ExportValidation {
  valid: ExportPost[];
  warnings: {
    missingCaption: Post[];
    missingImage: Post[];
    missingTime: Post[];
  };
}

/**
 * Prepare posts for export, separating valid posts from those with warnings
 */
export function prepareExport(
  posts: Post[],
  platform: 'facebook' | 'instagram'
): ExportValidation {
  const valid: ExportPost[] = [];
  const warnings = {
    missingCaption: [] as Post[],
    missingImage: [] as Post[],
    missingTime: [] as Post[],
  };

  for (const post of posts) {
    const platformData = post[platform];

    // Check for missing data
    if (!platformData?.caption) {
      warnings.missingCaption.push(post);
      continue;
    }
    if (!post.imageUrl) {
      warnings.missingImage.push(post);
      continue;
    }
    if (!platformData?.scheduledTime) {
      warnings.missingTime.push(post);
      continue;
    }

    // Build full caption with hashtags
    const fullCaption = buildFullCaption(
      platformData.caption,
      platformData.hashtags || []
    );

    valid.push({
      text: fullCaption,
      mediaUrl: post.imageUrl,
      scheduledDate: post.date,
      scheduledTime: platformData.scheduledTime,
    });
  }

  return { valid, warnings };
}

/**
 * Escape a value for CSV (wrap in quotes, escape internal quotes)
 */
function escapeCSV(value: string): string {
  // If value contains quotes, commas, or newlines, wrap in quotes
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a Buffer-compatible CSV string
 */
export function generateCSV(posts: ExportPost[]): string {
  const header = 'Text,Media URL,Scheduled Date,Scheduled Time';
  const rows = posts.map((post) => {
    return [
      escapeCSV(post.text),
      escapeCSV(post.mediaUrl),
      post.scheduledDate,
      post.scheduledTime,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Download a CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download a ZIP file with multiple CSVs
 * Uses JSZip-like manual approach (simple implementation)
 */
export async function downloadZIP(
  files: Array<{ name: string; content: string }>,
  zipFilename: string
): Promise<void> {
  // For simplicity, we'll create individual downloads instead of actual ZIP
  // In production, you'd use a library like JSZip
  // For now, we download them sequentially
  for (const file of files) {
    downloadCSV(file.content, file.name);
    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Get date range string from posts
 */
export function getDateRange(posts: Post[]): string {
  if (posts.length === 0) return 'No posts';

  const dates = posts.map((p) => p.date).sort();
  const startDate = new Date(dates[0] + 'T00:00:00');
  const endDate = new Date(dates[dates.length - 1] + 'T00:00:00');

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (dates[0] === dates[dates.length - 1]) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Format filename with date
 */
export function formatExportFilename(
  platform: 'facebook' | 'instagram',
  dateRange: string
): string {
  const cleanDateRange = dateRange.replace(/[^a-zA-Z0-9-]/g, '_');
  return `${platform}_posts_${cleanDateRange}.csv`;
}
