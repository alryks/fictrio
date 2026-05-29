import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from '../config/database-url';

/**
 * Integration tests for the database constraints, triggers and procedures
 * designed in the coursework (report/22-design.tex). They run against the
 * local development PostgreSQL: every test executes inside a transaction that
 * is rolled back, so no fixture data is ever committed to the dev database.
 */

type Tx = Prisma.TransactionClient;

const prisma = new PrismaClient({
  datasources: { db: { url: getDatabaseUrl() } },
});

class Rollback extends Error {}

/** Runs `fn` inside a transaction and always rolls it back afterwards. */
async function inRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
}

async function createUser(tx: Tx) {
  const id = randomUUID();
  return tx.user.create({
    data: {
      username: `test_${id}`,
      email: `${id}@test.local`,
      passwordHash: 'test-hash',
      displayName: 'Test User',
    },
  });
}

/** Creates a rateable work of the given kind and returns its ids. */
async function createWork(tx: Tx, kind: 'movie' | 'show') {
  const rateable = await tx.rateable.create({ data: { kind: 'work' } });
  const work = await tx.work.create({
    data: { rateableId: rateable.id, kind, title: 'Test Work' },
  });
  return { rateableId: rateable.id, workId: work.id };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('database integrity (integration)', () => {
  it('rejects a rating value outside the 0..3 range (CHECK constraint)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { rateableId } = await createWork(tx, 'movie');
        await tx.rating.create({
          data: { userId: user.id, rateableId, value: 5 },
        });
      }),
    ).rejects.toThrow();
  });

  it('blocks a review unless the author already rated the object (trigger check_post_constraints)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { rateableId } = await createWork(tx, 'movie');
        await tx.post.create({
          data: { authorUserId: user.id, rateableId, body: 'Без оценки' },
        });
      }),
    ).rejects.toThrow();
  });

  it('rejects progress content for a non-content work kind (trigger check_content_kind)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const { workId } = await createWork(tx, 'show');
        await tx.content.create({ data: { workId } });
      }),
    ).rejects.toThrow();
  });

  it('moderate_post hides the post and logs the moderation action (procedure)', async () => {
    let outcome: { hidden: boolean; actions: number } | undefined;

    await inRollback(async (tx) => {
      const author = await createUser(tx);
      const moderator = await createUser(tx);
      const { rateableId } = await createWork(tx, 'movie');
      await tx.rating.create({
        data: { userId: author.id, rateableId, value: 3 },
      });
      const post = await tx.post.create({
        data: { authorUserId: author.id, rateableId, body: 'Отзыв' },
      });

      await tx.$executeRaw`CALL moderate_post(${moderator.id}::uuid, ${post.id}::uuid, 'hide'::moderation_action_kind, 'спам')`;

      const updated = await tx.post.findUniqueOrThrow({
        where: { id: post.id },
      });
      const actions = await tx.moderationAction.count({
        where: { targetPostId: post.id },
      });
      outcome = { hidden: updated.isHidden, actions };
    });

    expect(outcome).toEqual({ hidden: true, actions: 1 });
  });
});
