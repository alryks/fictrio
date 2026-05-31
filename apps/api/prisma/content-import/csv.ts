import { readFile, writeFile } from 'node:fs/promises';
import { ensureOutputDir, type CsvRow, type CsvValue } from './common';

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      row.push(current);

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);

    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

export async function writeCsv(
  path: string,
  columns: string[],
  rows: CsvRow[],
): Promise<void> {
  await ensureOutputDir(path);

  const header = columns.map(escapeCsvValue).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column])).join(','),
  );

  await writeFile(path, `${[header, ...body].join('\n')}\n`, 'utf8');
}

export async function readCsv(path: string): Promise<Record<string, string>[]> {
  const content = await readFile(path, 'utf8');
  const [headers, ...dataRows] = parseCsv(content);

  if (!headers) {
    return [];
  }

  return dataRows.map((values) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

export function asNullableString(value: string | undefined): string | null {
  return value ? value : null;
}

export function asNullableNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
