import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';

export const DEFAULT_TMDB_DELAY_MS = 300;
export const DEFAULT_OPEN_LIBRARY_DELAY_MS = 1_100;
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvValue>;

export function loadImportEnv(): void {
  config({ path: 'infra/.env.dev' });
  config({ path: '../../infra/.env.dev' });
  config();
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function parsePositiveInt(
  value: string | undefined,
  name: string,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function getArg(index: number, name: string): string {
  const value = process.argv[index];

  if (!value) {
    throw new Error(`Usage error: ${name} is required`);
  }

  return value;
}

export function toOutputPath(path: string): string {
  return resolve(process.cwd(), path);
}

export async function ensureOutputDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function bayesianScore(
  voteCount: number,
  voteAverage: number,
  medianVoteCount: number,
  averageVote: number,
): number {
  if (voteCount + medianVoteCount === 0) {
    return 0;
  }

  return (
    (voteCount * voteAverage + medianVoteCount * averageVote) /
    (voteCount + medianVoteCount)
  );
}

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function toYear(value: string | null | undefined): number | null {
  const date = toIsoDate(value);

  if (!date) {
    return null;
  }

  return Number(date.slice(0, 4));
}

export function truncate(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function joinNames(names: string[]): string | null {
  const uniqueNames = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ];

  return uniqueNames.length > 0 ? uniqueNames.join(', ') : null;
}

export function imageUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_IMAGE_BASE_URL}${path}` : null;
}
