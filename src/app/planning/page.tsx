'use client';

import { useState, useCallback, useMemo } from 'react';
import { AuthGuard, Navbar } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts } from '@/hooks';
import { createPostsBatch } from '@/lib/services';
import {
  generateSchedule,
  validateDateRange,
  formatTimeForDisplay,
  getWeeksInRange,
  type ScheduledPost,
} from '@/lib/scheduling';
import {
  parseCSV,
  readFileAsText,
  validateCSVFile,
  type ParsedCSVRow,
} from '@/lib/csvParser';
import {
  PageHeader,
  Card,
  Button,
  DateRangePicker,
  Slider,
  EmptyState,
  CalendarIcon,
  Modal,
  Badge,
  toast,
} from '@/components/ui';

type TabType = 'schedule' | 'csv';

export default function PlanningPage() {
  const { user } = useAuth();
  const { posts } = usePosts();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('schedule');

  // Schedule generator state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [postsPerWeek, setPostsPerWeek] = useState(5);
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduledPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<ParsedCSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvHasDates, setCsvHasDates] = useState(false);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [showCsvPreview, setShowCsvPreview] = useState(false);

  // Get existing post dates
  const existingPostDates = useMemo(() => {
    return new Set(posts.map((p) => p.date));
  }, [posts]);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Validate date range
  const dateValidation = useMemo(() => {
    if (!startDate || !endDate) return { valid: false, error: undefined };
    return validateDateRange(startDate, endDate);
  }, [startDate, endDate]);

  // Calculate weeks in range
  const weeksInRange = useMemo(() => {
    if (!startDate || !endDate || !dateValidation.valid) return 0;
    return getWeeksInRange(startDate, endDate);
  }, [startDate, endDate, dateValidation.valid]);

  // Generate schedule
  const handleGenerateSchedule = useCallback(() => {
    if (!dateValidation.valid) return;

    setIsGenerating(true);

    // Simulate slight delay for UX
    setTimeout(() => {
      const schedule = generateSchedule({
        startDate,
        endDate,
        postsPerWeek,
        existingPostDates,
      });

      setGeneratedSchedule(schedule);
      setIsGenerating(false);

      if (schedule.length === 0) {
        toast.error('No available dates in the selected range');
      }
    }, 300);
  }, [startDate, endDate, postsPerWeek, existingPostDates, dateValidation.valid]);

  // Apply schedule (create posts)
  const handleApplySchedule = useCallback(async () => {
    if (!user || generatedSchedule.length === 0) return;

    setIsApplying(true);

    try {
      const postsToCreate = generatedSchedule.map((item) => ({
        date: item.date,
        starterText: '',
        facebook: {
          caption: '',
          hashtags: [],
          scheduledTime: item.facebookTime,
          timeSource: 'ai' as const,
        },
        instagram: {
          caption: '',
          hashtags: [],
          scheduledTime: item.instagramTime,
          timeSource: 'ai' as const,
        },
      }));

      await createPostsBatch(user.uid, postsToCreate);

      toast.success(`Created ${generatedSchedule.length} posts`);
      setGeneratedSchedule([]);
      setStartDate('');
      setEndDate('');
    } catch (error) {
      console.error('Error applying schedule:', error);
      toast.error('Failed to create posts');
    } finally {
      setIsApplying(false);
    }
  }, [user, generatedSchedule]);

  // Handle CSV file selection
  const handleCsvFileSelect = useCallback(async (file: File) => {
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file');
      return;
    }

    setCsvFile(file);
    setIsParsingCsv(true);
    setCsvErrors([]);
    setCsvRows([]);

    try {
      const content = await readFileAsText(file);
      const result = parseCSV(content);

      setCsvRows(result.rows);
      setCsvErrors(result.errors);
      setCsvHasDates(result.hasDateColumn);
      setShowCsvPreview(true);

      if (result.errors.length > 0) {
        toast.error(`Found ${result.errors.length} error(s) in CSV`);
      } else if (result.rows.length > 0) {
        toast.success(`Parsed ${result.rows.length} rows`);
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file');
    } finally {
      setIsParsingCsv(false);
    }
  }, []);

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleCsvFileSelect(file);
      }
    },
    [handleCsvFileSelect]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleCsvFileSelect(file);
      }
    },
    [handleCsvFileSelect]
  );

  // Apply CSV import
  const handleApplyCsv = useCallback(async () => {
    if (!user || csvRows.length === 0) return;

    // Filter rows without errors
    const validRows = csvRows.filter((row) => row.errors.length === 0 && row.starterText);

    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setIsApplying(true);

    try {
      // If CSV doesn't have dates, we need to assign them
      let rowsWithDates = validRows;

      if (!csvHasDates) {
        // Generate dates for rows without dates
        const schedule = generateSchedule({
          startDate: today,
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          postsPerWeek: 5,
          existingPostDates,
        });

        rowsWithDates = validRows.slice(0, schedule.length).map((row, index) => ({
          ...row,
          date: schedule[index].date,
        }));
      }

      const postsToCreate = rowsWithDates.map((row) => ({
        date: row.date!,
        starterText: row.starterText,
        imageUrl: row.imageUrl,
      }));

      await createPostsBatch(user.uid, postsToCreate);

      toast.success(`Imported ${postsToCreate.length} posts`);
      setCsvFile(null);
      setCsvRows([]);
      setCsvErrors([]);
      setShowCsvPreview(false);
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import posts');
    } finally {
      setIsApplying(false);
    }
  }, [user, csvRows, csvHasDates, existingPostDates, today]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Planning"
            subtitle="Create your posting schedule with AI-optimized timing"
          />

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex gap-6">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === 'schedule'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Generate Schedule
              </button>
              <button
                onClick={() => setActiveTab('csv')}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === 'csv'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Import CSV
              </button>
            </nav>
          </div>

          {activeTab === 'schedule' ? (
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Controls Panel */}
              <Card padding="lg">
                <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                  Schedule Settings
                </h2>

                <div className="space-y-6">
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    minDate={today}
                    error={dateValidation.error}
                  />

                  {weeksInRange > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {weeksInRange} week{weeksInRange !== 1 ? 's' : ''} selected
                    </p>
                  )}

                  <Slider
                    label="Posts per week"
                    value={postsPerWeek}
                    onChange={(e) => setPostsPerWeek(Number(e.target.value))}
                    min={3}
                    max={7}
                    valueLabel="posts"
                    marks={[
                      { value: 3, label: '3' },
                      { value: 5, label: '5' },
                      { value: 7, label: '7' },
                    ]}
                    helperText="Recommended: 4-5 posts per week for optimal engagement"
                  />

                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={!dateValidation.valid}
                    isLoading={isGenerating}
                    className="w-full"
                  >
                    Generate Schedule
                  </Button>
                </div>
              </Card>

              {/* Preview Panel */}
              <Card padding="lg">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Schedule Preview
                  </h2>
                  {generatedSchedule.length > 0 && (
                    <Badge variant="primary">{generatedSchedule.length} posts</Badge>
                  )}
                </div>

                {generatedSchedule.length === 0 ? (
                  <EmptyState
                    icon={<CalendarIcon className="h-6 w-6" />}
                    title="No schedule generated"
                    description="Configure your settings and click Generate Schedule"
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white dark:bg-gray-800">
                          <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <th className="pb-3 pr-4">Date</th>
                            <th className="pb-3 pr-4">Day</th>
                            <th className="pb-3 pr-4">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-facebook" />
                                FB
                              </span>
                            </th>
                            <th className="pb-3">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-instagram" />
                                IG
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedSchedule.map((item) => (
                            <tr
                              key={item.date}
                              className="border-b border-gray-100 text-sm dark:border-gray-700/50"
                            >
                              <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">
                                {formatDateShort(item.date)}
                              </td>
                              <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                                {item.dayOfWeek.slice(0, 3)}
                              </td>
                              <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                                {formatTimeForDisplay(item.facebookTime)}
                              </td>
                              <td className="py-3 text-gray-600 dark:text-gray-400">
                                {formatTimeForDisplay(item.instagramTime)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => setGeneratedSchedule([])}
                        className="flex-1"
                      >
                        Clear
                      </Button>
                      <Button
                        onClick={handleApplySchedule}
                        isLoading={isApplying}
                        className="flex-1"
                      >
                        Apply Schedule
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            /* CSV Upload Tab */
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Upload Panel */}
              <Card padding="lg">
                <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                  Upload CSV
                </h2>

                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-primary-400 dark:border-gray-600 dark:hover:border-primary-500"
                >
                  <UploadIcon className="mb-4 h-12 w-12 text-gray-400" />
                  <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                    Drag and drop your CSV file here
                  </p>
                  <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    {isParsingCsv ? 'Parsing...' : 'Select File'}
                  </label>
                </div>

                {csvFile && (
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-800">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {csvFile.name}
                    </span>
                    <button
                      onClick={() => {
                        setCsvFile(null);
                        setCsvRows([]);
                        setCsvErrors([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <XIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expected CSV Format
                  </h3>
                  <div className="rounded-lg bg-gray-100 p-3 font-mono text-xs dark:bg-gray-800">
                    <p className="text-gray-600 dark:text-gray-400">
                      date,starterText,imageUrl
                    </p>
                    <p className="text-gray-500 dark:text-gray-500">
                      2025-01-20,&quot;Happy hour special!&quot;,https://...
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Date column is optional. If omitted, dates will be auto-assigned.
                  </p>
                </div>
              </Card>

              {/* Preview Panel */}
              <Card padding="lg">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Preview
                  </h2>
                  {csvRows.length > 0 && (
                    <Badge
                      variant={csvErrors.length > 0 ? 'warning' : 'success'}
                    >
                      {csvRows.length} rows
                    </Badge>
                  )}
                </div>

                {csvRows.length === 0 ? (
                  <EmptyState
                    icon={<DocumentIcon className="h-6 w-6" />}
                    title="No CSV loaded"
                    description="Upload a CSV file to preview your posts"
                  />
                ) : (
                  <div className="space-y-4">
                    {csvErrors.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        <strong>Errors:</strong>
                        <ul className="mt-1 list-inside list-disc">
                          {csvErrors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!csvHasDates && (
                      <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        No date column found. Dates will be automatically assigned using
                        optimal scheduling.
                      </div>
                    )}

                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white dark:bg-gray-800">
                          <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <th className="pb-3 pr-4">#</th>
                            {csvHasDates && <th className="pb-3 pr-4">Date</th>}
                            <th className="pb-3 pr-4">Text</th>
                            <th className="pb-3">Image</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 20).map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={`border-b border-gray-100 text-sm dark:border-gray-700/50 ${
                                row.errors.length > 0
                                  ? 'bg-red-50 dark:bg-red-900/10'
                                  : ''
                              }`}
                            >
                              <td className="py-2 pr-4 text-gray-500">
                                {row.rowNumber}
                              </td>
                              {csvHasDates && (
                                <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                  {row.date || '-'}
                                </td>
                              )}
                              <td className="max-w-[200px] truncate py-2 pr-4 text-gray-900 dark:text-white">
                                {row.starterText || '-'}
                              </td>
                              <td className="py-2 text-gray-500">
                                {row.imageUrl ? (
                                  <CheckIcon className="h-4 w-4 text-green-500" />
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvRows.length > 20 && (
                        <p className="mt-2 text-center text-sm text-gray-500">
                          Showing 20 of {csvRows.length} rows
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCsvFile(null);
                          setCsvRows([]);
                          setCsvErrors([]);
                        }}
                        className="flex-1"
                      >
                        Clear
                      </Button>
                      <Button
                        onClick={handleApplyCsv}
                        isLoading={isApplying}
                        disabled={csvRows.filter((r) => r.errors.length === 0).length === 0}
                        className="flex-1"
                      >
                        Import {csvRows.filter((r) => r.errors.length === 0).length} Posts
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
