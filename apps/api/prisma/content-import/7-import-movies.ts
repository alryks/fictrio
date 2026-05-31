import { getArg, toOutputPath } from './common';
import { prisma, rows, upsertMovie } from './database';

const input = toOutputPath(getArg(2, 'movies.csv'));

async function main(): Promise<void> {
  try {
    for (const row of await rows(input)) {
      await upsertMovie(row);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
