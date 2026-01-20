/**
 * AI Scheduling Algorithm for The Social Studio
 *
 * This module handles optimal day and time selection for social media posts
 * based on restaurant-focused engagement patterns.
 *
 * Posting windows are based on research for restaurant/food business engagement.
 */

export interface ScheduledPost {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  facebookTime: string; // HH:MM (24hr)
  instagramTime: string; // HH:MM (24hr)
}

export interface ScheduleOptions {
  startDate: string;
  endDate: string;
  postsPerWeek: number;
  existingPostDates?: Set<string>;
}

interface TimeWindow {
  start: number; // Hours in 24hr format (e.g., 11.5 = 11:30 AM)
  end: number;
}

// Day-specific posting windows
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const INSTAGRAM_WINDOWS: Record<number, TimeWindow[]> = {
  0: [{ start: 9, end: 14 }],           // Sunday: 9:00 AM – 2:00 PM
  1: [{ start: 11.5, end: 13.5 }],      // Monday: 11:30 AM – 1:30 PM
  2: [{ start: 11.5, end: 13.5 }],      // Tuesday: 11:30 AM – 1:30 PM
  3: [{ start: 11, end: 13 }, { start: 17, end: 18 }],  // Wednesday: 11:00 AM – 1:00 PM and 5:00 PM – 6:00 PM
  4: [{ start: 11, end: 13 }, { start: 16, end: 17 }],  // Thursday: 11:00 AM – 1:00 PM and 4:00 PM – 5:00 PM
  5: [{ start: 9, end: 11 }, { start: 15, end: 17 }],   // Friday: 9:00 AM – 11:00 AM and 3:00 PM – 5:00 PM
  6: [{ start: 10, end: 13 }],          // Saturday: 10:00 AM – 1:00 PM
};

const FACEBOOK_WINDOWS: Record<number, TimeWindow[]> = {
  0: [{ start: 10, end: 13 }],          // Sunday: 10:00 AM – 1:00 PM
  1: [{ start: 12, end: 15 }],          // Monday: 12:00 PM – 3:00 PM
  2: [{ start: 12, end: 15 }],          // Tuesday: 12:00 PM – 3:00 PM
  3: [{ start: 11, end: 14 }],          // Wednesday: 11:00 AM – 2:00 PM
  4: [{ start: 13, end: 16 }],          // Thursday: 1:00 PM – 4:00 PM
  5: [{ start: 11, end: 13 }],          // Friday: 11:00 AM – 1:00 PM
  6: [{ start: 9, end: 11 }],           // Saturday: 9:00 AM – 11:00 AM
};

// Day engagement rankings (0 = Sunday, 6 = Saturday)
// Lower rank = higher priority
const DAY_PRIORITY: Record<number, number> = {
  0: 2, // Sunday - high engagement
  1: 6, // Monday - lowest engagement (avoid)
  2: 5, // Tuesday - low
  3: 4, // Wednesday - moderate
  4: 1, // Thursday - high engagement
  5: 1, // Friday - high engagement
  6: 2, // Saturday - high engagement
};

/**
 * Pick a random window from available windows for a day
 */
function pickRandomWindow(windows: TimeWindow[]): TimeWindow {
  const index = Math.floor(Math.random() * windows.length);
  return windows[index];
}

/**
 * Generate a random time within a window, rounded to 5-minute increments
 */
