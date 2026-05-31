import { loadImportEnv, parsePositiveInt, toOutputPath } from './common';
import { writeCsv } from './csv';
import { discoverOpenLibraryCandidates } from './discover';
import { createOpenLibraryClient } from './open-library';

async function main(): Promise<void> {
  loadImportEnv();

  const target = parsePositiveInt(process.argv[2], 'N');
  const output = toOutputPath(process.argv[3] ?? 'book_candidates.csv');
  const client = createOpenLibraryClient();
  const candidates = await discoverOpenLibraryCandidates(
    client,
    target,
    new Date().getFullYear(),
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
