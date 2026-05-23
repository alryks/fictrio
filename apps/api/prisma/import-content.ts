import {
  PrismaClient,
  type Prisma,
  RateableKind,
  WorkKind,
} from '@prisma/client';

const prisma = new PrismaClient();

const TMDB_API_BASE_URL =
  process.env.TMDB_API_BASE_URL ?? 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL =
  process.env.TMDB_IMAGE_BASE_URL ?? 'https://image.tmdb.org/t/p/w500';
const OPEN_LIBRARY_API_BASE_URL =
  process.env.OPEN_LIBRARY_API_BASE_URL ?? 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS_BASE_URL =
  process.env.OPEN_LIBRARY_COVERS_BASE_URL ?? 'https://covers.openlibrary.org';

const TMDB_LANGUAGE = process.env.TMDB_LANGUAGE ?? 'ru-RU';
const TMDB_FALLBACK_LANGUAGE = process.env.TMDB_FALLBACK_LANGUAGE ?? 'en-US';
const MOVIE_PAGES = readPositiveIntEnv('IMPORT_TMDB_MOVIE_PAGES', 2);
const SHOW_PAGES = readPositiveIntEnv('IMPORT_TMDB_SHOW_PAGES', 2);
const SEASONS_PER_SHOW = readPositiveIntEnv('IMPORT_TMDB_SEASONS_PER_SHOW', 1);
const BOOK_LIMIT = readPositiveIntEnv('IMPORT_OPEN_LIBRARY_BOOK_LIMIT', 50);
const BOOK_SUBJECT = process.env.IMPORT_OPEN_LIBRARY_SUBJECT ?? 'fiction';

type TmdbPage<T> = {
  results: T[];
};

type TmdbMovieListItem = {
  id: number;
};

type TmdbShowListItem = {
  id: number;
};

type TmdbCredit = {
  name?: string;
  job?: string;
  order?: number;
};

type TmdbMovieDetails = {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string;
  runtime?: number;
  credits?: {
    cast?: TmdbCredit[];
    crew?: TmdbCredit[];
  };
};

type TmdbShowDetails = {
  id: number;
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  last_air_date?: string;
  poster_path?: string;
  created_by?: TmdbCredit[];
  credits?: {
    cast?: TmdbCredit[];
  };
  seasons?: Array<{
    id: number;
    season_number: number;
    name?: string;
    overview?: string;
    air_date?: string;
    poster_path?: string;
  }>;
};

type TmdbSeasonDetails = {
  id: number;
  name?: string;
  overview?: string;
  air_date?: string;
  season_number: number;
  poster_path?: string;
  episodes?: Array<{
    id: number;
    name?: string;
    overview?: string;
    air_date?: string;
    episode_number: number;
    runtime?: number;
    still_path?: string;
    crew?: TmdbCredit[];
    guest_stars?: TmdbCredit[];
  }>;
};

type OpenLibrarySubjectResponse = {
  works?: OpenLibraryWork[];
};

type OpenLibraryWork = {
  key?: string;
  title?: string;
  first_publish_year?: number;
  cover_id?: number;
  authors?: Array<{ name?: string }>;
  subject?: string[];
};

type ImportStats = {
  movies: number;
  shows: number;
  seasons: number;
  episodes: number;
  books: number;
};

function readPositiveIntEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function truncate(value: string, length: number): string {
  return value.length > length ? value.slice(0, length) : value;
}

