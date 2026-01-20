/**
 * CSV Scheduling Algorithm
 *
 * Assigns dates to CSV rows while respecting anchor dates.
 * Rows are processed in CSV order, with anchored dates taking priority.
 *
 * Platform Rules:
 * - One IG post per day, one FB post per day
 * - A CSV row creates BOTH IG and FB for that date
 * - A date is only available if BOTH platforms are unoccupied
 */

export interface CSVRow {
  rowIndex: number;
  rawDate: string;
  starterText: string;
  imageUrl: string;
  anchoredDate?: string;
  finalDate?: string;
  error?: string;
}

export interface OccupiedDates {
  instagram: Set<string>;
  facebook: Set<string>;
}

export interface RowIssue {
  rowIndex: number;
  problem: string;
  suggestedFix: string;
  isBlocking: boolean;
}

export interface SchedulingResult {
  scheduledRows: CSVRow[];
  unscheduledRows: CSVRow[];
  issues: RowIssue[];
  blockingErrors: string[];
  suggestions: string[];
  summary: {
    scheduled: number;
    unscheduled: number;
    blocked: number;
    totalRows: number;
  };
  canProceed: boolean;
}

/**
 * Parse a date string to YYYY-MM-DD format
 * Supports: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY
 */
export function normalizeDateString(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }

  const trimmed = dateStr.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      return trimmed;
    }
    return null;
  }

  // MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('/');
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(normalized + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      return normalized;
    }
    return null;
  }

  // MM-DD-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split('-');
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(normalized + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      return normalized;
    }
    return null;
  }

  return null;
}

/**
 * Generate all dates in a range (inclusive)
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a date is available for import (both IG and FB must be unoccupied)
 */
function isDateAvailable(date: string, occupiedDates: OccupiedDates): boolean {
  return !occupiedDates.instagram.has(date) && !occupiedDates.facebook.has(date);
}

/**
 * Get which platforms are occupied on a date
 */
function getOccupiedPlatforms(date: string, occupiedDates: OccupiedDates): string[] {
  const platforms: string[] = [];
  if (occupiedDates.instagram.has(date)) platforms.push('Instagram');
  if (occupiedDates.facebook.has(date)) platforms.push('Facebook');
  return platforms;
}

/**
 * Assign dates to rows with anchor support and platform collision detection
 */
