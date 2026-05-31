import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  ListVisibility,
  ModerationActionKind,
  Prisma,
  PrismaClient,
  ProgressStatus,
  RateableKind,
  WorkKind,
} from '@prisma/client';
import { hash } from 'argon2';
import { getDatabaseUrl } from '../src/config/database-url';
import { loadImportEnv } from './content-import/common';
import { asNullableNumber, readCsv } from './content-import/csv';

type ActivityType =
  | 'inactive'
  | 'observer'
  | 'rater'
  | 'reviewer'
  | 'collector'
  | 'social'
  | 'power_user'
  | 'moderator';

type FavoriteKind = 'movie' | 'show' | 'book' | 'mixed';

type SeedConfig = {
  seed: string;
  baseNow: Date;
  userCount: number;
  targetRatingsCount: number;
  targetPostsCount: number;
  targetListsCount: number;
  targetListItemsCount: number;
  targetFollowsCount: number;
  targetProgressCount: number;
  targetModerationActionsCount: number;
};

type SeedUser = {
  id: string;
  index: number;
  username: string;
  displayName: string;
  email: string;
  activityType: ActivityType;
  favoriteKind: FavoriteKind;
  ratingBias: number;
  createdAt: Date;
  updatedAt: Date;
  ratingCount: number;
  reviewWeight: number;
  listCount: number;
  followCount: number;
  progressCount: number;
  influence: number;
};

type ExternalStats = {
  average: number | null;
  count: number;
  scale: number;
};

type WorkSeedItem = {
  id: string;
  rateableId: string;
  kind: WorkKind;
  title: string;
  popularityWeight: number;
  externalAverageNormalized: number;
  externalRatingCount: number;
  valueMax: number | null;
};

type RatingSeed = Prisma.RatingCreateManyInput & {
  workId: string;
  workKind: WorkKind;
  workTitle: string;
  createdAt: Date;
};

type ReviewSeed = Prisma.PostCreateManyInput & {
  id: string;
  authorUserId: string;
  rateableId: string;
  ratingValue: number;
  createdAt: Date;
};

type ListSeed = Prisma.ListCreateManyInput & {
  id: string;
  ownerUserId: string;
  createdAt: Date;
  desiredSize: number;
};

type TargetRef = {
  id: string;
  kind: 'post' | 'list';
  createdAt: Date;
};

type VerificationRow = {
  check_name: string;
  failures: bigint;
};

type CountRow = {
  count: bigint;
};

type TopWorkRow = {
  title: string;
  kind: WorkKind;
  count: bigint;
};

type TopUserRow = {
  username: string;
  displayName: string;
  count: bigint;
};

type WorkForSeed = Prisma.WorkGetPayload<{
  include: {
    movie: true;
    show: true;
    season: {
      include: {
        show: true;
      };
    };
    episode: {
      include: {
        season: {
          include: {
            show: true;
          };
        };
      };
    };
    book: true;
  };
}>;

const DEFAULT_CONFIG: SeedConfig = {
  seed: 'fictrio-social-seed-v1',
  baseNow: new Date('2026-05-31T12:00:00.000Z'),
  userCount: 1_200,
  targetRatingsCount: 50_000,
  targetPostsCount: 10_000,
  targetListsCount: 3_000,
  targetListItemsCount: 30_000,
  targetFollowsCount: 12_000,
  targetProgressCount: 25_000,
  targetModerationActionsCount: 1_200,
};

const ACTIVITY_WEIGHTS: Record<
  ActivityType,
  {
    rating: number;
    review: number;
    list: number;
    follow: number;
    progress: number;
    influence: number;
  }
> = {
  inactive: {
    rating: 0.03,
    review: 0.01,
    list: 0.01,
    follow: 0.03,
    progress: 0.04,
    influence: 0.2,
  },
  observer: {
    rating: 0.12,
    review: 0.02,
    list: 0.04,
    follow: 0.15,
    progress: 1.3,
    influence: 0.5,
  },
  rater: {
    rating: 1.4,
    review: 0.18,
    list: 0.16,
    follow: 0.55,
    progress: 0.8,
    influence: 1.0,
  },
  reviewer: {
    rating: 1.6,
    review: 1.8,
    list: 0.35,
    follow: 0.8,
    progress: 0.8,
    influence: 2.0,
  },
  collector: {
    rating: 0.8,
    review: 0.25,
    list: 2.8,
    follow: 0.8,
    progress: 0.7,
    influence: 1.6,
  },
  social: {
    rating: 0.7,
    review: 0.55,
    list: 0.5,
    follow: 4.5,
    progress: 0.7,
    influence: 2.2,
  },
  power_user: {
    rating: 4.5,
    review: 3.4,
    list: 3.5,
    follow: 8.5,
    progress: 2.8,
    influence: 5.0,
  },
  moderator: {
    rating: 1.0,
    review: 0.8,
    list: 0.7,
    follow: 1.5,
    progress: 0.9,
    influence: 2.4,
  },
};

const REVIEW_TEXTS: Record<number, string[]> = {
  0: [
    'Не сработало почти ни на одном уровне: темп проседает, конфликт выглядит надуманным, а финал оставляет равнодушным.',
    'Ожидал большего. Есть отдельные удачные детали, но в целом история кажется переоцененной и слишком затянутой.',
    'Сложно рекомендовать: атмосфера не спасает слабые персонажи и рваный ритм повествования.',
  ],
  1: [
    'Смешанные впечатления: местами интересно, но темп часто провисает и не все линии получают убедительное развитие.',
    'Есть сильные моменты и хорошая работа в своем жанре, но общее впечатление портят затянутые сцены.',
    'Неплохо под настроение, хотя ожидал большего. Понравились отдельные персонажи, но пересматривать вряд ли захочу.',
  ],
  2: [
    'Хорошая работа в своем жанре: понравилась атмосфера, персонажи и спокойное развитие истории.',
    'Затянуто в нескольких местах, но в целом интересно. После финала осталось приятное впечатление.',
    'Крепкая история с понятными эмоциями. Не без шероховатостей, но хочется советовать тем, кто любит такой тон.',
  ],
  3: [
    'Очень сильное впечатление. Атмосфера, темп и персонажи складываются в историю, к которой хочется вернуться.',
    'Отлично под настроение и при этом не пусто: много живых деталей, хороший ритм и запоминающийся финал.',
    'Для меня это почти идеальное попадание. Недооцененная вещь, которую хочется обсуждать и пересматривать.',
  ],
};

const COMMENT_TEXTS = [
  'Согласен, особенно про атмосферу.',
  'У меня похожее впечатление, но финал зашел сильнее.',
  'Интересный взгляд, надо будет пересмотреть.',
  'А мне как раз темп показался удачным.',
  'Да, персонажи здесь действительно многое вытягивают.',
  'Не полностью согласен, но аргумент понятный.',
  'Тоже ожидал большего после отзывов.',
  'Хорошо сформулировано, теперь хочется добавить в список.',
  'Мне кажется, это лучше работает под конкретное настроение.',
  'Вторая половина, на мой взгляд, заметно сильнее первой.',
];

const LIST_TITLES = [
  'Любимое',
  'Хочу посмотреть',
  'Книги на лето',
  'Лучшие фильмы года',
  'Сериалы на выходные',
  'Недооцененное',
  'Для пересмотра',
  'Мрачная атмосфера',
  'Комфортные истории',
  'Топ по настроению',
  'После тяжелого дня',
  'То, что советую друзьям',
  'Медленные, но сильные истории',
  'Когда хочется подумать',
  'На длинные выходные',
];