function parseYear(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const year = Number.parseInt(value.slice(0, 4), 10);

  return Number.isFinite(year) ? year : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function imageUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_IMAGE_BASE_URL}${path}` : null;
}

function coverUrl(coverId: number | null | undefined): string | null {
  return coverId
    ? `${OPEN_LIBRARY_COVERS_BASE_URL}/b/id/${coverId}-L.jpg`
    : null;
}

function uniqNames(
  names: Array<string | null | undefined>,
  limit: number,
): string | null {
  const unique = [
    ...new Set(
      names.map((name) => normalizeText(name)).filter(Boolean) as string[],
    ),
  ];

  return unique.length > 0 ? unique.slice(0, limit).join(', ') : null;
}

function castNames(cast: TmdbCredit[] | undefined): string | null {
  return uniqNames(
    [...(cast ?? [])]
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((item) => item.name),
    8,
  );
}

function directorNames(crew: TmdbCredit[] | undefined): string | null {
  return uniqNames(
    (crew ?? [])
      .filter((item) => item.job === 'Director')
      .map((item) => item.name),
    5,
  );
}

function tmdbRequestUrl(
  path: string,
  params: Record<string, string | number> = {},
): URL {
  const token = getRequiredEnv('TMDB_API_KEY');
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  if (!token.includes('.')) {
    url.searchParams.set('api_key', token);
  }

  return url;
}

async function fetchJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Request failed: ${response.status} ${response.statusText} ${url.toString()} ${body}`,
    );
  }

  return (await response.json()) as T;
}

async function fetchTmdb<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const token = getRequiredEnv('TMDB_API_KEY');
  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  if (token.includes('.')) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetchJson<T>(tmdbRequestUrl(path, params), { headers });
}

async function fetchTmdbWithFallback<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const primary = await fetchTmdb<T>(path, {
    language: TMDB_LANGUAGE,
    ...params,
  });

  if (TMDB_LANGUAGE === TMDB_FALLBACK_LANGUAGE) {
    return primary;
  }

  return primary;
}

async function createOrUpdateWork(input: {
  subtypeExists: () => Promise<boolean>;
  kind: WorkKind;
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  releaseYear?: number | null;
  imageUrl?: string | null;
  workData: (tx: Prisma.TransactionClient, workId: string) => Promise<void>;
  content?: boolean;
}): Promise<boolean> {
  if (await input.subtypeExists()) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    const rateable = await tx.rateable.create({
      data: {
        kind: RateableKind.work,
      },
    });

    const work = await tx.work.create({
      data: {
        rateableId: rateable.id,
        kind: input.kind,
        title: truncate(input.title, 255),
        originalTitle: input.originalTitle
          ? truncate(input.originalTitle, 255)
          : null,
        description: input.description,
        releaseYear: input.releaseYear,
        imageUrl: input.imageUrl,
      },
    });

    if (input.content) {
      await tx.content.create({
        data: {
          workId: work.id,
        },
      });
    }

    await input.workData(tx, work.id);
  });

  return true;
}

async function importMovie(tmdbId: number): Promise<boolean> {
  const details = await fetchTmdbWithFallback<TmdbMovieDetails>(
    `/movie/${tmdbId}`,
    {
      append_to_response: 'credits',
    },
  );

  const title =
    normalizeText(details.title) ?? normalizeText(details.original_title);

  if (!title) {
    return false;
  }

  return createOrUpdateWork({
    subtypeExists: async () =>
      Boolean(await prisma.movie.findUnique({ where: { tmdbId: details.id } })),
    kind: WorkKind.movie,
    title,
    originalTitle: normalizeText(details.original_title),
    description: normalizeText(details.overview),
    releaseYear: parseYear(details.release_date),
    imageUrl: imageUrl(details.poster_path),
    content: true,
    workData: async (tx, workId) => {
      await tx.movie.create({
        data: {
          workId,
          tmdbId: details.id,
          runtimeMinutes: details.runtime ?? null,
          directorNames: directorNames(details.credits?.crew),
          actorNames: castNames(details.credits?.cast),
        },
      });
    },
  });
}

