import { WorkKind } from '@prisma/client';
import { getArg, toOutputPath } from './common';
import { asNullableString } from './csv';
import { createWork, prisma, rows, toDate, toSmallInt } from './database';

const showsInput = toOutputPath(getArg(2, 'shows.csv'));
const seasonsInput = toOutputPath(getArg(3, 'seasons.csv'));
const episodesInput = toOutputPath(getArg(4, 'episodes.csv'));

async function main(): Promise<void> {
  try {
    const showWorkIds = new Map<number, string>();
    const seasonWorkIds = new Map<number, string>();

    for (const row of await rows(showsInput)) {
      const tmdbId = Number(row.tmdb_id);
      const existing = await prisma.show.findUnique({
        where: { tmdbId },
        select: { workId: true },
      });
      const workId = existing?.workId ?? (await createWork(WorkKind.show, row));

      if (existing) {
        await prisma.work.update({
          where: { id: workId },
          data: {
            title: row.title,
            originalTitle: asNullableString(row.original_title),
            description: asNullableString(row.description),
            releaseYear: toSmallInt(row.release_year),
            imageUrl: asNullableString(row.image_url),
          },
        });
        await prisma.show.update({
          where: { tmdbId },
          data: {
            firstAirDate: toDate(row.first_air_date),
            lastAirDate: toDate(row.last_air_date),
            creatorNames: asNullableString(row.creator_names),
            actorNames: asNullableString(row.actor_names),
          },
        });
      } else {
        await prisma.show.create({
          data: {
            workId,
            tmdbId,
            firstAirDate: toDate(row.first_air_date),
            lastAirDate: toDate(row.last_air_date),
            creatorNames: asNullableString(row.creator_names),
            actorNames: asNullableString(row.actor_names),
          },
        });
      }

      showWorkIds.set(tmdbId, workId);
    }

    for (const row of await rows(seasonsInput)) {
      const tmdbId = Number(row.tmdb_id);
      const showWorkId = showWorkIds.get(Number(row.show_tmdb_id));

      if (!showWorkId) {
        throw new Error(
          `Show ${row.show_tmdb_id} must be imported before season ${tmdbId}`,
        );
      }

      const existing = await prisma.season.findUnique({
        where: { tmdbId },
        select: { workId: true },
      });
      const workId =
        existing?.workId ?? (await createWork(WorkKind.season, row));

      if (existing) {
        await prisma.work.update({
          where: { id: workId },
          data: {
            title: row.title,
            originalTitle: asNullableString(row.original_title),
            description: asNullableString(row.description),
            releaseYear: toSmallInt(row.release_year),
            imageUrl: asNullableString(row.image_url),
          },
        });
        await prisma.season.update({
          where: { tmdbId },
          data: {
            showWorkId,
            seasonNumber: Number(row.season_number),
            airDate: toDate(row.air_date),
          },
        });
      } else {
        await prisma.season.create({
          data: {
            workId,
            showWorkId,
            tmdbId,
            seasonNumber: Number(row.season_number),
            airDate: toDate(row.air_date),
          },
        });
      }

      seasonWorkIds.set(tmdbId, workId);
    }

    for (const row of await rows(episodesInput)) {
      const tmdbId = Number(row.tmdb_id);
      const seasonWorkId = seasonWorkIds.get(Number(row.season_tmdb_id));

      if (!seasonWorkId) {
        throw new Error(
          `Season ${row.season_tmdb_id} must be imported before episode ${tmdbId}`,
        );
      }

      const existing = await prisma.episode.findUnique({
        where: { tmdbId },
        select: { workId: true },
      });
      const workId =
        existing?.workId ?? (await createWork(WorkKind.episode, row));

      if (existing) {
        await prisma.work.update({
          where: { id: workId },
          data: {
            title: row.title,
            originalTitle: asNullableString(row.original_title),
            description: asNullableString(row.description),
            releaseYear: toSmallInt(row.release_year),
            imageUrl: asNullableString(row.image_url),
          },
        });
        await prisma.episode.update({
          where: { tmdbId },
          data: {
            seasonWorkId,
            episodeNumber: Number(row.episode_number),
            airDate: toDate(row.air_date),
            runtimeMinutes: toSmallInt(row.runtime_minutes),
            directorNames: asNullableString(row.director_names),
            actorNames: asNullableString(row.actor_names),
          },
        });
      } else {
        await prisma.$transaction([
          prisma.content.create({ data: { workId } }),
          prisma.episode.create({
            data: {
              workId,
              seasonWorkId,
              tmdbId,
              episodeNumber: Number(row.episode_number),
              airDate: toDate(row.air_date),
              runtimeMinutes: toSmallInt(row.runtime_minutes),
              directorNames: asNullableString(row.director_names),
              actorNames: asNullableString(row.actor_names),
            },
          }),
        ]);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
