/**
 * CSV Parser for The Social Studio
 *
 * Parses CSV files for bulk post import.
 * Expected columns: date, starterText, imageUrl
 */

export interface ParsedCSVRow {
  date?: string;
  starterText: string;
  imageUrl?: string;
  rowNumber: number;
  errors: string[];
}

export interface CSVParseResult {
  rows: ParsedCSVRow[];
  errors: string[];
  hasDateColumn: boolean;
}

/**
 * Parse a CSV string into rows
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
        // Escaped quote
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // End of cell
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // End of row
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++; // Skip \n in \r\n
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

/**
 * Normalize column header names
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Validate a date string (YYYY-MM-DD)
 */
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
}

/**
 * Validate a URL string
 */
function isValidUrl(urlStr: string): boolean {
  try {
    new URL(urlStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): CSVParseResult {
  const errors: string[] = [];
  const rows: ParsedCSVRow[] = [];

  // Parse CSV string
  const parsedRows = parseCSVString(content);

  if (parsedRows.length === 0) {
    errors.push('CSV file is empty');
    return { rows: [], errors, hasDateColumn: false };
  }

  // Get headers
  const headers = parsedRows[0].map(normalizeHeader);

  // Find column indices
  const dateIndex = headers.findIndex((h) =>
    ['date', 'postdate', 'scheduleddate'].includes(h)
  );
  const textIndex = headers.findIndex((h) =>
    ['startertext', 'text', 'content', 'caption', 'description'].includes(h)
  );
  const imageIndex = headers.findIndex((h) =>
    ['imageurl', 'image', 'url', 'mediaurl', 'photo'].includes(h)
  );

  const hasDateColumn = dateIndex !== -1;

  if (textIndex === -1) {
    errors.push(
      'CSV must have a text column (starterText, text, content, caption, or description)'
    );
    return { rows: [], errors, hasDateColumn };
  }

  // Parse data rows
  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    const rowNumber = i + 1; // 1-based for user display
    const rowErrors: string[] = [];

    // Get values
    const starterText = textIndex !== -1 ? row[textIndex] || '' : '';
    const dateValue = dateIndex !== -1 ? row[dateIndex] || '' : undefined;
    const imageUrl = imageIndex !== -1 ? row[imageIndex] || '' : undefined;

    // Validate
    if (!starterText) {
      rowErrors.push('Missing text content');
    }

    let parsedDate: string | undefined;
    if (dateValue) {
      // Try to parse date in various formats
      let normalizedDate = dateValue;

      // Handle MM/DD/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
        const [month, day, year] = dateValue.split('/');
        normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      // Handle MM-DD-YYYY format
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateValue)) {
        const [month, day, year] = dateValue.split('-');
        normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      if (isValidDate(normalizedDate)) {
        parsedDate = normalizedDate;
      } else {
        rowErrors.push(`Invalid date format: ${dateValue}`);
      }
    }

    let parsedImageUrl: string | undefined;
    if (imageUrl) {
      if (isValidUrl(imageUrl)) {
        parsedImageUrl = imageUrl;
      } else {
        rowErrors.push(`Invalid image URL: ${imageUrl}`);
      }
    }

    // Add row if it has content
    if (starterText || parsedDate || parsedImageUrl) {
      rows.push({
        date: parsedDate,
        starterText,
        imageUrl: parsedImageUrl,
        rowNumber,
        errors: rowErrors,
      });
    }
  }

  if (rows.length === 0) {
    errors.push('No valid rows found in CSV');
  }

  return { rows, errors, hasDateColumn };
}

/**
 * Read a file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Validate CSV file before parsing
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'File must be a CSV file' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }

  return { valid: true };
}