export function assignDatesWithAnchors(
  rows: CSVRow[],
  rangeDates: string[],
  occupiedDates: OccupiedDates
): SchedulingResult {
  const rangeDateSet = new Set(rangeDates);
  const issues: RowIssue[] = [];
  const blockingErrors: string[] = [];
  const suggestions: string[] = [];

  // Step 1: Parse and validate date formats
  const processedRows: CSVRow[] = rows.map((row) => {
    const newRow = { ...row };
    if (row.rawDate && row.rawDate.trim()) {
      const normalized = normalizeDateString(row.rawDate);
      if (normalized) {
        newRow.anchoredDate = normalized;
      } else {
        newRow.error = `Invalid date format: "${row.rawDate}"`;
        issues.push({
          rowIndex: row.rowIndex,
          problem: `Invalid date format: "${row.rawDate}"`,
          suggestedFix: 'Use YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY format',
          isBlocking: true,
        });
      }
    }
    return newRow;
  });

  // Step 2: Check for duplicate anchor dates in CSV
  const anchoredDates = new Map<string, number[]>();
  for (const row of processedRows) {
    if (row.anchoredDate && !row.error) {
      const existing = anchoredDates.get(row.anchoredDate) || [];
      existing.push(row.rowIndex);
      anchoredDates.set(row.anchoredDate, existing);
    }
  }

  for (const [date, rowIndices] of anchoredDates) {
    if (rowIndices.length > 1) {
      const rowList = rowIndices.join(' and ');
      blockingErrors.push(`Duplicate date in CSV: ${date} is used on rows ${rowList}`);
      suggestions.push(`Remove duplicate dates or change one of them`);

      // Mark all but first as errors
      for (let i = 1; i < rowIndices.length; i++) {
        const row = processedRows.find(r => r.rowIndex === rowIndices[i]);
        if (row) {
          row.error = `Duplicate anchor date ${date} (also on row ${rowIndices[0]})`;
          issues.push({
            rowIndex: rowIndices[i],
            problem: `Duplicate date ${date} (same as row ${rowIndices[0]})`,
            suggestedFix: `Change this row's date or remove the date from row ${rowIndices[0]}`,
            isBlocking: true,
          });
        }
      }
    }
  }

  // Step 3: Check anchored dates are within range and not occupied
  for (const row of processedRows) {
    if (row.anchoredDate && !row.error) {
      // Check if in range
      if (!rangeDateSet.has(row.anchoredDate)) {
        row.error = `Anchored date ${row.anchoredDate} is outside the selected range`;
        blockingErrors.push(`Row ${row.rowIndex}: ${row.anchoredDate} is outside the selected date range`);
        suggestions.push(`Expand the date range to include ${row.anchoredDate}, or change the date for row ${row.rowIndex}`);
        issues.push({
          rowIndex: row.rowIndex,
          problem: `Date ${row.anchoredDate} is outside selected range`,
          suggestedFix: `Expand date range to include this date, or pick a different date`,
          isBlocking: true,
        });
        continue;
      }

      // Check if date is already occupied
      const occupiedPlatforms = getOccupiedPlatforms(row.anchoredDate, occupiedDates);
      if (occupiedPlatforms.length > 0) {
        const platformList = occupiedPlatforms.join(' and ');
        row.error = `${row.anchoredDate} already has ${platformList} post(s)`;
        blockingErrors.push(`Row ${row.rowIndex}: ${row.anchoredDate} already has ${platformList} post(s)`);
        suggestions.push(`Pick a different date for row ${row.rowIndex} because ${row.anchoredDate} already has a post`);
        issues.push({
          rowIndex: row.rowIndex,
          problem: `${row.anchoredDate} already has ${platformList} post(s)`,
          suggestedFix: `Choose a different date that doesn't have existing posts`,
          isBlocking: true,
        });
      }
    }
  }

  // Step 4: Calculate available dates (in range, both platforms unoccupied)
  const availableDates = rangeDates.filter((d) => isDateAvailable(d, occupiedDates));

  // Step 5: Check capacity
  const rowsNeedingDates = processedRows.filter(r => !r.error).length;
  const anchoredRowCount = processedRows.filter(r => r.anchoredDate && !r.error).length;
  const rowsNeedingAutoAssign = rowsNeedingDates - anchoredRowCount;

  // Available dates minus anchored dates
  const anchoredDatesSet = new Set(
    processedRows.filter(r => r.anchoredDate && !r.error).map(r => r.anchoredDate!)
  );
  const availableForAutoAssign = availableDates.filter(d => !anchoredDatesSet.has(d));

  if (rowsNeedingAutoAssign > availableForAutoAssign.length) {
    const shortage = rowsNeedingAutoAssign - availableForAutoAssign.length;
    const neededDays = rangeDates.length + shortage;
    blockingErrors.push(
      `Not enough available dates: need ${rowsNeedingAutoAssign} dates for auto-assignment, but only ${availableForAutoAssign.length} available`
    );
    suggestions.push(`Increase the selected date range to at least ${neededDays} days`);
  }

  // If there are blocking errors, return early
  if (blockingErrors.length > 0) {
    const blockedCount = processedRows.filter(r => r.error).length;
    return {
      scheduledRows: [],
      unscheduledRows: processedRows,
      issues,
      blockingErrors,
      suggestions,
      summary: {
        scheduled: 0,
        unscheduled: processedRows.length - blockedCount,
        blocked: blockedCount,
        totalRows: processedRows.length,
      },
      canProceed: false,
    };
  }

  // Step 6: Assign dates in row order
  const usedDates = new Set<string>();
  const scheduledRows: CSVRow[] = [];
  const unscheduledRows: CSVRow[] = [];

  // Mark anchored dates as used
  for (const row of processedRows) {
    if (row.anchoredDate && !row.error) {
      usedDates.add(row.anchoredDate);
    }
  }

  for (let i = 0; i < processedRows.length; i++) {
    const row = processedRows[i];

    // Skip rows with errors
    if (row.error) {
      unscheduledRows.push(row);
      continue;
    }

    // If row has an anchor, use it
    if (row.anchoredDate) {
      row.finalDate = row.anchoredDate;
      scheduledRows.push(row);
      continue;
    }

    // Row has no anchor - find next anchor below
    let nextAnchorDate: string | null = null;
    for (let j = i + 1; j < processedRows.length; j++) {
      const anchor = processedRows[j].anchoredDate;
      if (anchor && !processedRows[j].error) {
        nextAnchorDate = anchor;
        break;
      }
    }

    // Find earliest available date that satisfies constraints
    let assignedDate: string | null = null;

    for (const date of availableDates) {
      // Skip if already used (by anchor or previous auto-assign)
      if (usedDates.has(date)) {
        continue;
      }

      // If there's a next anchor, date must be strictly before it
      if (nextAnchorDate && date >= nextAnchorDate) {
        continue;
      }

      // This date works
      assignedDate = date;
      break;
    }

    if (assignedDate) {
      row.finalDate = assignedDate;
      usedDates.add(assignedDate);
      scheduledRows.push(row);
    } else {
      const reason = nextAnchorDate
        ? `No available date before anchor ${nextAnchorDate}`
        : 'No dates left in range';
      row.error = reason;
      issues.push({
        rowIndex: row.rowIndex,
        problem: reason,
        suggestedFix: nextAnchorDate
          ? `Add more dates before ${nextAnchorDate} or remove the anchor`
          : `Expand the date range`,
        isBlocking: false,
      });
      unscheduledRows.push(row);
    }
  }

  const blockedCount = issues.filter(i => i.isBlocking).length;

  return {
    scheduledRows,
    unscheduledRows,
    issues,
    blockingErrors: [],
    suggestions: unscheduledRows.length > 0
      ? [`${unscheduledRows.length} row(s) could not be scheduled - expand the date range`]
      : [],
    summary: {
      scheduled: scheduledRows.length,
      unscheduled: unscheduledRows.length,
      blocked: blockedCount,
      totalRows: processedRows.length,
    },
    canProceed: scheduledRows.length > 0,
  };
}