const MODERATION_REASONS = [
  'спам',
  'оскорбления',
  'дублирующийся пользовательский контент',
  'нарушение правил обсуждения',
  'скрыто до уточнения контекста',
  'восстановлено после проверки',
];

class Rng {
  private state: number;

  constructor(seed: string) {
    const digest = createHash('sha256').update(seed).digest();
    this.state = digest.readUInt32LE(0) || 1;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(probability: number): boolean {
    return this.next() < probability;
  }

  normal(mean = 0, deviation = 1): number {
    const left = Math.max(this.next(), Number.EPSILON);
    const right = Math.max(this.next(), Number.EPSILON);
    const z = Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);

    return mean + z * deviation;
  }

  item<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot choose from an empty array');
    }

    const value = items[this.int(0, items.length - 1)];

    if (value === undefined) {
      throw new Error('Random index is out of bounds');
    }

    return value;
  }
}

class WeightedSampler<T> {
  private readonly items: T[];
  private readonly cumulative: number[];
  private readonly total: number;

  constructor(items: readonly T[], weightOf: (item: T) => number) {
    this.items = [...items];
    this.cumulative = [];
    let total = 0;

    for (const item of this.items) {
      total += Math.max(weightOf(item), 0.000_001);
      this.cumulative.push(total);
    }

    this.total = total;
  }

  pick(rng: Rng): T {
    if (this.items.length === 0) {
      throw new Error('Cannot choose from an empty weighted sampler');
    }

    const target = rng.next() * this.total;
    let low = 0;
    let high = this.cumulative.length - 1;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const value = this.cumulative[middle] ?? 0;

      if (value < target) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    const item = this.items[low];

    if (item === undefined) {
      throw new Error('Weighted sampler index is out of bounds');
    }

    return item;
  }
}

function parseConfig(): SeedConfig {
  const values = new Map<string, string>();

  for (const arg of process.argv.slice(2)) {
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    const match = /^--([^=]+)=(.+)$/.exec(arg);

    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    values.set(match[1] ?? '', match[2] ?? '');
  }

  return {
    seed: values.get('seed') ?? DEFAULT_CONFIG.seed,
    baseNow: new Date(values.get('now') ?? DEFAULT_CONFIG.baseNow),
    userCount: getConfigInt(values, 'users', DEFAULT_CONFIG.userCount),
    targetRatingsCount: getConfigInt(
      values,
      'ratings',
      DEFAULT_CONFIG.targetRatingsCount,
    ),
    targetPostsCount: getConfigInt(
      values,
      'posts',
      DEFAULT_CONFIG.targetPostsCount,
    ),
    targetListsCount: getConfigInt(
      values,
      'lists',
      DEFAULT_CONFIG.targetListsCount,
    ),
    targetListItemsCount: getConfigInt(
      values,
      'list-items',
      DEFAULT_CONFIG.targetListItemsCount,
    ),
    targetFollowsCount: getConfigInt(
      values,
      'follows',
      DEFAULT_CONFIG.targetFollowsCount,
    ),
    targetProgressCount: getConfigInt(
      values,
      'progress',
      DEFAULT_CONFIG.targetProgressCount,
    ),
    targetModerationActionsCount: getConfigInt(
      values,
      'moderation-actions',
      DEFAULT_CONFIG.targetModerationActionsCount,
    ),
  };
}

function printHelp(): void {
  console.log(`Usage: bun apps/api/prisma/social-seed.ts [options]

Options:
  --seed=value                 deterministic seed string
  --now=ISO_DATE               base timestamp for generated data
  --users=1200                 seed users count
  --ratings=50000              target ratings count
  --posts=10000                target reviews + comments count
  --lists=3000                 target lists count
  --list-items=30000           target list items count
  --follows=12000              target follows count
  --progress=25000             target progress count, completed ratings may raise it
  --moderation-actions=1200    target moderation actions count`);
}

