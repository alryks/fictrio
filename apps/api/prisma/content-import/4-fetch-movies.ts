import { writeCsv } from './csv';
import { loadImportEnv } from './common';
import { getOutputArg, movieRow, readTopCandidates } from './details';
import {
  createTmdbClient,
  pickTmdbLocalizedText,
  type TmdbMovieDetails,
} from './tmdb';

async function main(): Promise<void> {
  loadImportEnv();

  const candidates = await readTopCandidates('movie_candidates.csv');
  const output = getOutputArg(4, 'movies.csv');
  const client = createTmdbClient();
  const rows: Record<string, string | number | null>[] = [];

  for (const candidate of candidates) {
    const details = await client.getJson<TmdbMovieDetails>(
      `movie/${candidate.id}`,
      {
        append_to_response: 'credits,translations',
        language: 'ru-RU',
      },
    );
    const localized = pickTmdbLocalizedText(
      details.title ?? details.original_title,
      details.overview,
      details.translations,
    );

    rows.push({
      ...movieRow({
        ...details,
        title: localized.title ?? details.title,
        overview: localized.description ?? details.overview,
      }),
    });
  }

  await writeCsv(
    output,
    [
      'tmdb_id',
      'title',
      'original_title',
      'description',
      'release_year',
      'image_url',
      'external_rating_average',
      'external_rating_count',
      'runtime_minutes',
      'director_names',
      'actor_names',
    ],
    rows,
  );
}

void main();
