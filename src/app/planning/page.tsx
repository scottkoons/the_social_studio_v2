'use client';

import { useState, useCallback, useMemo } from 'react';
import { AuthGuard, Navbar } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts } from '@/hooks';
import { createPostsBatch, getPostsByDateRange } from '@/lib/services';
import {
  generateSchedule,
  validateDateRange,
  formatTimeForDisplay,
  getWeeksInRange,
  generateTimeForPlatform,
  type ScheduledPost,
} from '@/lib/scheduling';
import {
  readFileAsText,
  validateCSVFile,
} from '@/lib/csvParser';
import {
  parseCSVToRows,
  assignDatesWithAnchors,
  generateDateRange,
  type CSVRow,
  type SchedulingResult,
  type OccupiedDates,
} from '@/lib/csvScheduler';
import {
  PageHeader,
  Card,
  Button,
  DateRangePicker,
  Slider,
  EmptyState,
  CalendarIcon,
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
  const [postsPerWeek, setPostsPerWeek] = useState(7);
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduledPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([]);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  // CSV scheduling state
  const [csvStartDate, setCsvStartDate] = useState('');
  const [csvEndDate, setCsvEndDate] = useState('');
  const [schedulingResult, setSchedulingResult] = useState<SchedulingResult | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showIssuesModal, setShowIssuesModal] = useState(false);

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

  // Validate CSV date range
  const csvDateValidation = useMemo(() => {
    if (!csvStartDate || !csvEndDate) return { valid: false, error: undefined };
    return validateDateRange(csvStartDate, csvEndDate);
  }, [csvStartDate, csvEndDate]);

  // Check if we have enough dates for CSV rows
  const csvDaysInRange = useMemo(() => {
    if (!csvStartDate || !csvEndDate || !csvDateValidation.valid) return 0;
    return generateDateRange(csvStartDate, csvEndDate).length;
  }, [csvStartDate, csvEndDate, csvDateValidation.valid]);

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
    setCsvParseErrors([]);
    setCsvRows([]);
    setSchedulingResult(null);

    try {
      const content = await readFileAsText(file);
      const result = parseCSVToRows(content);

      setCsvRows(result.rows);
      setCsvParseErrors(result.errors);

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

  // Schedule CSV rows with anchor support and collision detection
  const handleScheduleCsv = useCallback(async () => {
    if (!csvDateValidation.valid || csvRows.length === 0 || !user) return;

    setIsScheduling(true);

    try {
      // Load existing posts for the date range from Firestore
      const existingPosts = await getPostsByDateRange(user.uid, csvStartDate, csvEndDate);

      // Build occupied dates map
      const occupiedDates: OccupiedDates = {
        instagram: new Set<string>(),
        facebook: new Set<string>(),
      };

      for (const post of existingPosts) {
        if (post.instagram && (post.instagram.caption || post.instagram.scheduledTime)) {
          occupiedDates.instagram.add(post.date);
        }
        if (post.facebook && (post.facebook.caption || post.facebook.scheduledTime)) {
          occupiedDates.facebook.add(post.date);
        }
      }

      // Generate date range
      const allDates = generateDateRange(csvStartDate, csvEndDate);

      // Run the scheduling algorithm
      const result = assignDatesWithAnchors(csvRows, allDates, occupiedDates);
      setSchedulingResult(result);

      if (!result.canProceed) {
        setShowIssuesModal(true);
        toast.error('Cannot proceed - see import issues');
      } else if (result.issues.length > 0 || result.unscheduledRows.length > 0) {
        setShowIssuesModal(true);
        toast.error(`${result.issues.length} issue(s) found`);
      } else {
        toast.success(`Scheduled ${result.scheduledRows.length} posts`);
      }
    } catch (error) {
      console.error('Error scheduling CSV:', error);
      toast.error('Failed to check existing posts');
    } finally {
      setIsScheduling(false);
    }
  }, [csvDateValidation.valid, csvRows, csvStartDate, csvEndDate, user]);

  // Apply CSV import
  const handleApplyCsv = useCallback(async () => {
    if (!user || !schedulingResult || !schedulingResult.canProceed) return;

    if (schedulingResult.scheduledRows.length === 0) {
      toast.error('No rows to import');
      return;
    }

    setIsApplying(true);

    try {
      // Build posts array with assigned dates and platform-specific times
      const postsToCreate = schedulingResult.scheduledRows.map((row) => {
        const date = new Date(row.finalDate + 'T00:00:00');
        const dayOfWeek = date.getDay();

        return {
          date: row.finalDate!,
          starterText: row.starterText,
          imageUrl: row.imageUrl || undefined,
          facebook: {
            caption: '',
            hashtags: [],
            scheduledTime: generateTimeForPlatform('facebook', dayOfWeek),
            timeSource: 'ai' as const,
          },
          instagram: {
            caption: '',
            hashtags: [],
            scheduledTime: generateTimeForPlatform('instagram', dayOfWeek),
            timeSource: 'ai' as const,
          },
        };
      });

      await createPostsBatch(user.uid, postsToCreate);

      toast.success(`Imported ${postsToCreate.length} posts`);
      setCsvFile(null);
      setCsvRows([]);
      setCsvParseErrors([]);
      setCsvStartDate('');
      setCsvEndDate('');
      setSchedulingResult(null);
      setShowIssuesModal(false);
    } catch (error) {
      console.error('Error importing CSV:', error);
      const message = error instanceof Error ? error.message : 'Failed to import posts';
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  }, [user, schedulingResult]);

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
                    helperText="Default: 7 posts per week (daily posting)"
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
                        setCsvParseErrors([]);
                        setSchedulingResult(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <XIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* Date Range Selection for CSV */}
                {csvRows.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select Date Range
                    </h3>
                    <DateRangePicker
                      startDate={csvStartDate}
                      endDate={csvEndDate}
                      onStartDateChange={setCsvStartDate}
                      onEndDateChange={setCsvEndDate}
                      minDate={today}
                      error={csvDateValidation.error}
                    />
                    {csvDaysInRange > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {csvDaysInRange} days available for {csvRows.length} rows
                        {csvDaysInRange < csvRows.length && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {' '}(need more dates)
                          </span>
                        )}
                      </p>
                    )}
                    <Button
                      onClick={handleScheduleCsv}
                      disabled={!csvDateValidation.valid || csvRows.length === 0}
                      isLoading={isScheduling}
                      className="w-full"
                    >
                      Schedule Posts
                    </Button>
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
                    Dates are optional. Rows with dates become &quot;anchors&quot; and keep their date.
                    Empty dates are auto-assigned while maintaining row order.
                  </p>
                </div>
              </Card>

              {/* Preview Panel */}
              <Card padding="lg">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {schedulingResult ? 'Scheduled Posts' : 'CSV Preview'}
                  </h2>
                  {schedulingResult ? (
                    <div className="flex items-center gap-2">
                      {schedulingResult.issues.length > 0 && (
                        <button
                          onClick={() => setShowIssuesModal(true)}
                          className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400"
                        >
                          View Issues
                        </button>
                      )}
                      <Badge
                        variant={!schedulingResult.canProceed ? 'danger' : schedulingResult.unscheduledRows.length > 0 ? 'warning' : 'success'}
                      >
                        {schedulingResult.summary.scheduled} scheduled
                      </Badge>
                    </div>
                  ) : csvRows.length > 0 ? (
                    <Badge
                      variant={csvParseErrors.length > 0 ? 'warning' : 'primary'}
                    >
                      {csvRows.length} rows
                    </Badge>
                  ) : null}
                </div>

                {csvRows.length === 0 ? (
                  <EmptyState
                    icon={<DocumentIcon className="h-6 w-6" />}
                    title="No CSV loaded"
                    description="Upload a CSV file to preview your posts"
                  />
                ) : schedulingResult ? (
                  /* Show scheduling results */
                  <div className="space-y-4">
                    {/* Summary Bar */}
                    <div className="flex items-center gap-4 rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {schedulingResult.summary.scheduled} scheduled
                        </span>
                      </div>
                      {schedulingResult.summary.unscheduled > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {schedulingResult.summary.unscheduled} unscheduled
                          </span>
                        </div>
                      )}
                      {schedulingResult.summary.blocked > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {schedulingResult.summary.blocked} blocked
                          </span>
                        </div>
                      )}
                    </div>

                    {!schedulingResult.canProceed && (
                      <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                        <div className="flex items-start gap-3">
                          <ErrorIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                          <div>
                            <h4 className="text-sm font-medium text-red-800 dark:text-red-300">
                              Cannot Import - Blocking Errors
                            </h4>
                            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                              Fix the issues below before importing.
                            </p>
                            <button
                              onClick={() => setShowIssuesModal(true)}
                              className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-800 dark:text-red-400"
                            >
                              View all {schedulingResult.issues.length} issue(s)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white dark:bg-gray-800">
                          <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <th className="pb-3 pr-4">#</th>
                            <th className="pb-3 pr-4">Date</th>
                            <th className="pb-3 pr-4">Text</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedulingResult.scheduledRows.slice(0, 15).map((row) => (
                            <tr
                              key={row.rowIndex}
                              className="border-b border-gray-100 text-sm dark:border-gray-700/50"
                            >
                              <td className="py-2 pr-4 text-gray-500">
                                {row.rowIndex}
                              </td>
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                  {formatDateShort(row.finalDate!)}
                                  {row.anchoredDate && (
                                    <AnchorIcon className="h-3 w-3 text-primary-500" title="Anchored date" />
                                  )}
                                </span>
                              </td>
                              <td className="max-w-[150px] truncate py-2 pr-4 text-gray-900 dark:text-white">
                                {row.starterText || '-'}
                              </td>
                              <td className="py-2">
                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <CheckIcon className="h-4 w-4" />
                                  Ready
                                </span>
                              </td>
                            </tr>
                          ))}
                          {schedulingResult.unscheduledRows.slice(0, 5).map((row) => (
                            <tr
                              key={row.rowIndex}
                              className="border-b border-gray-100 bg-red-50 text-sm dark:border-gray-700/50 dark:bg-red-900/10"
                            >
                              <td className="py-2 pr-4 text-gray-500">
                                {row.rowIndex}
                              </td>
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                {row.rawDate || <span className="italic text-gray-400">auto</span>}
                              </td>
                              <td className="max-w-[150px] truncate py-2 pr-4 text-gray-900 dark:text-white">
                                {row.starterText || '-'}
                              </td>
                              <td className="py-2">
                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <ErrorIcon className="h-4 w-4" />
                                  Error
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(schedulingResult.scheduledRows.length > 15 || schedulingResult.unscheduledRows.length > 5) && (
                        <p className="mt-2 text-center text-sm text-gray-500">
                          Showing partial results. {schedulingResult.summary.totalRows} total rows.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => setSchedulingResult(null)}
                        className="flex-1"
                      >
                        Re-schedule
                      </Button>
                      <Button
                        onClick={handleApplyCsv}
                        isLoading={isApplying}
                        disabled={!schedulingResult.canProceed || schedulingResult.scheduledRows.length === 0}
                        className="flex-1"
                      >
                        Import {schedulingResult.scheduledRows.length} Posts
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Show CSV preview before scheduling */
                  <div className="space-y-4">
                    {csvParseErrors.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        <strong>Parse Errors:</strong>
                        <ul className="mt-1 list-inside list-disc">
                          {csvParseErrors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                      Select a date range and click &quot;Schedule Posts&quot; to assign dates.
                      Rows with dates in the CSV will be anchored to those dates.
                    </div>

                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white dark:bg-gray-800">
                          <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            <th className="pb-3 pr-4">#</th>
                            <th className="pb-3 pr-4">Date (anchor)</th>
                            <th className="pb-3 pr-4">Text</th>
                            <th className="pb-3">Image</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 20).map((row) => (
                            <tr
                              key={row.rowIndex}
                              className={`border-b border-gray-100 text-sm dark:border-gray-700/50 ${
                                row.error
                                  ? 'bg-red-50 dark:bg-red-900/10'
                                  : ''
                              }`}
                            >
                              <td className="py-2 pr-4 text-gray-500">
                                {row.rowIndex}
                              </td>
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                {row.rawDate || <span className="text-gray-400 italic">auto</span>}
                              </td>
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
                          setCsvParseErrors([]);
                        }}
                        className="flex-1"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </main>

        {/* Import Issues Modal */}
        {showIssuesModal && schedulingResult && (
          <ImportIssuesModal
            result={schedulingResult}
            onClose={() => setShowIssuesModal(false)}
          />
        )}
      </div>
    </AuthGuard>
  );
}

// Import Issues Modal Component
function ImportIssuesModal({
  result,
  onClose,
}: {
  result: SchedulingResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${result.canProceed ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {result.canProceed ? (
                <WarningIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <ErrorIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Import Issues
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-4">
          {/* Summary */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {result.summary.scheduled}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">Scheduled</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-900/20">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {result.summary.unscheduled}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">Unscheduled</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-900/20">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {result.summary.blocked}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">Blocked</p>
            </div>
          </div>

          {/* Blocking Errors */}
          {result.blockingErrors.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
                <ErrorIcon className="h-4 w-4" />
                Blocking Errors (must fix before import)
              </h3>
              <ul className="space-y-2">
                {result.blockingErrors.map((error, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  >
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
                <LightbulbIcon className="h-4 w-4" />
                Suggested Fixes
              </h3>
              <ul className="space-y-2">
                {result.suggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-Row Issues Table */}
          {result.issues.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Per-Row Issues ({result.issues.length})
              </h3>
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3">Row</th>
                      <th className="px-4 py-3">Problem</th>
                      <th className="px-4 py-3">Fix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {result.issues.map((issue, i) => (
                      <tr
                        key={i}
                        className={issue.isBlocking ? 'bg-red-50 dark:bg-red-900/10' : ''}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {issue.rowIndex}
                          {issue.isBlocking && (
                            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              blocking
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {issue.problem}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">
                          {issue.suggestedFix}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {result.canProceed
                ? `${result.summary.scheduled} rows ready to import`
                : 'Fix blocking errors to proceed'}
            </p>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
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

function AnchorIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {title && <title>{title}</title>}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8V4m0 4a2 2 0 100 4 2 2 0 000-4zm0 4v8m-4 0h8M5 12h2m10 0h2"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}