function getConfigInt(
  values: ReadonlyMap<string, string>,
  key: string,
  fallback: number,
): number {
  const value = values.get(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${key} must be a non-negative integer`);
  }

  return parsed;
}

function uuidFrom(seed: string, key: string): string {
  const bytes = Buffer.from(
    createHash('sha256').update(`${seed}:${key}`).digest().subarray(0, 16),
  );

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function randomDateBetween(rng: Rng, start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const value = startMs + Math.floor(rng.next() * Math.max(endMs - startMs, 1));

  return new Date(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toActivityTypes(userCount: number): ActivityType[] {
  const base: Array<{ type: ActivityType; share: number }> = [
    { type: 'inactive', share: 0.25 },
    { type: 'observer', share: 0.2 },
    { type: 'rater', share: 0.25 },
    { type: 'reviewer', share: 0.1 },
    { type: 'collector', share: 0.1 },
    { type: 'social', share: 0.07 },
    { type: 'power_user', share: 0.02 },
  ];
  const moderatorCount = Math.max(10, Math.round(userCount * 0.01));
  const regularCount = Math.max(userCount - moderatorCount, 0);
  const result: ActivityType[] = [];

  for (const item of base) {
    const count = Math.round(regularCount * item.share);
    for (let index = 0; index < count; index += 1) {
      result.push(item.type);
    }
  }

  while (result.length < regularCount) {
    result.push('rater');
  }

  while (result.length > regularCount) {
    result.pop();
  }

  for (let index = 0; index < moderatorCount; index += 1) {
    result.push('moderator');
  }

  return result;
}

function createUsers(config: SeedConfig, rng: Rng): SeedUser[] {
  const activityTypes = toActivityTypes(config.userCount);
  const start = addDays(config.baseNow, -90);
  const favoriteKinds: FavoriteKind[] = ['movie', 'show', 'book', 'mixed'];
  const names = [
    'Алексей',
    'Мария',
    'Никита',
    'Анна',
    'Илья',
    'Софья',
    'Даниил',
    'Вера',
    'Кирилл',
    'Полина',
    'Егор',
    'Алина',
    'Роман',
    'Дарья',
    'Максим',
    'Ева',
  ];

  const users = activityTypes.map((activityType, index) => {
    const number = String(index + 1).padStart(4, '0');
    const createdAt = randomDateBetween(
      rng,
      start,
      addDays(config.baseNow, -1),
    );
    const updatedAt = randomDateBetween(rng, createdAt, config.baseNow);
    const favoriteKind =
      activityType === 'collector' || activityType === 'power_user'
        ? 'mixed'
        : rng.item(favoriteKinds);
    const firstName = rng.item(names);

    return {
      id: uuidFrom(config.seed, `user:${number}`),
      index,
      username: `seed_user_${number}`,
      displayName: `${firstName} ${number}`,
      email: `seed_user_${number}@fictrio.local`,
      activityType,
      favoriteKind,
      ratingBias: clamp(rng.normal(0, 0.38), -0.75, 0.75),
      createdAt,
      updatedAt,
      ratingCount: 0,
      reviewWeight: 0,
      listCount: 0,
      followCount: 0,
      progressCount: 0,
      influence: ACTIVITY_WEIGHTS[activityType].influence,
    };
  });

  assignCounts(
    users,
    config.targetRatingsCount,
    (user) => ACTIVITY_WEIGHTS[user.activityType].rating,
    rng,
    (user, value) => {
      user.ratingCount = value;
    },
  );
  assignCounts(
    users,
    config.targetListsCount,
    (user) => ACTIVITY_WEIGHTS[user.activityType].list,
    rng,
    (user, value) => {
      user.listCount = value;
    },
  );
  assignCounts(
    users,
    config.targetFollowsCount,
    (user) => ACTIVITY_WEIGHTS[user.activityType].follow,
    rng,
    (user, value) => {
      user.followCount = value;
    },
  );
  assignCounts(
    users,
    config.targetProgressCount,
    (user) => ACTIVITY_WEIGHTS[user.activityType].progress,
    rng,
    (user, value) => {
      user.progressCount = value;
    },
  );

  for (const user of users) {
    user.reviewWeight =
      ACTIVITY_WEIGHTS[user.activityType].review * (0.65 + rng.next() * 0.7);
  }

  return users;
}

function assignCounts(
  users: SeedUser[],
  target: number,
  weightOf: (user: SeedUser) => number,
  rng: Rng,
  assign: (user: SeedUser, value: number) => void,
): void {
  const rawWeights = users.map((user) => {
    const heavyTail = Math.exp(rng.normal(0, 0.65));

    return Math.max(weightOf(user), 0) * heavyTail;
  });
  const total = rawWeights.reduce((sum, value) => sum + value, 0);
  const parts = rawWeights.map((weight, index) => {
    const exact = total > 0 ? (target * weight) / total : 0;

    return {
      index,
      whole: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });
  let assigned = parts.reduce((sum, part) => sum + part.whole, 0);

  parts.sort((left, right) => right.fraction - left.fraction);

  for (const part of parts) {
    if (assigned >= target) {
      break;
    }

    part.whole += 1;
    assigned += 1;
  }

  parts.sort((left, right) => left.index - right.index);

  for (const part of parts) {
    const user = users[part.index];

    if (!user) {
      throw new Error('User count allocation failed');
    }

    assign(user, part.whole);
  }
}

async function loadExternalStats(): Promise<{
  movies: Map<number, ExternalStats>;
  shows: Map<number, ExternalStats>;
  books: Map<string, ExternalStats>;
}> {
  const movies = new Map<number, ExternalStats>();
  const shows = new Map<number, ExternalStats>();
  const books = new Map<string, ExternalStats>();

  for (const row of await readCsv(resolve(process.cwd(), 'data/movies.csv'))) {
    movies.set(Number(row.tmdb_id), toExternalStats(row, 10));
  }

  for (const row of await readCsv(resolve(process.cwd(), 'data/shows.csv'))) {
    shows.set(Number(row.tmdb_id), toExternalStats(row, 10));
  }

  for (const row of await readCsv(resolve(process.cwd(), 'data/books.csv'))) {
    const key = row.openlibrary_work_key;

    if (key) {
      books.set(key, toExternalStats(row, 5));
    }
  }

  return { movies, shows, books };
}

function toExternalStats(
  row: Record<string, string>,
  scale: number,
): ExternalStats {
  return {
    average: asNullableNumber(row.external_rating_average),
    count: Math.max(
      Math.trunc(asNullableNumber(row.external_rating_count) ?? 0),
      0,
    ),
    scale,
  };
}

async function loadWorks(
  prisma: PrismaClient,
  config: SeedConfig,
): Promise<WorkSeedItem[]> {
  const external = await loadExternalStats();
  const works = await prisma.work.findMany({
    include: {
      movie: true,
      show: true,
      season: {
        include: {
          show: true,
        },
      },
      episode: {
        include: {
          season: {
            include: {
              show: true,
            },
          },
        },
      },
      book: true,
    },
    orderBy: [{ kind: 'asc' }, { title: 'asc' }, { id: 'asc' }],
  });

  if (works.length === 0) {
    throw new Error(
      'Catalog is empty. Import movies/shows/books before social seed.',
    );
  }

  return works.map((work) => toWorkSeedItem(work, external, config.seed));
}

function toWorkSeedItem(
  work: WorkForSeed,
  external: Awaited<ReturnType<typeof loadExternalStats>>,
  seed: string,
): WorkSeedItem {
  const stats = getWorkExternalStats(work, external);
  const averageNormalized =
    stats.average === null ? 0.62 : clamp(stats.average / stats.scale, 0, 1);
  const fallbackHash = createHash('sha256')
    .update(`${seed}:${work.id}`)
    .digest()
    .readUInt32LE(0);
  const fallbackCount = 5 + (fallbackHash % 80);
  const count = stats.count > 0 ? stats.count : fallbackCount;
  const popularityWeight = Math.log1p(count) * (0.45 + averageNormalized);

  return {
    id: work.id,
    rateableId: work.rateableId,
    kind: work.kind,
    title: work.title,
    popularityWeight,
    externalAverageNormalized: averageNormalized,
    externalRatingCount: count,
    valueMax: getWorkValueMax(work),
  };
}

function getWorkExternalStats(
  work: WorkForSeed,
  external: Awaited<ReturnType<typeof loadExternalStats>>,
): ExternalStats {
  if (work.movie) {
    return (
      external.movies.get(work.movie.tmdbId) ?? {
        average: null,
        count: 0,
        scale: 10,
      }
    );
  }

  if (work.show) {
    return (
      external.shows.get(work.show.tmdbId) ?? {
        average: null,
        count: 0,
        scale: 10,
      }
    );
  }

  if (work.season) {
    const showStats = external.shows.get(work.season.show.tmdbId);

    return showStats
      ? { ...showStats, count: Math.max(Math.round(showStats.count * 0.35), 1) }
      : { average: null, count: 0, scale: 10 };
  }

  if (work.episode) {
    const showStats = external.shows.get(work.episode.season.show.tmdbId);

    return showStats
      ? { ...showStats, count: Math.max(Math.round(showStats.count * 0.12), 1) }
      : { average: null, count: 0, scale: 10 };
  }

  if (work.book) {
    return (
      external.books.get(work.book.openlibraryWorkKey) ?? {
        average: null,
        count: 0,
        scale: 5,
      }
    );
  }

  return { average: null, count: 0, scale: 10 };
}

function getWorkValueMax(work: WorkForSeed): number | null {
  if (work.movie) {
    return work.movie.runtimeMinutes ?? 100;
  }

  if (work.episode) {
    return work.episode.runtimeMinutes ?? 45;
  }

  if (work.book) {
    return work.book.pages ?? 320;
  }

  return null;
}

function buildWorkSamplers(works: WorkSeedItem[]): {
  all: WeightedSampler<WorkSeedItem>;
  byKind: Map<WorkKind, WeightedSampler<WorkSeedItem>>;
  listsByKind: Map<WorkKind, WorkSeedItem[]>;
  contents: WorkSeedItem[];
} {
  const byKind = new Map<WorkKind, WeightedSampler<WorkSeedItem>>();
  const listsByKind = new Map<WorkKind, WorkSeedItem[]>();
  const kinds = [
    WorkKind.movie,
    WorkKind.show,
    WorkKind.season,
    WorkKind.episode,
    WorkKind.book,
  ];

  for (const kind of kinds) {
    const items = works.filter((work) => work.kind === kind);

    if (items.length > 0) {
      byKind.set(
        kind,
        new WeightedSampler(items, (work) => work.popularityWeight),
      );
      listsByKind.set(kind, items);
    }
  }

  return {
    all: new WeightedSampler(works, (work) => work.popularityWeight),
    byKind,
    listsByKind,
    contents: works.filter((work) => isContentKind(work.kind)),
  };
}

function chooseWork(
  user: SeedUser,
  samplers: ReturnType<typeof buildWorkSamplers>,
  rng: Rng,
  exploratory: boolean,
): WorkSeedItem {
  const kind = choosePreferredKind(user, rng);
  const uniformPool = samplers.listsByKind.get(kind);

  if (exploratory && uniformPool && uniformPool.length > 0) {
    return rng.item(uniformPool);
  }

  return samplers.byKind.get(kind)?.pick(rng) ?? samplers.all.pick(rng);
}

function choosePreferredKind(user: SeedUser, rng: Rng): WorkKind {
  const roll = rng.next();

  if (user.favoriteKind === 'movie') {
    if (roll < 0.72) return WorkKind.movie;
    if (roll < 0.84) return WorkKind.show;
    if (roll < 0.91) return WorkKind.episode;
    return WorkKind.book;
  }

  if (user.favoriteKind === 'show') {
    if (roll < 0.36) return WorkKind.show;
    if (roll < 0.73) return WorkKind.episode;
    if (roll < 0.84) return WorkKind.season;
    if (roll < 0.94) return WorkKind.movie;
    return WorkKind.book;
  }

  if (user.favoriteKind === 'book') {
    if (roll < 0.78) return WorkKind.book;
    if (roll < 0.9) return WorkKind.movie;
    return WorkKind.show;
  }

  if (roll < 0.3) return WorkKind.movie;
  if (roll < 0.52) return WorkKind.show;
  if (roll < 0.68) return WorkKind.episode;
  if (roll < 0.75) return WorkKind.season;
  return WorkKind.book;
}

function generateRatings(
  config: SeedConfig,
  users: SeedUser[],
  works: WorkSeedItem[],
  rng: Rng,
): RatingSeed[] {
  const samplers = buildWorkSamplers(works);
  const ratings: RatingSeed[] = [];

  for (const user of users) {
    const rated = new Set<string>();
    let attempts = 0;

    while (rated.size < user.ratingCount && attempts < user.ratingCount * 20) {
      attempts += 1;
      const exploratory =
        user.activityType === 'collector' || user.activityType === 'power_user'
          ? rng.bool(0.33)
          : rng.bool(0.08);
      const work = chooseWork(user, samplers, rng, exploratory);

      if (rated.has(work.rateableId)) {
        continue;
      }

      rated.add(work.rateableId);
      const createdAt = randomDateBetween(
        rng,
        addMinutes(user.createdAt, 30),
        config.baseNow,
      );
      const value = clamp(
        Math.round(
          work.externalAverageNormalized * 3 +
            user.ratingBias +
            rng.normal(0, 0.72),
        ),
        0,
        3,
      );

      ratings.push({
        id: uuidFrom(config.seed, `rating:${user.id}:${work.rateableId}`),
        userId: user.id,
        rateableId: work.rateableId,
        value,
        createdAt,
        updatedAt: randomDateBetween(rng, createdAt, config.baseNow),
        workId: work.id,
        workKind: work.kind,
        workTitle: work.title,
      });
    }
  }

  return ratings.slice(0, config.targetRatingsCount);
}

function generateReviews(
  config: SeedConfig,
  users: SeedUser[],
  ratings: RatingSeed[],
  rng: Rng,
): ReviewSeed[] {
  const userById = new Map(users.map((user) => [user.id, user]));
  const targetReviews = Math.min(
    Math.round(config.targetPostsCount * 0.58),
    ratings.length,
  );
  const candidates = ratings.map((rating) => {
    const user = userById.get(rating.userId);
    const userWeight = user?.reviewWeight ?? 0.1;
    const valueWeight = 0.75 + rating.value * 0.2;

    return {
      rating,
      score: userWeight * valueWeight * (0.75 + rng.next() * 0.7),
    };
  });

  candidates.sort((left, right) => right.score - left.score);

  return candidates.slice(0, targetReviews).map(({ rating }) => {
    const createdAt = randomDateBetween(
      rng,
      addMinutes(rating.createdAt, 20),
      config.baseNow,
    );

    return {
      id: uuidFrom(config.seed, `review:${rating.userId}:${rating.rateableId}`),
      authorUserId: rating.userId,
      rateableId: rating.rateableId,
      parentPostId: null,
      body: makeReviewText(rating.value, rating.workTitle, rng),
      isHidden: false,
      createdAt,
      updatedAt: randomDateBetween(rng, createdAt, config.baseNow),
      ratingValue: rating.value,
    };
  });
}

function makeReviewText(value: number, title: string, rng: Rng): string {
  const template = rng.item(REVIEW_TEXTS[value] ?? REVIEW_TEXTS[2]);
  const extra = rng.bool(0.35)
    ? ` ${rng.item([
        'Особенно запомнились детали мира.',
        'После обсуждений в ленте воспринимается еще интереснее.',
        'Не уверен, что подойдет всем, но свою аудиторию точно найдет.',
        'В подборку по настроению добавил бы без сомнений.',
      ])}`
    : '';

  return `${template} «${title}» ${extra}`.trim();
}

function generateComments(
  config: SeedConfig,
  users: SeedUser[],
  reviews: ReviewSeed[],
  rng: Rng,
): Prisma.PostCreateManyInput[] {
  const targetComments = Math.max(config.targetPostsCount - reviews.length, 0);

  if (reviews.length === 0 || targetComments === 0) {
    return [];
  }

  const reviewSampler = new WeightedSampler(reviews, (review) => {
    const valueBoost = 0.8 + review.ratingValue * 0.25;

    return valueBoost * Math.exp(rng.normal(0, 0.5));
  });
  const userSampler = new WeightedSampler(users, (user) => {
    if (user.activityType === 'social') return 6;
    if (user.activityType === 'power_user') return 8;
    if (user.activityType === 'reviewer') return 2.5;
    if (user.activityType === 'moderator') return 2;
    if (user.activityType === 'inactive') return 0.05;
    return 1;
  });
  const comments: Prisma.PostCreateManyInput[] = [];
  const commentsByReview = new Map<string, number>();

  while (comments.length < targetComments) {
    const parent = reviewSampler.pick(rng);
    const currentCount = commentsByReview.get(parent.id) ?? 0;
    const cap =
      currentCount < 3
        ? 3
        : currentCount < 15 && rng.bool(0.18)
          ? 15
          : rng.bool(0.03)
            ? 40
            : 3;

    if (currentCount >= cap) {
      continue;
    }

    const author = userSampler.pick(rng);
    const createdAt = randomDateBetween(
      rng,
      addMinutes(parent.createdAt, 10),
      config.baseNow,
    );
    const commentNumber = currentCount + 1;

    commentsByReview.set(parent.id, commentNumber);
    comments.push({
      id: uuidFrom(
        config.seed,
        `comment:${parent.id}:${commentNumber}:${author.id}`,
      ),
      authorUserId: author.id,
      rateableId: null,
      parentPostId: parent.id,
      body: rng.item(COMMENT_TEXTS),
      isHidden: false,
      createdAt,
      updatedAt: randomDateBetween(rng, createdAt, config.baseNow),
    });
  }

  return comments;
}

function generateLists(
  config: SeedConfig,
  users: SeedUser[],
  rng: Rng,
): { rateables: Prisma.RateableCreateManyInput[]; lists: ListSeed[] } {
  const rateables: Prisma.RateableCreateManyInput[] = [];
  const lists: ListSeed[] = [];
  const sizes = buildListSizes(
    config.targetListItemsCount,
    config.targetListsCount,
    rng,
  );
  let listIndex = 0;

  for (const user of users) {
    for (let localIndex = 0; localIndex < user.listCount; localIndex += 1) {
      const id = uuidFrom(config.seed, `list:${user.id}:${localIndex}`);
      const rateableId = uuidFrom(config.seed, `list-rateable:${id}`);
      const createdAt = randomDateBetween(
        rng,
        addMinutes(user.createdAt, 60),
        config.baseNow,
      );
      const title = makeListTitle(user, localIndex, rng);
      const desiredSize = sizes[listIndex] ?? 5;
      listIndex += 1;

      rateables.push({
        id: rateableId,
        kind: RateableKind.list,
        createdAt,
      });
      lists.push({
        id,
        rateableId,
        ownerUserId: user.id,
        title,
        description: rng.bool(0.45)
          ? `Подборка ${title.toLowerCase()} от пользователя ${user.displayName}.`
          : null,
        visibility: chooseListVisibility(user, rng),
        isHidden: false,
        createdAt,
        updatedAt: randomDateBetween(rng, createdAt, config.baseNow),
        desiredSize,
      });
    }
  }

  return { rateables, lists: lists.slice(0, config.targetListsCount) };
}

function buildListSizes(
  targetItems: number,
  listCount: number,
  rng: Rng,
): number[] {
  const sizes: number[] = [];

  for (let index = 0; index < listCount; index += 1) {
    const roll = rng.next();

    if (roll < 0.76) {
      sizes.push(rng.int(3, 15));
    } else if (roll < 0.96) {
      sizes.push(rng.int(20, 50));
    } else {
      sizes.push(rng.int(80, 140));
    }
  }

  let total = sizes.reduce((sum, value) => sum + value, 0);

  while (total < targetItems) {
    const index = rng.int(0, Math.max(sizes.length - 1, 0));
    sizes[index] = (sizes[index] ?? 0) + 1;
    total += 1;
  }

  while (total > targetItems) {
    const index = rng.int(0, Math.max(sizes.length - 1, 0));
    const value = sizes[index] ?? 0;

    if (value <= 3) {
      continue;
    }

    sizes[index] = value - 1;
    total -= 1;
  }

  return sizes;
}

function makeListTitle(user: SeedUser, index: number, rng: Rng): string {
  const base = rng.item(LIST_TITLES);

  if (index === 0) {
    return base;
  }

  if (rng.bool(0.25)) {
    return `${base}: часть ${index + 1}`;
  }

  if (user.favoriteKind === 'book' && rng.bool(0.35)) {
    return `${base} — книги`;
  }

  if (user.favoriteKind === 'show' && rng.bool(0.35)) {
    return `${base} — сериалы`;
  }

  return `${base} ${index + 1}`;
}

function chooseListVisibility(user: SeedUser, rng: Rng): ListVisibility {
  const roll = rng.next();

  if (user.activityType === 'inactive') {
    if (roll < 0.5) return ListVisibility.private;
    if (roll < 0.7) return ListVisibility.friends;
    return ListVisibility.public;
  }

  if (roll < 0.72) return ListVisibility.public;
  if (roll < 0.9) return ListVisibility.friends;
  return ListVisibility.private;
}

function generateListItems(
  config: SeedConfig,
  users: SeedUser[],
  lists: ListSeed[],
  works: WorkSeedItem[],
  rng: Rng,
): Prisma.ListItemCreateManyInput[] {
  const userById = new Map(users.map((user) => [user.id, user]));
  const samplers = buildWorkSamplers(works);
  const items: Prisma.ListItemCreateManyInput[] = [];

  for (const list of lists) {
    const owner = userById.get(list.ownerUserId);

    if (!owner) {
      throw new Error(`List owner ${list.ownerUserId} is missing`);
    }

    const seenWorks = new Set<string>();

    while (seenWorks.size < list.desiredSize) {
      const work = chooseWork(
        owner,
        samplers,
        rng,
        owner.activityType === 'collector' || rng.bool(0.16),
      );

      if (seenWorks.has(work.id)) {
        continue;
      }

      seenWorks.add(work.id);
      items.push({
        listId: list.id,
        workId: work.id,
        position: seenWorks.size,
        addedAt: randomDateBetween(
          rng,
          addMinutes(list.createdAt, 5),
          config.baseNow,
        ),
      });
    }
  }

  return items.slice(0, config.targetListItemsCount);
}

function generateFollows(
  config: SeedConfig,
  users: SeedUser[],
  reviews: ReviewSeed[],
  lists: ListSeed[],
  rng: Rng,
): Prisma.FollowCreateManyInput[] {
  const reviewCountByUser = countBy(reviews, (review) => review.authorUserId);
  const listCountByUser = countBy(lists, (list) => list.ownerUserId);
  const userSampler = new WeightedSampler(users, (user) => {
    const reviewsCount = reviewCountByUser.get(user.id) ?? 0;
    const listsCount = listCountByUser.get(user.id) ?? 0;

    return user.influence + reviewsCount * 0.45 + listsCount * 0.25;
  });
  const follows: Prisma.FollowCreateManyInput[] = [];
  const followKeys = new Set<string>();

  for (const follower of users) {
    let createdForUser = 0;
    let attempts = 0;

    while (
      createdForUser < follower.followCount &&
      attempts < follower.followCount * 40
    ) {
      attempts += 1;
      const target = userSampler.pick(rng);

      if (target.id === follower.id) {
        continue;
      }

      const key = `${follower.id}:${target.id}`;

      if (followKeys.has(key)) {
        continue;
      }

      followKeys.add(key);
      createdForUser += 1;
      follows.push({
        followerUserId: follower.id,
        followedUserId: target.id,
        createdAt: randomDateBetween(
          rng,
          addMinutes(follower.createdAt, 30),
          config.baseNow,
        ),
      });
    }
  }

  while (follows.length < config.targetFollowsCount) {
    const follower = rng.item(users);
    const target = userSampler.pick(rng);

    if (target.id === follower.id) {
      continue;
    }

    const key = `${follower.id}:${target.id}`;

    if (followKeys.has(key)) {
      continue;
    }

    followKeys.add(key);
    follows.push({
      followerUserId: follower.id,
      followedUserId: target.id,
      createdAt: randomDateBetween(
        rng,
        addMinutes(follower.createdAt, 30),
        config.baseNow,
      ),
    });
  }

  return follows.slice(0, config.targetFollowsCount);
}

function generateProgress(
  config: SeedConfig,
  users: SeedUser[],
  works: WorkSeedItem[],
  ratings: RatingSeed[],
  rng: Rng,
): Prisma.ProgressCreateManyInput[] {
  const workByRateableId = new Map(
    works.map((work) => [work.rateableId, work]),
  );
  const contentWorks = works.filter((work) => isContentKind(work.kind));
  const contentSampler = new WeightedSampler(
    contentWorks,
    (work) => work.popularityWeight,
  );
  const progress: Prisma.ProgressCreateManyInput[] = [];
  const keys = new Set<string>();

  for (const rating of ratings) {
    const work = workByRateableId.get(rating.rateableId);

    if (!work || !isContentKind(work.kind)) {
      continue;
    }

    const key = `${rating.userId}:${work.id}`;

    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    const valueMax = work.valueMax ?? fallbackValueMax(work, rng);
    progress.push({
      id: uuidFrom(config.seed, `progress:${rating.userId}:${work.id}`),
      userId: rating.userId,
      contentWorkId: work.id,
      status: ProgressStatus.completed,
      valueNow: valueMax,
      valueMax,
      updatedAt: randomDateBetween(rng, rating.createdAt, config.baseNow),
    });
  }

  const userSampler = new WeightedSampler(users, (user) => {
    return (
      ACTIVITY_WEIGHTS[user.activityType].progress + user.progressCount / 10
    );
  });

  while (progress.length < config.targetProgressCount) {
    const user = userSampler.pick(rng);
    const work = rng.bool(0.16)
      ? rng.item(contentWorks)
      : contentSampler.pick(rng);
    const key = `${user.id}:${work.id}`;

    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    const valueMax = work.valueMax ?? fallbackValueMax(work, rng);
    const completed = rng.bool(user.activityType === 'observer' ? 0.35 : 0.62);
    const updatedAt = randomDateBetween(
      rng,
      addMinutes(user.createdAt, 40),
      config.baseNow,
    );

    progress.push({
      id: uuidFrom(config.seed, `progress:${user.id}:${work.id}`),
      userId: user.id,
      contentWorkId: work.id,
      status: completed ? ProgressStatus.completed : ProgressStatus.started,
      valueNow: completed ? valueMax : rng.int(1, Math.max(valueMax - 1, 1)),
      valueMax,
      updatedAt,
    });
  }

  return progress;
}

function fallbackValueMax(work: WorkSeedItem, rng: Rng): number {
  if (work.kind === WorkKind.book) {
    return rng.int(120, 900);
  }

  if (work.kind === WorkKind.movie) {
    return rng.int(80, 170);
  }

  return rng.int(24, 70);
}

function generateModerationActions(
  config: SeedConfig,
  users: SeedUser[],
  reviews: ReviewSeed[],
  comments: Prisma.PostCreateManyInput[],
  lists: ListSeed[],
  rng: Rng,
): {
  actions: Prisma.ModerationActionCreateManyInput[];
  hiddenPostIds: string[];
  visiblePostIds: string[];
  hiddenListIds: string[];
  visibleListIds: string[];
} {
  const moderators = users.filter((user) => user.activityType === 'moderator');
  const targets: TargetRef[] = [
    ...reviews.map((review) => ({
      id: review.id,
      kind: 'post' as const,
      createdAt: review.createdAt,
    })),
    ...comments.map((comment) => ({
      id: String(comment.id),
      kind: 'post' as const,
      createdAt: dateFromInput(comment.createdAt),
    })),
    ...lists.map((list) => ({
      id: list.id,
      kind: 'list' as const,
      createdAt: list.createdAt,
    })),
  ];

  if (moderators.length === 0 || targets.length === 0) {
    return {
      actions: [],
      hiddenPostIds: [],
      visiblePostIds: [],
      hiddenListIds: [],
      visibleListIds: [],
    };
  }

  const targetSampler = new WeightedSampler(targets, (target) =>
    target.kind === 'post' ? 1.4 : 1,
  );
  const actions: Prisma.ModerationActionCreateManyInput[] = [];
  const finalState = new Map<
    string,
    { kind: 'post' | 'list'; hidden: boolean }
  >();

  while (actions.length < config.targetModerationActionsCount) {
    const target = targetSampler.pick(rng);
    const moderator = rng.item(moderators);
    const hideAt = randomDateBetween(
      rng,
      addMinutes(target.createdAt, 30),
      config.baseNow,
    );
    const actionIndex = actions.length;

    actions.push({
      id: uuidFrom(config.seed, `moderation:${actionIndex}:hide:${target.id}`),
      moderatorUserId: moderator.id,
      action: ModerationActionKind.hide,
      targetPostId: target.kind === 'post' ? target.id : null,
      targetListId: target.kind === 'list' ? target.id : null,
      reason: rng.item(MODERATION_REASONS),
      createdAt: hideAt,
    });
    finalState.set(target.id, { kind: target.kind, hidden: true });

    if (
      actions.length < config.targetModerationActionsCount &&
      rng.bool(0.38)
    ) {
      const restoreAt = randomDateBetween(
        rng,
        addMinutes(hideAt, 20),
        config.baseNow,
      );
      const restoreIndex = actions.length;

      actions.push({
        id: uuidFrom(
          config.seed,
          `moderation:${restoreIndex}:restore:${target.id}`,
        ),
        moderatorUserId: moderator.id,
        action: ModerationActionKind.restore,
        targetPostId: target.kind === 'post' ? target.id : null,
        targetListId: target.kind === 'list' ? target.id : null,
        reason: 'восстановлено после проверки',
        createdAt: restoreAt,
      });
      finalState.set(target.id, { kind: target.kind, hidden: false });
    }
  }

  const hiddenPostIds: string[] = [];
  const visiblePostIds: string[] = [];
  const hiddenListIds: string[] = [];
  const visibleListIds: string[] = [];

  for (const [id, state] of finalState) {
    if (state.kind === 'post' && state.hidden) hiddenPostIds.push(id);
    if (state.kind === 'post' && !state.hidden) visiblePostIds.push(id);
    if (state.kind === 'list' && state.hidden) hiddenListIds.push(id);
    if (state.kind === 'list' && !state.hidden) visibleListIds.push(id);
  }

  return {
    actions: actions.slice(0, config.targetModerationActionsCount),
    hiddenPostIds,
    visiblePostIds,
    hiddenListIds,
    visibleListIds,
  };
}

function dateFromInput(value: string | Date | undefined): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    return new Date(value);
  }

  return DEFAULT_CONFIG.baseNow;
}

function isContentKind(kind: WorkKind): boolean {
  return (
    kind === WorkKind.movie ||
    kind === WorkKind.episode ||
    kind === WorkKind.book
  );
}

function countBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

async function resetSeedData(prisma: PrismaClient): Promise<void> {
  const seedUsers = await prisma.user.findMany({
    where: {
      username: {
        startsWith: 'seed_user_',
      },
    },
    select: {
      id: true,
    },
  });
  const seedUserIds = seedUsers.map((user) => user.id);
  const seedLists = await prisma.list.findMany({
    where: {
      ownerUserId: {
        in: seedUserIds,
      },
    },
    select: {
      id: true,
      rateableId: true,
    },
  });
  const seedListIds = seedLists.map((list) => list.id);
  const seedListRateableIds = seedLists.map((list) => list.rateableId);
  const seedPosts = await prisma.post.findMany({
    where: {
      authorUserId: {
        in: seedUserIds,
      },
    },
    select: {
      id: true,
    },
  });
  const seedPostIds = seedPosts.map((post) => post.id);

  await prisma.$transaction([
    prisma.moderationAction.deleteMany({
      where: {
        OR: [
          { moderatorUserId: { in: seedUserIds } },
          { targetPostId: { in: seedPostIds } },
          { targetListId: { in: seedListIds } },
        ],
      },
    }),
    prisma.progress.deleteMany({ where: { userId: { in: seedUserIds } } }),
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerUserId: { in: seedUserIds } },
          { followedUserId: { in: seedUserIds } },
        ],
      },
    }),
    prisma.post.deleteMany({ where: { authorUserId: { in: seedUserIds } } }),
    prisma.rating.deleteMany({ where: { userId: { in: seedUserIds } } }),
    prisma.listItem.deleteMany({ where: { listId: { in: seedListIds } } }),
    prisma.list.deleteMany({ where: { id: { in: seedListIds } } }),
    prisma.userRole.deleteMany({ where: { userId: { in: seedUserIds } } }),
    prisma.user.deleteMany({ where: { id: { in: seedUserIds } } }),
  ]);

  if (seedListRateableIds.length > 0) {
    await prisma.rateable.deleteMany({
      where: {
        id: {
          in: seedListRateableIds,
        },
      },
    });
  }

  await prisma.rateable.deleteMany({
    where: {
      kind: RateableKind.list,
      list: null,
    },
  });
}

async function ensureRoles(prisma: PrismaClient): Promise<void> {
  await prisma.role.upsert({
    where: { id: 1 },
    create: { id: 1, code: 'user', name: 'Авторизованный пользователь' },
    update: { code: 'user', name: 'Авторизованный пользователь' },
  });
  await prisma.role.upsert({
    where: { id: 2 },
    create: { id: 2, code: 'moderator', name: 'Модератор' },
    update: { code: 'moderator', name: 'Модератор' },
  });
  await prisma.role.upsert({
    where: { id: 3 },
    create: { id: 3, code: 'admin', name: 'Администратор' },
    update: { code: 'admin', name: 'Администратор' },
  });
}

async function insertUsers(
  prisma: PrismaClient,
  users: SeedUser[],
): Promise<void> {
  const passwordHash = await hash('password123');
  await createManyInBatches(users, (data) =>
    prisma.user.createMany({
      data: data.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        bio: makeUserBio(user),
        isActive: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    }),
  );

  const userRoles: Prisma.UserRoleCreateManyInput[] = [];
  const moderators = users.filter((user) => user.activityType === 'moderator');
  const adminIds = new Set(moderators.slice(0, 2).map((user) => user.id));

  for (const user of users) {
    userRoles.push({
      userId: user.id,
      roleId: 1,
      assignedAt: user.createdAt,
    });

    if (user.activityType === 'moderator') {
      userRoles.push({
        userId: user.id,
        roleId: 2,
        assignedAt: addMinutes(user.createdAt, 10),
      });
    }

    if (adminIds.has(user.id)) {
      userRoles.push({
        userId: user.id,
        roleId: 3,
        assignedAt: addMinutes(user.createdAt, 20),
      });
    }
  }

  await createManyInBatches(userRoles, (data) =>
    prisma.userRole.createMany({ data }),
  );
}

function makeUserBio(user: SeedUser): string {
  const subject =
    user.favoriteKind === 'movie'
      ? 'фильмы'
      : user.favoriteKind === 'show'
        ? 'сериалы'
        : user.favoriteKind === 'book'
          ? 'книги'
          : 'истории в любом формате';

  return `Seed-профиль: ${subject}, активность ${user.activityType}.`;
}

async function createManyInBatches<T>(
  items: readonly T[],
  write: (items: T[]) => Promise<unknown>,
  batchSize = 2_000,
): Promise<void> {
  for (let index = 0; index < items.length; index += batchSize) {
    await write(items.slice(index, index + batchSize));
  }
}

async function insertGeneratedData(
  prisma: PrismaClient,
  payload: {
    users: SeedUser[];
    ratings: RatingSeed[];
    reviews: ReviewSeed[];
    comments: Prisma.PostCreateManyInput[];
    listRateables: Prisma.RateableCreateManyInput[];
    lists: ListSeed[];
    listItems: Prisma.ListItemCreateManyInput[];
    follows: Prisma.FollowCreateManyInput[];
    progress: Prisma.ProgressCreateManyInput[];
    moderation: ReturnType<typeof generateModerationActions>;
  },
): Promise<void> {
  const hiddenPostIds = new Set(payload.moderation.hiddenPostIds);
  const hiddenListIds = new Set(payload.moderation.hiddenListIds);

  await insertUsers(prisma, payload.users);
  await createManyInBatches(payload.ratings, (data) =>
    prisma.rating.createMany({
      data: data.map(toRatingCreateInput),
    }),
  );
  await createManyInBatches(payload.reviews, (data) =>
    prisma.post.createMany({
      data: data.map((review) =>
        toReviewCreateInput(review, hiddenPostIds.has(review.id)),
      ),
    }),
  );
  await createManyInBatches(payload.comments, (data) =>
    prisma.post.createMany({
      data: data.map((comment) => ({
        ...comment,
        isHidden: hiddenPostIds.has(String(comment.id)),
      })),
    }),
  );
  await createManyInBatches(payload.listRateables, (data) =>
    prisma.rateable.createMany({ data }),
  );
  await createManyInBatches(payload.lists, (data) =>
    prisma.list.createMany({
      data: data.map((list) =>
        toListCreateInput(list, hiddenListIds.has(list.id)),
      ),
    }),
  );
  await createManyInBatches(payload.listItems, (data) =>
    prisma.listItem.createMany({ data }),
  );
  await createManyInBatches(payload.follows, (data) =>
    prisma.follow.createMany({ data }),
  );
  await createManyInBatches(payload.progress, (data) =>
    prisma.progress.createMany({ data }),
  );
  await createManyInBatches(payload.moderation.actions, (data) =>
    prisma.moderationAction.createMany({ data }),
  );
}

function toRatingCreateInput(rating: RatingSeed): Prisma.RatingCreateManyInput {
  return {
    id: rating.id,
    userId: rating.userId,
    rateableId: rating.rateableId,
    value: rating.value,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
  };
}

function toReviewCreateInput(
  review: ReviewSeed,
  isHidden: boolean,
): Prisma.PostCreateManyInput {
  return {
    id: review.id,
    authorUserId: review.authorUserId,
    rateableId: review.rateableId,
    parentPostId: review.parentPostId,
    body: review.body,
    isHidden,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function toListCreateInput(
  list: ListSeed,
  isHidden: boolean,
): Prisma.ListCreateManyInput {
  return {
    id: list.id,
    rateableId: list.rateableId,
    ownerUserId: list.ownerUserId,
    title: list.title,
    description: list.description,
    visibility: list.visibility,
    isHidden,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

async function verify(prisma: PrismaClient): Promise<void> {
  const checks = await prisma.$queryRaw<VerificationRow[]>`
    SELECT 'duplicate ratings' AS check_name, COUNT(*) AS failures
    FROM (
      SELECT 1
      FROM ratings
      GROUP BY user_id, rateable_id
      HAVING COUNT(*) > 1
    ) d
    UNION ALL
    SELECT 'duplicate follows', COUNT(*)
    FROM (
      SELECT 1
      FROM follows
      GROUP BY follower_user_id, followed_user_id
      HAVING COUNT(*) > 1
    ) d
    UNION ALL
    SELECT 'self follows', COUNT(*)
    FROM follows
    WHERE follower_user_id = followed_user_id
    UNION ALL
    SELECT 'reviews without rating', COUNT(*)
    FROM posts p
    WHERE p.parent_post_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM ratings r
        WHERE r.user_id = p.author_user_id
          AND r.rateable_id = p.rateable_id
      )
    UNION ALL
    SELECT 'comments without parent', COUNT(*)
    FROM posts p
    WHERE p.parent_post_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM posts parent WHERE parent.id = p.parent_post_id
      )
    UNION ALL
    SELECT 'progress outside contents', COUNT(*)
    FROM progress pr
    LEFT JOIN contents c ON c.work_id = pr.content_work_id
    WHERE c.work_id IS NULL
    UNION ALL
    SELECT 'bad moderation target count', COUNT(*)
    FROM moderation_actions ma
    WHERE ((ma.target_post_id IS NOT NULL)::integer + (ma.target_list_id IS NOT NULL)::integer) <> 1
    UNION ALL
    SELECT 'rating updated before created', COUNT(*)
    FROM ratings
    WHERE updated_at < created_at
    UNION ALL
    SELECT 'post updated before created', COUNT(*)
    FROM posts
    WHERE updated_at < created_at
    UNION ALL
    SELECT 'comment before parent', COUNT(*)
    FROM posts c
    JOIN posts p ON p.id = c.parent_post_id
    WHERE c.created_at < p.created_at
    UNION ALL
    SELECT 'list item before list', COUNT(*)
    FROM list_items li
    JOIN lists l ON l.id = li.list_id
    WHERE li.added_at < l.created_at
    UNION ALL
    SELECT 'moderation before target', COUNT(*)
    FROM moderation_actions ma
    LEFT JOIN posts p ON p.id = ma.target_post_id
    LEFT JOIN lists l ON l.id = ma.target_list_id
    WHERE ma.created_at < COALESCE(p.created_at, l.created_at)
  `;
  const failed = checks.filter((check) => check.failures > 0n);

  if (failed.length > 0) {
    for (const check of failed) {
      console.error(`${check.check_name}: ${check.failures.toString()}`);
    }

    throw new Error('Seed verification failed');
  }
}

async function printSummary(
  prisma: PrismaClient,
  users: SeedUser[],
): Promise<void> {
  const [
    usersCount,
    ratingsCount,
    reviewsCount,
    commentsCount,
    listsCount,
    listItemsCount,
    followsCount,
    progressCount,
    moderationActionsCount,
    rolesCount,
    topWorks,
    topFollowers,
    topReviewers,
  ] = await Promise.all([
    countRows(prisma, 'users'),
    countRows(prisma, 'ratings'),
    countWhere(prisma, 'posts', 'parent_post_id IS NULL'),
    countWhere(prisma, 'posts', 'parent_post_id IS NOT NULL'),
    countRows(prisma, 'lists'),
    countRows(prisma, 'list_items'),
    countRows(prisma, 'follows'),
    countRows(prisma, 'progress'),
    countRows(prisma, 'moderation_actions'),
    countRows(prisma, 'roles'),
    prisma.$queryRaw<TopWorkRow[]>`
      SELECT w.title, w.kind, COUNT(r.id) AS count
      FROM ratings r
      JOIN works w ON w.rateable_id = r.rateable_id
      GROUP BY w.id
      ORDER BY COUNT(r.id) DESC, w.title ASC
      LIMIT 10
    `,
    prisma.$queryRaw<TopUserRow[]>`
      SELECT u.username, u.display_name AS "displayName", COUNT(f.follower_user_id) AS count
      FROM users u
      JOIN follows f ON f.followed_user_id = u.id
      GROUP BY u.id
      ORDER BY COUNT(f.follower_user_id) DESC, u.username ASC
      LIMIT 10
    `,
    prisma.$queryRaw<TopUserRow[]>`
      SELECT u.username, u.display_name AS "displayName", COUNT(p.id) AS count
      FROM users u
      JOIN posts p ON p.author_user_id = u.id
      WHERE p.parent_post_id IS NULL
      GROUP BY u.id
      ORDER BY COUNT(p.id) DESC, u.username ASC
      LIMIT 10
    `,
  ]);

  const distribution = [...countBy(users, (user) => user.activityType)].sort(
    ([left], [right]) => left.localeCompare(right),
  );

  console.log('\nSeed summary');
  console.log(`users: ${usersCount}`);
  console.log(`roles: ${rolesCount}`);
  console.log(`ratings: ${ratingsCount}`);
  console.log(`reviews: ${reviewsCount}`);
  console.log(`comments: ${commentsCount}`);
  console.log(`lists: ${listsCount}`);
  console.log(`list_items: ${listItemsCount}`);
  console.log(`follows: ${followsCount}`);
  console.log(`progress: ${progressCount}`);
  console.log(`moderation_actions: ${moderationActionsCount}`);
  console.log('\nactivity_type distribution:');

  for (const [activityType, count] of distribution) {
    console.log(`  ${activityType}: ${count}`);
  }

  console.log('\ntop-10 rated works:');
  for (const row of topWorks) {
    console.log(`  ${row.title} (${row.kind}): ${row.count.toString()}`);
  }

  console.log('\ntop-10 users by followers:');
  for (const row of topFollowers) {
    console.log(
      `  ${row.username} / ${row.displayName}: ${row.count.toString()}`,
    );
  }

  console.log('\ntop-10 users by reviews:');
  for (const row of topReviewers) {
    console.log(
      `  ${row.username} / ${row.displayName}: ${row.count.toString()}`,
    );
  }
}

async function countRows(
  prisma: PrismaClient,
  tableName: string,
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count FROM ${tableName}`,
  );

  return Number(rows[0]?.count ?? 0n);
}

