import { DEFAULT_TMDB_DELAY_MS, getRequiredEnv } from './common';
import { HttpClient } from './http';

export interface TmdbDiscoverItem {
  id: number;
  vote_average: number;
  vote_count: number;
}

export interface TmdbDiscoverResponse {
  page: number;
  results: TmdbDiscoverItem[];
  total_pages: number;
  total_results: number;
}

export interface TmdbCredit {
  name?: string;
  job?: string;
}

export interface TmdbCastCredit {
  name?: string;
  order?: number;
}

export interface TmdbCredits {
  cast?: TmdbCastCredit[];
  crew?: TmdbCredit[];
}

export interface TmdbTranslation {
  iso_639_1?: string;
  iso_3166_1?: string;
  data?: {
    title?: string;
    name?: string;
    overview?: string;
  };
}

export interface TmdbTranslations {
  translations?: TmdbTranslation[];
}

export interface TmdbMovieDetails {
  id: number;
  vote_average?: number;
  vote_count?: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  runtime?: number | null;
  credits?: TmdbCredits;
  translations?: TmdbTranslations;
}

export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  poster_path?: string | null;
}

export interface TmdbShowDetails {
  id: number;
  vote_average?: number;
  vote_count?: number;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string | null;
  last_air_date?: string | null;
  poster_path?: string | null;
  created_by?: { name?: string }[];
  aggregate_credits?: TmdbCredits;
  translations?: TmdbTranslations;
  seasons?: TmdbSeasonSummary[];
}

export interface TmdbEpisodeSummary {
  id: number;
  episode_number: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  crew?: TmdbCredit[];
  guest_stars?: TmdbCastCredit[];
}

export interface TmdbSeasonDetails {
  id: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  poster_path?: string | null;
  season_number: number;
  episodes?: TmdbEpisodeSummary[];
  translations?: TmdbTranslations;
}

export function createTmdbClient(): HttpClient {
  const token = getRequiredEnv('TMDB_API_KEY');
  const delayMs = Number(
    process.env.TMDB_REQUEST_DELAY_MS ?? DEFAULT_TMDB_DELAY_MS,
  );

  return new HttpClient('https://api.themoviedb.org/3/', delayMs, {
    Authorization: `Bearer ${token}`,
  });
}

export function pickTmdbLocalizedText(
  fallbackTitle: string | null | undefined,
  fallbackDescription: string | null | undefined,
  translations: TmdbTranslations | undefined,
): { title: string | null; description: string | null } {
  const allTranslations = translations?.translations ?? [];
  const preferred = ['ru', 'en'];

  for (const language of preferred) {
    const translation = allTranslations.find(
      (item) => item.iso_639_1 === language,
    );
    const title = translation?.data?.title || translation?.data?.name;
    const description = translation?.data?.overview;

    if (title || description) {
      return {
        title: title || fallbackTitle || null,
        description: description || fallbackDescription || null,
      };
    }
  }

  return {
    title: fallbackTitle || null,
    description: fallbackDescription || null,
  };
}
