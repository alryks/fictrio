import { loadImportEnv, parsePositiveInt, toOutputPath } from './common';
import { writeCsv } from './csv';
import { discoverTmdbCandidates } from './discover';
import { createTmdbClient } from './tmdb';

async function main(): Promise<void> {
  loadImportEnv();

  const target = parsePositiveInt(process.argv[2], 'N');
  const output = toOutputPath(process.argv[3] ?? 'show_candidates.csv');
  const today = new Date().toISOString().slice(0, 10);
  const client = createTmdbClient();

  const candidates = await discoverTmdbCandidates(
    client,
    target,
    'discover/tv',
    {
      include_adult: false,
      include_null_first_air_dates: false,
      'first_air_date.lte': today,
      sort_by: 'vote_count.desc',
    },
  );

  await writeCsv(
    output,
    ['id', 'score'],
    candidates.map((candidate) => ({
      id: candidate.id,
      score: candidate.score,
    })),
  );
}

void main();