async function importShow(
  tmdbId: number,
): Promise<Pick<ImportStats, 'shows' | 'seasons' | 'episodes'>> {
  const details = await fetchTmdbWithFallback<TmdbShowDetails>(
    `/tv/${tmdbId}`,
    {
      append_to_response: 'credits',
    },
  );

  const title =
    normalizeText(details.name) ?? normalizeText(details.original_name);

  if (!title) {
    return { shows: 0, seasons: 0, episodes: 0 };
  }

  let showWorkId = (
    await prisma.show.findUnique({ where: { tmdbId: details.id } })
  )?.workId;
  let shows = 0;

  if (!showWorkId) {
    await prisma.$transaction(async (tx) => {
      const rateable = await tx.rateable.create({
        data: {
          kind: RateableKind.work,
        },
      });

      const work = await tx.work.create({
        data: {
          rateableId: rateable.id,
          kind: WorkKind.show,
          title: truncate(title, 255),
          originalTitle: normalizeText(details.original_name),
          description: normalizeText(details.overview),
          releaseYear: parseYear(details.first_air_date),
          imageUrl: imageUrl(details.poster_path),
        },
      });

      await tx.show.create({
        data: {
          workId: work.id,
          tmdbId: details.id,
          firstAirDate: parseDate(details.first_air_date),
          lastAirDate: parseDate(details.last_air_date),
          creatorNames: uniqNames(
            (details.created_by ?? []).map((item) => item.name),
            5,
          ),
          actorNames: castNames(details.credits?.cast),
        },
      });

      showWorkId = work.id;
      shows = 1;
    });
  }

  if (!showWorkId) {
    throw new Error(`Show ${details.id} was not created`);
  }

  let seasons = 0;
  let episodes = 0;
  const regularSeasons = (details.seasons ?? [])
    .filter((season) => season.season_number > 0)
    .slice(0, SEASONS_PER_SHOW);

  for (const season of regularSeasons) {
    const imported = await importSeason(
      details.id,
      showWorkId,
      season.season_number,
    );
    seasons += imported.seasons;
    episodes += imported.episodes;
  }

  return { shows, seasons, episodes };
}

async function importSeason(
  showTmdbId: number,
  showWorkId: string,
  seasonNumber: number,
): Promise<Pick<ImportStats, 'seasons' | 'episodes'>> {
  const details = await fetchTmdbWithFallback<TmdbSeasonDetails>(
    `/tv/${showTmdbId}/season/${seasonNumber}`,
  );

  let seasonWorkId = (
    await prisma.season.findUnique({ where: { tmdbId: details.id } })
  )?.workId;
  let seasons = 0;

  if (!seasonWorkId) {
    await prisma.$transaction(async (tx) => {
      const rateable = await tx.rateable.create({
        data: {
          kind: RateableKind.work,
        },
      });

      const work = await tx.work.create({
        data: {
          rateableId: rateable.id,
          kind: WorkKind.season,
          title: truncate(
            normalizeText(details.name) ?? `Сезон ${details.season_number}`,
            255,
          ),
          originalTitle: normalizeText(details.name),
          description: normalizeText(details.overview),
          releaseYear: parseYear(details.air_date),
          imageUrl: imageUrl(details.poster_path),
        },
      });

      await tx.season.create({
        data: {
          workId: work.id,
          showWorkId,
          tmdbId: details.id,
          seasonNumber: details.season_number,
          airDate: parseDate(details.air_date),
        },
      });

      seasonWorkId = work.id;
      seasons = 1;
    });
  }

  if (!seasonWorkId) {
    throw new Error(`Season ${details.id} was not created`);
  }

  const persistedSeasonWorkId = seasonWorkId;
  let episodes = 0;

  for (const episode of details.episodes ?? []) {
    const exists = await prisma.episode.findUnique({
      where: { tmdbId: episode.id },
    });

    if (exists) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const rateable = await tx.rateable.create({
        data: {
          kind: RateableKind.work,
        },
      });

      const work = await tx.work.create({
        data: {
          rateableId: rateable.id,
          kind: WorkKind.episode,
          title: truncate(
            normalizeText(episode.name) ?? `Эпизод ${episode.episode_number}`,
            255,
          ),
          originalTitle: normalizeText(episode.name),
          description: normalizeText(episode.overview),
          releaseYear: parseYear(episode.air_date),
          imageUrl: imageUrl(episode.still_path),
        },
      });

      await tx.content.create({
        data: {
          workId: work.id,
        },
      });

      await tx.episode.create({
        data: {
          workId: work.id,
          seasonWorkId: persistedSeasonWorkId,
          tmdbId: episode.id,
          episodeNumber: episode.episode_number,
          airDate: parseDate(episode.air_date),
          runtimeMinutes: episode.runtime ?? null,
          directorNames: directorNames(episode.crew),
          actorNames: castNames(episode.guest_stars),
        },
      });
    });

    episodes += 1;
  }

  return { seasons, episodes };
}

