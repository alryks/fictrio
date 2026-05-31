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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

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
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);

  return values;
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
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  const [headerLine, ...dataLines] = lines;

  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine);

  return dataLines.map((line) => {
    const values = parseCsvLine(line);
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