function randomTimeInWindow(window: TimeWindow): string {
  const startMinutes = Math.floor(window.start * 60);
  const endMinutes = Math.floor(window.end * 60);
  const rangeMinutes = endMinutes - startMinutes;

  // Random time within window
  const totalMinutes = startMinutes + Math.floor(Math.random() * rangeMinutes);

  // Round to 5-minute increments
  const roundedMinutes = Math.round(totalMinutes / 5) * 5;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Generate Facebook and Instagram times for a given day
 */
function generateTimesForDay(dayOfWeek: number): { facebookTime: string; instagramTime: string } {
  const igWindows = INSTAGRAM_WINDOWS[dayOfWeek];
  const fbWindows = FACEBOOK_WINDOWS[dayOfWeek];

  const igWindow = pickRandomWindow(igWindows);
  const fbWindow = pickRandomWindow(fbWindows);

  const instagramTime = randomTimeInWindow(igWindow);
  const facebookTime = randomTimeInWindow(fbWindow);

  return { facebookTime, instagramTime };
}

/**
 * Get the day of week name
 */
function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Get all dates in a range
 */
function getDatesInRange(startDate: string, endDate: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Select optimal days for posting based on engagement patterns
 */
function selectOptimalDays(
  availableDates: Date[],
  postsPerWeek: number,
  existingPostDates: Set<string>
): Date[] {
  // Filter out dates that already have posts
  const filteredDates = availableDates.filter(
    (date) => !existingPostDates.has(formatDate(date))
  );

  if (filteredDates.length === 0) {
    return [];
  }

  // Group dates by week
  const weekMap = new Map<string, Date[]>();
  filteredDates.forEach((date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = formatDate(weekStart);

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(date);
  });

  // Select posts from each week
  const selectedDates: Date[] = [];

  weekMap.forEach((datesInWeek) => {
    // Sort by priority (best days first)
    const sortedDates = [...datesInWeek].sort((a, b) => {
      const priorityA = DAY_PRIORITY[a.getDay()];
      const priorityB = DAY_PRIORITY[b.getDay()];
      return priorityA - priorityB;
    });

    // If postsPerWeek <= 4, skip Monday (index 6 in priority)
    let datesToConsider = sortedDates;
    if (postsPerWeek <= 4) {
      datesToConsider = sortedDates.filter((d) => d.getDay() !== 1); // Skip Monday
    }

    // Select up to postsPerWeek dates
    const selected = datesToConsider.slice(0, postsPerWeek);

    // Sort selected by date order
    selected.sort((a, b) => a.getTime() - b.getTime());

    selectedDates.push(...selected);
  });

  // Sort all selected dates
  selectedDates.sort((a, b) => a.getTime() - b.getTime());

  return selectedDates;
}

/**
 * Generate a complete posting schedule
 */
export function generateSchedule(options: ScheduleOptions): ScheduledPost[] {
  const { startDate, endDate, postsPerWeek, existingPostDates = new Set() } = options;

  // Get all dates in range
  const allDates = getDatesInRange(startDate, endDate);

  // Select optimal days
  const selectedDates = selectOptimalDays(allDates, postsPerWeek, existingPostDates);

  // Generate schedule with times
  const schedule: ScheduledPost[] = selectedDates.map((date) => {
    const { facebookTime, instagramTime } = generateTimesForDay(date.getDay());

    return {
      date: formatDate(date),
      dayOfWeek: getDayName(date),
      facebookTime,
      instagramTime,
    };
  });

  return schedule;
}

/**
 * Calculate the number of weeks in a date range
 */
export function getWeeksInRange(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(days / 7);
}

/**
 * Get recommended posts per week based on date range
 */
export function getRecommendedPostsPerWeek(_startDate: string, _endDate: string): number {
  return 7; // Default to daily posts
}

/**
 * Validate a date range
 */
export function validateDateRange(
  startDate: string,
  endDate: string
): { valid: boolean; error?: string } {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Please select both start and end dates' };
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return { valid: false, error: 'Start date cannot be in the past' };
  }

  if (end < start) {
    return { valid: false, error: 'End date must be after start date' };
  }

  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (days > 90) {
    return { valid: false, error: 'Date range cannot exceed 90 days' };
  }

  return { valid: true };
}

/**
 * Format time for display (12-hour format)
 */
export function formatTimeForDisplay(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Generate a single time for a specific platform and day
 */
export function generateTimeForPlatform(
  platform: 'facebook' | 'instagram',
  dayOfWeek: number
): string {
  const windows = platform === 'instagram'
    ? INSTAGRAM_WINDOWS[dayOfWeek]
    : FACEBOOK_WINDOWS[dayOfWeek];

  const window = pickRandomWindow(windows);
  return randomTimeInWindow(window);
}
