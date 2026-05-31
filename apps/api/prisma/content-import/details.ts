import {
  getArg,
  imageUrl,
  joinNames,
  toIsoDate,
  toOutputPath,
  toYear,
  truncate,
} from './common';
import { readCsv } from './csv';
import type {
  TmdbCredit,
  TmdbEpisodeSummary,
  TmdbMovieDetails,
  TmdbSeasonDetails,
  TmdbShowDetails,
} from './tmdb';

export interface SelectedCandidate {
  id: string;
  score: number;
}

export async function readTopCandidates(
  defaultInput: string,
): Promise<SelectedCandidate[]> {
  const target = Number(getArg(2, 'N'));
  const input = toOutputPath(process.argv[3] ?? defaultInput);

  if (!Number.isInteger(target) || target <= 0) {
    throw new Error('N must be a positive integer');
  }

  const rows = await readCsv(input);

  return rows
    .map((row) => ({ id: row.id ?? '', score: Number(row.score) }))
    .filter((row) => row.id && Number.isFinite(row.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, target);
}

export function getOutputArg(index: number, defaultPath: string): string {
  return toOutputPath(process.argv[index] ?? defaultPath);
}

export function crewNames(
  credits: { crew?: TmdbCredit[] } | undefined,
  jobs: string[],
  limit = 8,
): string | null {
  return joinNames(
    (credits?.crew ?? [])
      .filter((credit) => credit.job && jobs.includes(credit.job))
      .map((credit) => credit.name ?? '')
      .slice(0, limit),
  );
}

export function castNames(
  credits: { cast?: { name?: string; order?: number }[] } | undefined,
  limit = 10,
): string | null {
  return joinNames(
    (credits?.cast ?? [])
      .toSorted(
        (left, right) => (left.order ?? 99_999) - (right.order ?? 99_999),
      )
      .map((credit) => credit.name ?? '')
      .slice(0, limit),
  );
}

export function movieRow(
  details: TmdbMovieDetails,
): Record<string, string | number | null> {
  const localized = {
    title: details.title ?? details.original_title ?? String(details.id),
    description: details.overview ?? null,
  };

  return {
    tmdb_id: details.id,
    title: truncate(localized.title, 255),
    original_title: truncate(
      details.original_title ?? details.title ?? String(details.id),
      255,
    ),
    description: localized.description,
    release_year: toYear(details.release_date),
    image_url: imageUrl(details.poster_path),
    runtime_minutes: details.runtime ?? null,
    director_names: crewNames(details.credits, ['Director']),
    actor_names: castNames(details.credits),
  };
}

export function showRow(
  details: TmdbShowDetails,
): Record<string, string | number | null> {
  return {
    tmdb_id: details.id,
    title: truncate(
      details.name ?? details.original_name ?? String(details.id),
      255,
    ),
    original_title: truncate(
      details.original_name ?? details.name ?? String(details.id),
      255,
    ),
    description: details.overview ?? null,
    release_year: toYear(details.first_air_date),
    image_url: imageUrl(details.poster_path),
    first_air_date: toIsoDate(details.first_air_date),
    last_air_date: toIsoDate(details.last_air_date),
    creator_names: joinNames(
      (details.created_by ?? []).map((creator) => creator.name ?? ''),
    ),
    actor_names: castNames(details.aggregate_credits),
  };
}

export function seasonRow(
  showTmdbId: number,
  season: TmdbSeasonDetails,
): Record<string, string | number | null> {
  return {
    tmdb_id: season.id,
    show_tmdb_id: showTmdbId,
    season_number: season.season_number,
    title: truncate(season.name ?? `Season ${season.season_number}`, 255),
    original_title: truncate(
      season.name ?? `Season ${season.season_number}`,
      255,
    ),
    description: season.overview ?? null,
    release_year: toYear(season.air_date),
    image_url: imageUrl(season.poster_path),
    air_date: toIsoDate(season.air_date),
  };
}

export function episodeRow(
  seasonTmdbId: number,
  episode: TmdbEpisodeSummary,
): Record<string, string | number | null> {
  return {
    tmdb_id: episode.id,
    season_tmdb_id: seasonTmdbId,
    episode_number: episode.episode_number,
    title: truncate(episode.name ?? `Episode ${episode.episode_number}`, 255),
    original_title: truncate(
      episode.name ?? `Episode ${episode.episode_number}`,
      255,
    ),
    description: episode.overview ?? null,
    release_year: toYear(episode.air_date),
    image_url: imageUrl(episode.still_path),
    air_date: toIsoDate(episode.air_date),
    runtime_minutes: episode.runtime ?? null,
    director_names: crewNames({ crew: episode.crew }, ['Director']),
    actor_names: joinNames(
      (episode.guest_stars ?? []).map((actor) => actor.name ?? '').slice(0, 10),
    ),
  };
}
