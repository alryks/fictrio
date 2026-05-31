import { DEFAULT_OPEN_LIBRARY_DELAY_MS, getRequiredEnv } from './common';
import { HttpClient } from './http';

export interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  ratings_average?: number;
  ratings_count?: number;
  cover_i?: number;
  number_of_pages_median?: number;
}

export interface OpenLibrarySearchResponse {
  numFound?: number;
  num_found?: number;
  docs?: OpenLibrarySearchDoc[];
}

export interface OpenLibraryWorkDetails {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
}

export function createOpenLibraryClient(): HttpClient {
  const userAgent = getRequiredEnv('OPEN_LIBRARY_USER_AGENT');
  const delayMs = Number(
    process.env.OPEN_LIBRARY_REQUEST_DELAY_MS ?? DEFAULT_OPEN_LIBRARY_DELAY_MS,
  );

  return new HttpClient('https://openlibrary.org/', delayMs, {
    'User-Agent': userAgent,
  });
}

export function openLibraryCoverUrl(
  coverId: number | null | undefined,
): string | null {
  return coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : null;
}

export function openLibraryDescription(
  description: OpenLibraryWorkDetails['description'],
): string | null {
  if (!description) {
    return null;
  }

  if (typeof description === 'string') {
    return description;
  }

  return description.value ?? null;
}
