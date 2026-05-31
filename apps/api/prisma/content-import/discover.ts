import { average, bayesianScore, median } from './common';
import type { HttpClient } from './http';
import type { OpenLibrarySearchResponse } from './open-library';
import type { TmdbDiscoverResponse } from './tmdb';

export interface Candidate {
  id: string;
  voteAverage: number;
  voteCount: number;
}

export interface ScoredCandidate {
  id: string;
  score: number;
}

interface ThresholdSearchResult {
  threshold: number;
  total: number;
}

function distanceFromTarget(total: number, target: number): number {
  return Math.abs(total - target);
}

function isInTargetRange(total: number, target: number): boolean {
  return total >= target * 0.9 && total <= target * 1.1;
}

function nextThreshold(low: number, high: number): number {
  return Math.floor((low + high) / 2);
}

async function findVoteThreshold(
  target: number,
  fetchTotal: (threshold: number) => Promise<number>,
): Promise<ThresholdSearchResult> {
  let low = 0;
  let high = 1;
  let best: ThresholdSearchResult = {
    threshold: 0,
    total: await fetchTotal(0),
  };

  while (best.total > target * 1.1) {
    high *= 2;
    const total = await fetchTotal(high);

    if (
      distanceFromTarget(total, target) < distanceFromTarget(best.total, target)
    ) {
      best = { threshold: high, total };
    }

    if (total <= target) {
      break;
    }

    low = high;
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const threshold = nextThreshold(low, high);

    if (threshold === low || threshold === high) {
      break;
    }

    const total = await fetchTotal(threshold);

    if (
      distanceFromTarget(total, target) < distanceFromTarget(best.total, target)
    ) {
      best = { threshold, total };
    }

    if (isInTargetRange(total, target)) {
      best = { threshold, total };
      break;
    }

    if (total > target) {
      low = threshold;
    } else {
      high = threshold;
    }
  }

  return best;
}

export async function discoverTmdbCandidates(
  client: HttpClient,
  target: number,
  path: string,
  baseQuery: Record<string, string | number | boolean>,
): Promise<ScoredCandidate[]> {
  const threshold = await findVoteThreshold(target, async (voteThreshold) => {
    const page = await client.getJson<TmdbDiscoverResponse>(path, {
      ...baseQuery,
      'vote_count.gte': voteThreshold,
      page: 1,
    });

    return page.total_results;
  });

  const candidates = new Map<string, Candidate>();
  const firstPage = await client.getJson<TmdbDiscoverResponse>(path, {
    ...baseQuery,
    'vote_count.gte': threshold.threshold,
    page: 1,
  });
  const totalPages = Math.min(firstPage.total_pages, 500);

  for (const item of firstPage.results) {
    candidates.set(String(item.id), {
      id: String(item.id),
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
    });
  }

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const page = await client.getJson<TmdbDiscoverResponse>(path, {
      ...baseQuery,
      'vote_count.gte': threshold.threshold,
      page: pageNumber,
    });

    for (const item of page.results) {
      candidates.set(String(item.id), {
        id: String(item.id),
        voteAverage: item.vote_average,
        voteCount: item.vote_count,
      });
    }
  }

  return scoreCandidates([...candidates.values()]);
}

export async function discoverOpenLibraryCandidates(
  client: HttpClient,
  target: number,
  currentYear: number,
): Promise<ScoredCandidate[]> {
  const fields =
    'key,title,author_name,first_publish_year,ratings_average,ratings_count,cover_i,number_of_pages_median';
  const buildQuery = (ratingsThreshold: number): string =>
    `author_key:* title:* first_publish_year:[0 TO ${currentYear}] ratings_count:[${ratingsThreshold} TO *]`;

  const threshold = await findVoteThreshold(
    target,
    async (ratingsThreshold) => {
      const response = await client.getJson<OpenLibrarySearchResponse>(
        'search.json',
        {
          q: buildQuery(ratingsThreshold),
          fields,
          limit: 1,
        },
      );

      return response.numFound ?? response.num_found ?? 0;
    },
  );

  const candidates = new Map<string, Candidate>();
  const limit = 100;
  const totalPages = Math.ceil(threshold.total / limit);

  for (let page = 1; page <= totalPages; page += 1) {
    const response = await client.getJson<OpenLibrarySearchResponse>(
      'search.json',
      {
        q: buildQuery(threshold.threshold),
        fields,
        limit,
        page,
      },
    );

    for (const doc of response.docs ?? []) {
      if (
        !doc.key ||
        doc.ratings_average === undefined ||
        doc.ratings_count === undefined
      ) {
        continue;
      }

      candidates.set(doc.key, {
        id: doc.key,
        voteAverage: doc.ratings_average,
        voteCount: doc.ratings_count,
      });
    }
  }

  return scoreCandidates([...candidates.values()]);
}

function scoreCandidates(candidates: Candidate[]): ScoredCandidate[] {
  const voteCounts = candidates.map((candidate) => candidate.voteCount);
  const voteAverages = candidates.map((candidate) => candidate.voteAverage);
  const medianVoteCount = median(voteCounts);
  const averageVote = average(voteAverages);

  return candidates
    .map((candidate) => ({
      id: candidate.id,
      score: bayesianScore(
        candidate.voteCount,
        candidate.voteAverage,
        medianVoteCount,
        averageVote,
      ),
    }))
    .sort((left, right) => right.score - left.score);
}
