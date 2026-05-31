import { PrismaClient, RateableKind, WorkKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getDatabaseUrl } from '../../src/config/database-url';
import { loadImportEnv } from './common';
import { asNullableNumber, asNullableString, readCsv } from './csv';

loadImportEnv();

process.env.DATABASE_URL = process.env.DATABASE_URL ?? getDatabaseUrl();

export const prisma = new PrismaClient();

export function toDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function toSmallInt(value: string | undefined): number | null {
  const numberValue = asNullableNumber(value);

  if (numberValue === null) {
    return null;
  }

  return Math.trunc(numberValue);
}

export async function rows(path: string): Promise<Record<string, string>[]> {
  return readCsv(path);
}

export async function upsertMovie(row: Record<string, string>): Promise<void> {
  const tmdbId = Number(row.tmdb_id);
  const existing = await prisma.movie.findUnique({
    where: { tmdbId },
    select: { workId: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.work.update({
        where: { id: existing.workId },
        data: {
          title: row.title,
          originalTitle: asNullableString(row.original_title),
          description: asNullableString(row.description),
          releaseYear: toSmallInt(row.release_year),
          imageUrl: asNullableString(row.image_url),
        },
      }),
      prisma.movie.update({
        where: { tmdbId },
        data: {
          runtimeMinutes: toSmallInt(row.runtime_minutes),
          directorNames: asNullableString(row.director_names),
          actorNames: asNullableString(row.actor_names),
        },
      }),
    ]);
    return;
  }

  const rateableId = randomUUID();
  const workId = randomUUID();

  await prisma.$transaction([
    prisma.rateable.create({
      data: { id: rateableId, kind: RateableKind.work },
    }),
    prisma.work.create({
      data: {
        id: workId,
        rateableId,
        kind: WorkKind.movie,
        title: row.title,
        originalTitle: asNullableString(row.original_title),
        description: asNullableString(row.description),
        releaseYear: toSmallInt(row.release_year),
        imageUrl: asNullableString(row.image_url),
      },
    }),
    prisma.content.create({ data: { workId } }),
    prisma.movie.create({
      data: {
        workId,
        tmdbId,
        runtimeMinutes: toSmallInt(row.runtime_minutes),
        directorNames: asNullableString(row.director_names),
        actorNames: asNullableString(row.actor_names),
      },
    }),
  ]);
}

export async function createWork(
  kind: WorkKind,
  row: Record<string, string>,
): Promise<string> {
  const rateableId = randomUUID();
  const workId = randomUUID();

  await prisma.rateable.create({
    data: { id: rateableId, kind: RateableKind.work },
  });
  await prisma.work.create({
    data: {
      id: workId,
      rateableId,
      kind,
      title: row.title,
      originalTitle: asNullableString(row.original_title),
      description: asNullableString(row.description),
      releaseYear: toSmallInt(row.release_year),
      imageUrl: asNullableString(row.image_url),
    },
  });

  return workId;
}

export async function upsertBook(row: Record<string, string>): Promise<void> {
  const openlibraryWorkKey = row.openlibrary_work_key;
  const existing = await prisma.book.findUnique({
    where: { openlibraryWorkKey },
    select: { workId: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.work.update({
        where: { id: existing.workId },
        data: {
          title: row.title,
          originalTitle: asNullableString(row.original_title),
          description: asNullableString(row.description),
          releaseYear: toSmallInt(row.release_year),
          imageUrl: asNullableString(row.image_url),
        },
      }),
      prisma.book.update({
        where: { openlibraryWorkKey },
        data: {
          firstPublishYear: toSmallInt(row.first_publish_year),
          authorNames: asNullableString(row.author_names),
          pages: toSmallInt(row.pages),
        },
      }),
    ]);
    return;
  }

  const workId = await createWork(WorkKind.book, row);

  await prisma.$transaction([
    prisma.content.create({ data: { workId } }),
    prisma.book.create({
      data: {
        workId,
        openlibraryWorkKey,
        firstPublishYear: toSmallInt(row.first_publish_year),
        authorNames: asNullableString(row.author_names),
        pages: toSmallInt(row.pages),
      },
    }),
  ]);
}
