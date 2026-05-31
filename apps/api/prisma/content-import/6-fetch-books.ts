import { loadImportEnv, truncate } from './common';
import { writeCsv } from './csv';
import { getOutputArg, readTopCandidates } from './details';
import {
  createOpenLibraryClient,
  openLibraryCoverUrl,
  openLibraryDescription,
  type OpenLibrarySearchResponse,
  type OpenLibraryWorkDetails,
} from './open-library';

async function main(): Promise<void> {
  loadImportEnv();

  const candidates = await readTopCandidates('book_candidates.csv');
  const output = getOutputArg(4, 'books.csv');
  const client = createOpenLibraryClient();
  const rows: Record<string, string | number | null>[] = [];

  for (const candidate of candidates) {
    const search = await client.getJson<OpenLibrarySearchResponse>(
      'search.json',
      {
        q: `key:${candidate.id}`,
        fields:
          'key,title,author_name,first_publish_year,cover_i,number_of_pages_median',
        limit: 1,
        lang: 'ru',
      },
    );
    const doc =
      search.docs?.find((item) => item.key === candidate.id) ??
      search.docs?.[0];
    const work = await client.getJson<OpenLibraryWorkDetails>(
      `${candidate.id}.json`,
    );
    const title = doc?.title ?? work.title ?? candidate.id;

    rows.push({
      openlibrary_work_key: candidate.id.replace('/works/', ''),
      title: truncate(title, 255),
      original_title: truncate(work.title ?? title, 255),
      description: openLibraryDescription(work.description),
      release_year: doc?.first_publish_year ?? null,
      image_url: openLibraryCoverUrl(doc?.cover_i ?? work.covers?.[0]),
      first_publish_year: doc?.first_publish_year ?? null,
      author_names: (doc?.author_name ?? []).join(', ') || null,
      pages: doc?.number_of_pages_median ?? null,
    });
  }

  await writeCsv(
    output,
    [
      'openlibrary_work_key',
      'title',
      'original_title',
      'description',
      'release_year',
      'image_url',
      'first_publish_year',
      'author_names',
      'pages',
    ],
    rows,
  );
}

void main();
