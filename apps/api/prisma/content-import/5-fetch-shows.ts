import { writeCsv } from './csv';
import { loadImportEnv } from './common';
import {
  episodeRow,
  getOutputArg,
  readTopCandidates,
  seasonRow,
  showRow,
} from './details';
import {
  createTmdbClient,
  pickTmdbLocalizedText,
  type TmdbSeasonDetails,
  type TmdbShowDetails,
} from './tmdb';

async function main(): Promise<void> {
  loadImportEnv();

  const candidates = await readTopCandidates('show_candidates.csv');
  const showsOutput = getOutputArg(4, 'shows.csv');
  const seasonsOutput = getOutputArg(5, 'seasons.csv');
  const episodesOutput = getOutputArg(6, 'episodes.csv');
  const client = createTmdbClient();
  const showRows: Record<string, string | number | null>[] = [];
  const seasonRows: Record<string, string | number | null>[] = [];
  const episodeRows: Record<string, string | number | null>[] = [];

  for (const candidate of candidates) {
    const show = await client.getJson<TmdbShowDetails>(`tv/${candidate.id}`, {
      append_to_response: 'aggregate_credits,translations',
      language: 'ru-RU',
    });
    const showLocalized = pickTmdbLocalizedText(
      show.name ?? show.original_name,
      show.overview,
      show.translations,
    );

    showRows.push({
      ...showRow({
        ...show,
        name: showLocalized.title ?? show.name,
        overview: showLocalized.description ?? show.overview,
      }),
    });

    for (const summary of show.seasons ?? []) {
      if (summary.season_number <= 0) {
        continue;
      }

      const season = await client.getJson<TmdbSeasonDetails>(
        `tv/${candidate.id}/season/${summary.season_number}`,
        {
          append_to_response: 'translations',
          language: 'ru-RU',
        },
      );
      const seasonLocalized = pickTmdbLocalizedText(
        season.name,
        season.overview,
        season.translations,
      );

      seasonRows.push(
        seasonRow(show.id, {
          ...season,
          name: seasonLocalized.title ?? season.name,
          overview: seasonLocalized.description ?? season.overview,
        }),
      );

      for (const episode of season.episodes ?? []) {
        episodeRows.push(episodeRow(season.id, episode));
      }
    }
  }

  await writeCsv(
    showsOutput,
    [
      'tmdb_id',
      'title',
      'original_title',
      'description',
      'release_year',
      'image_url',
      'external_rating_average',
      'external_rating_count',
      'first_air_date',
      'last_air_date',
      'creator_names',
      'actor_names',
    ],
    showRows,
  );
  await writeCsv(
    seasonsOutput,
    [
      'tmdb_id',
      'show_tmdb_id',
      'season_number',
      'title',
      'original_title',
      'description',
      'release_year',
      'image_url',
      'air_date',
    ],
    seasonRows,
  );
  await writeCsv(
    episodesOutput,
    [
      'tmdb_id',
      'season_tmdb_id',
      'episode_number',
      'title',
      'original_title',
      'description',
      'release_year',
      'image_url',
      'air_date',
      'runtime_minutes',
      'director_names',
      'actor_names',
    ],
    episodeRows,
  );
}

void main();