/**
 * Parse CSV content into row objects
 */
export function parseCSVToRows(content: string): {
  rows: CSVRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: CSVRow[] = [];

  // Parse CSV string
  const lines = parseCSVString(content);

  if (lines.length === 0) {
    errors.push('CSV file is empty');
    return { rows: [], errors };
  }

  // Normalize headers
  const headers = lines[0].map((h) => h.toLowerCase().trim());

  // Find required column indices
  const dateIndex = headers.findIndex((h) =>
    ['date', 'postdate', 'scheduleddate'].includes(h)
  );
  const textIndex = headers.findIndex((h) =>
    ['startertext', 'text', 'content', 'caption', 'description'].includes(h)
  );
  const imageIndex = headers.findIndex((h) =>
    ['imageurl', 'image', 'url', 'mediaurl', 'photo'].includes(h)
  );

  // Validate required headers
  if (dateIndex === -1) {
    errors.push('CSV must have a "date" column');
  }
  if (textIndex === -1) {
    errors.push('CSV must have a text column (starterText, text, content, caption, or description)');
  }
  if (imageIndex === -1) {
    errors.push('CSV must have an image column (imageUrl, image, url, mediaUrl, or photo)');
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowIndex = i + 1; // 1-based for user display

    // Skip empty rows
    if (line.every((cell) => !cell.trim())) {
      continue;
    }

    const rawDate = dateIndex !== -1 ? (line[dateIndex] || '').trim() : '';
    const starterText = textIndex !== -1 ? (line[textIndex] || '').trim() : '';
    const imageUrl = imageIndex !== -1 ? (line[imageIndex] || '').trim() : '';

    // Require at least starterText
    if (!starterText) {
      errors.push(`Row ${rowIndex}: missing text content`);
      continue;
    }

    rows.push({
      rowIndex,
      rawDate,
      starterText,
      imageUrl,
    });
  }

  return { rows, errors };
}

/**
 * Parse CSV string into 2D array (handles quotes, commas, newlines)
 */
function parseCSVString(csvString: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }

  // Handle last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}