async function countWhere(
  prisma: PrismaClient,
  tableName: string,
  whereSql: string,
): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${whereSql}`,
  );

  return Number(rows[0]?.count ?? 0n);
}

async function main(): Promise<void> {
  loadImportEnv();
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? getDatabaseUrl();

  const config = parseConfig();
  const rng = new Rng(config.seed);
  const prisma = new PrismaClient();

  try {
    console.log('Resetting previous seed social data...');
    await resetSeedData(prisma);
    await ensureRoles(prisma);

    console.log('Loading catalog and external popularity data...');
    const works = await loadWorks(prisma, config);
    const users = createUsers(config, rng);

    console.log('Generating ratings, reviews, comments, lists and follows...');
    const ratings = generateRatings(config, users, works, rng);
    const reviews = generateReviews(config, users, ratings, rng);
    const comments = generateComments(config, users, reviews, rng);
    const { rateables: listRateables, lists } = generateLists(
      config,
      users,
      rng,
    );
    const listItems = generateListItems(config, users, lists, works, rng);
    const follows = generateFollows(config, users, reviews, lists, rng);
    const progress = generateProgress(config, users, works, ratings, rng);
    const moderation = generateModerationActions(
      config,
      users,
      reviews,
      comments,
      lists,
      rng,
    );

    console.log('Writing generated rows...');
    await insertGeneratedData(prisma, {
      users,
      ratings,
      reviews,
      comments,
      listRateables,
      lists,
      listItems,
      follows,
      progress,
      moderation,
    });

    console.log('Verifying generated data...');
    await verify(prisma);
    await printSummary(prisma, users);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
