import { prisma } from './database';

type DeleteTarget = 'movies' | 'shows' | 'books' | 'all';

function parseTarget(): DeleteTarget {
  const target = process.argv[2];

  if (
    target === 'movies' ||
    target === 'shows' ||
    target === 'books' ||
    target === 'all'
  ) {
    return target;
  }

  throw new Error('Usage: bun apps/api/prisma/content-import/delete-content.ts <movies|shows|books|all>');
}

async function deleteWorks(workIds: string[], rateableIds: string[]): Promise<void> {
  if (workIds.length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.work.deleteMany({
      where: {
        id: { in: workIds },
      },
    }),
    prisma.rateable.deleteMany({
      where: {
        id: { in: rateableIds },
      },
    }),
  ]);
}

async function deleteMovies(): Promise<void> {
  const movies = await prisma.movie.findMany({
    select: {
      work: {
        select: {
          id: true,
          rateableId: true,
        },
      },
    },
  });

  await deleteWorks(
    movies.map((movie) => movie.work.id),
    movies.map((movie) => movie.work.rateableId),
  );
}

async function deleteBooks(): Promise<void> {
  const books = await prisma.book.findMany({
    select: {
      work: {
        select: {
          id: true,
          rateableId: true,
        },
      },
    },
  });

  await deleteWorks(
    books.map((book) => book.work.id),
    books.map((book) => book.work.rateableId),
  );
}

async function deleteShows(): Promise<void> {
  const shows = await prisma.show.findMany({
    select: {
      workId: true,
      work: {
        select: {
          rateableId: true,
        },
      },
      seasons: {
        select: {
          workId: true,
          work: {
            select: {
              rateableId: true,
            },
          },
          episodes: {
            select: {
              workId: true,
              work: {
                select: {
                  rateableId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const episodeWorks = shows.flatMap((show) =>
    show.seasons.flatMap((season) =>
      season.episodes.map((episode) => ({
        id: episode.workId,
        rateableId: episode.work.rateableId,
      })),
    ),
  );
  const seasonWorks = shows.flatMap((show) =>
    show.seasons.map((season) => ({
      id: season.workId,
      rateableId: season.work.rateableId,
    })),
  );
  const showWorks = shows.map((show) => ({
    id: show.workId,
    rateableId: show.work.rateableId,
  }));
  const rateableIds = [...episodeWorks, ...seasonWorks, ...showWorks].map(
    (work) => work.rateableId,
  );

  if (rateableIds.length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.work.deleteMany({
      where: {
        id: { in: episodeWorks.map((work) => work.id) },
      },
    }),
    prisma.work.deleteMany({
      where: {
        id: { in: seasonWorks.map((work) => work.id) },
      },
    }),
    prisma.work.deleteMany({
      where: {
        id: { in: showWorks.map((work) => work.id) },
      },
    }),
    prisma.rateable.deleteMany({
      where: {
        id: { in: rateableIds },
      },
    }),
  ]);
}

async function main(): Promise<void> {
  const target = parseTarget();

  try {
    if (target === 'movies' || target === 'all') {
      await deleteMovies();
    }

    if (target === 'shows' || target === 'all') {
      await deleteShows();
    }

    if (target === 'books' || target === 'all') {
      await deleteBooks();
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
