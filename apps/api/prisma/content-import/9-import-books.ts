import { getArg, toOutputPath } from './common';
import { prisma, rows, upsertBook } from './database';

const input = toOutputPath(getArg(2, 'books.csv'));

async function main(): Promise<void> {
  try {
    for (const row of await rows(input)) {
      await upsertBook(row);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