async function importMovies(): Promise<number> {
  let imported = 0;

  for (let page = 1; page <= MOVIE_PAGES; page += 1) {
    const data = await fetchTmdb<TmdbPage<TmdbMovieListItem>>(
      '/movie/popular',
      {
        language: TMDB_LANGUAGE,
        page,
      },
    );

    for (const movie of data.results) {
      imported += (await importMovie(movie.id)) ? 1 : 0;
    }
  }

  return imported;
}

async function importShows(): Promise<
  Pick<ImportStats, 'shows' | 'seasons' | 'episodes'>
> {
  const stats = { shows: 0, seasons: 0, episodes: 0 };

  for (let page = 1; page <= SHOW_PAGES; page += 1) {
    const data = await fetchTmdb<TmdbPage<TmdbShowListItem>>('/tv/popular', {
      language: TMDB_LANGUAGE,
      page,
    });

    for (const show of data.results) {
      const imported = await importShow(show.id);
      stats.shows += imported.shows;
      stats.seasons += imported.seasons;
      stats.episodes += imported.episodes;
    }
  }

  return stats;
}

async function importBooks(): Promise<number> {
  const url = new URL(
    `${OPEN_LIBRARY_API_BASE_URL}/subjects/${BOOK_SUBJECT}.json`,
  );
  url.searchParams.set('limit', String(BOOK_LIMIT));

  const data = await fetchJson<OpenLibrarySubjectResponse>(url);
  let imported = 0;

  for (const book of data.works ?? []) {
    const key = normalizeText(book.key);
    const title = normalizeText(book.title);

    if (!key || !title) {
      continue;
    }

    const openlibraryWorkKey = truncate(key.replace('/works/', ''), 32);
    const exists = await prisma.book.findUnique({
      where: { openlibraryWorkKey },
    });

    if (exists) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const rateable = await tx.rateable.create({
        data: {
          kind: RateableKind.work,
        },
      });

      const work = await tx.work.create({
        data: {
          rateableId: rateable.id,
          kind: WorkKind.book,
          title: truncate(title, 255),
          originalTitle: null,
          description: book.subject?.slice(0, 8).join(', ') ?? null,
          releaseYear: book.first_publish_year ?? null,
          imageUrl: coverUrl(book.cover_id),
        },
      });

      await tx.content.create({
        data: {
          workId: work.id,
        },
      });

      await tx.book.create({
        data: {
          workId: work.id,
          openlibraryWorkKey,
          firstPublishYear: book.first_publish_year ?? null,
          authorNames: uniqNames(
            (book.authors ?? []).map((author) => author.name),
            8,
          ),
        },
      });
    });

    imported += 1;
  }

  return imported;
}

async function main(): Promise<void> {
  const stats: ImportStats = {
    movies: 0,
    shows: 0,
    seasons: 0,
    episodes: 0,
    books: 0,
  };

  stats.movies = await importMovies();

  const showStats = await importShows();
  stats.shows = showStats.shows;
  stats.seasons = showStats.seasons;
  stats.episodes = showStats.episodes;

  stats.books = await importBooks();

  console.log(
    `Imported content: movies=${stats.movies}, shows=${stats.shows}, seasons=${stats.seasons}, episodes=${stats.episodes}, books=${stats.books}`,
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
