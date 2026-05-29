import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { GetWorksQueryDto } from './works.dto';

/** Key namespace for every works-related cache entry. */
const KEY_PREFIX = 'fictrio:works';
/** Holds the current cache generation; bumping it invalidates everything. */
const GENERATION_KEY = `${KEY_PREFIX}:generation`;
/** Work cards change rarely, so their detail payload can live longer. */
const DETAIL_TTL_SECONDS = 300;
/** Catalog/search pages are bursty and short-lived. */
const LIST_TTL_SECONDS = 60;

/**
 * Read-through cache for the public works catalog and work detail cards.
 *
 * Invalidation is generation-based: every cache key embeds the current
 * generation counter, and {@link invalidate} simply increments it. Stale
 * entries stop being referenced at once and expire on their own TTL, so a
 * single rating change correctly drops every list page and detail card —
 * including ancestor shows that aggregate a season's or episode's ratings —
 * without scanning keys. Redis failures degrade to the loader, never to a
 * request error.
 */
@Injectable()
export class WorksCacheService {
  private readonly logger = new Logger(WorksCacheService.name);

  constructor(private readonly redis: RedisService) {}

  async cacheDetail<T>(workId: string, load: () => Promise<T>): Promise<T> {
    const generation = await this.currentGeneration();
    const key = `${KEY_PREFIX}:detail:${generation}:${workId}`;
    return this.readThrough(key, DETAIL_TTL_SECONDS, load);
  }

  async cacheList<T>(
    query: GetWorksQueryDto,
    load: () => Promise<T>,
  ): Promise<T> {
    const generation = await this.currentGeneration();
    const key = this.listKey(generation, query);
    return this.readThrough(key, LIST_TTL_SECONDS, load);
  }

  async invalidate(): Promise<void> {
    try {
      await this.redis.incr(GENERATION_KEY);
    } catch (error) {
      this.logger.warn(
        `Failed to bump works cache generation: ${describe(error)}`,
      );
    }
  }

  private async readThrough<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.getJson<T>(key);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${describe(error)}`);
      return load();
    }

    const value = await load();

    try {
      await this.redis.setJson(key, value, ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${describe(error)}`);
    }

    return value;
  }

  private async currentGeneration(): Promise<number> {
    try {
      const raw = await this.redis.get(GENERATION_KEY);
      if (raw === null) {
        return 0;
      }
      const parsed = Number.parseInt(raw, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    } catch (error) {
      this.logger.warn(
        `Failed to read works cache generation: ${describe(error)}`,
      );
      return 0;
    }
  }

  /**
   * Builds a deterministic key from the normalized query so requests that
   * differ only in property order or absent optional filters hit one entry.
   */
  private listKey(generation: number, query: GetWorksQueryDto): string {
    const normalized = {
      search: query.search ?? '',
      kinds: query.kinds ? [...query.kinds].sort() : [],
      yearFrom: query.yearFrom ?? null,
      yearTo: query.yearTo ?? null,
      minRating: query.minRating ?? null,
      minRatingsCount: query.minRatingsCount ?? null,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit: query.limit,
      offset: query.offset,
    };
    return `${KEY_PREFIX}:list:${generation}:${JSON.stringify(normalized)}`;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
