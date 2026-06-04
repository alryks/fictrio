import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, WorkKind } from '@prisma/client';
import { getDatabaseUrl } from './config/database-url';

type Tx = Prisma.TransactionClient;

const prisma = new PrismaClient({
  datasources: { db: { url: getDatabaseUrl() } },
});

class Rollback extends Error {}

async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }

  return result as T;
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

async function createWork(tx: Tx, kind: WorkKind = 'movie') {
  const rateable = await tx.rateable.create({ data: { kind: 'work' } });
  const work = await tx.work.create({
    data: {
      rateableId: rateable.id,
      kind,
      title: `Test Work ${randomUUID()}`,
    },
  });

  if (kind === 'movie') {
    await tx.movie.create({
      data: {
        workId: work.id,
        tmdbId: Math.floor(Math.random() * 1_000_000_000),
      },
    });
  }

  if (kind === 'book') {
    await tx.book.create({
      data: {
        workId: work.id,
        openlibraryWorkKey: `/works/OL${randomUUID().slice(0, 8)}W`,
      },
    });
  }

  return { rateableId: rateable.id, workId: work.id };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('equivalence classes for coursework testing', () => {
  it('accepts valid user registration data', async () => {
    const created = await inRollback(async (tx) => createUser(tx));

    expect(created.id).toEqual(expect.any(String));
  });

  it('rejects a duplicate user email', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        await tx.user.create({
          data: {
            username: `duplicate_${randomUUID()}`,
            email: user.email,
            passwordHash: 'test-hash',
            displayName: 'Duplicate User',
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('accepts a rating from the allowed 0..3 range', async () => {
    const rating = await inRollback(async (tx) => {
      const user = await createUser(tx);
      const { rateableId } = await createWork(tx);

      return tx.rating.create({
        data: { userId: user.id, rateableId, value: 2 },
      });
    });

    expect(rating.value).toBe(2);
  });

  it('rejects a rating outside the allowed 0..3 range', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { rateableId } = await createWork(tx);

        await tx.rating.create({
          data: { userId: user.id, rateableId, value: 4 },
        });
      }),
    ).rejects.toThrow();
  });

  it('rejects a repeated rating for the same object by the same user', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { rateableId } = await createWork(tx);

        await tx.rating.create({
          data: { userId: user.id, rateableId, value: 1 },
        });
        await tx.rating.create({
          data: { userId: user.id, rateableId, value: 3 },
        });
      }),
    ).rejects.toThrow();
  });

  it('accepts a review when the author has rated the object', async () => {
    const post = await inRollback(async (tx) => {
      const user = await createUser(tx);
      const { rateableId } = await createWork(tx);

      await tx.rating.create({
        data: { userId: user.id, rateableId, value: 3 },
      });

      return tx.post.create({
        data: { authorUserId: user.id, rateableId, body: 'Valid review' },
      });
    });

    expect(post.parentPostId).toBeNull();
  });

  it('rejects a review without a preceding rating', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { rateableId } = await createWork(tx);

        await tx.post.create({
          data: { authorUserId: user.id, rateableId, body: 'No rating' },
        });
      }),
    ).rejects.toThrow();
  });

  it('rejects a repeated review for the same object by the same user', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { rateableId } = await createWork(tx);

        await tx.rating.create({
          data: { userId: user.id, rateableId, value: 3 },
        });
        await tx.post.create({
          data: { authorUserId: user.id, rateableId, body: 'First review' },
        });
        await tx.post.create({
          data: { authorUserId: user.id, rateableId, body: 'Second review' },
        });
      }),
    ).rejects.toThrow();
  });

  it('accepts a comment with an existing parent post', async () => {
    const comment = await inRollback(async (tx) => {
      const author = await createUser(tx);
      const commenter = await createUser(tx);
      const { rateableId } = await createWork(tx);

      await tx.rating.create({
        data: { userId: author.id, rateableId, value: 3 },
      });
      const review = await tx.post.create({
        data: { authorUserId: author.id, rateableId, body: 'Review' },
      });

      return tx.post.create({
        data: {
          authorUserId: commenter.id,
          parentPostId: review.id,
          body: 'Valid comment',
        },
      });
    });

    expect(comment.parentPostId).toEqual(expect.any(String));
  });

  it('rejects a post that is neither a review nor a comment', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);

        await tx.post.create({
          data: { authorUserId: user.id, body: 'Invalid post' },
        });
      }),
    ).rejects.toThrow();
  });

  it('accepts a subscription to another user', async () => {
    const follow = await inRollback(async (tx) => {
      const follower = await createUser(tx);
      const followed = await createUser(tx);

      return tx.follow.create({
        data: {
          followerUserId: follower.id,
          followedUserId: followed.id,
        },
      });
    });

    expect(follow.followerUserId).not.toBe(follow.followedUserId);
  });

  it('rejects a subscription to oneself', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);

        await tx.follow.create({
          data: {
            followerUserId: user.id,
            followedUserId: user.id,
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('accepts valid progress values for content', async () => {
    const progress = await inRollback(async (tx) => {
      const user = await createUser(tx);
      const { workId } = await createWork(tx, 'book');

      await tx.content.create({ data: { workId } });

      return tx.progress.create({
        data: {
          userId: user.id,
          contentWorkId: workId,
          status: 'started',
          valueNow: 10,
          valueMax: 100,
        },
      });
    });

    expect(progress.valueNow).toBe(10);
  });

  it('rejects invalid progress values', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await createUser(tx);
        const { workId } = await createWork(tx, 'book');

        await tx.content.create({ data: { workId } });
        await tx.progress.create({
          data: {
            userId: user.id,
            contentWorkId: workId,
            status: 'started',
            valueNow: -1,
            valueMax: 100,
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('rejects progress content for a work kind that cannot have progress', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const { workId } = await createWork(tx, 'show');

        await tx.content.create({ data: { workId } });
      }),
    ).rejects.toThrow();
  });

  it('accepts a moderation action with exactly one target', async () => {
    const action = await inRollback(async (tx) => {
      const author = await createUser(tx);
      const moderator = await createUser(tx);
      const { rateableId } = await createWork(tx);

      await tx.rating.create({
        data: { userId: author.id, rateableId, value: 3 },
      });
      const post = await tx.post.create({
        data: { authorUserId: author.id, rateableId, body: 'Review' },
      });

      return tx.moderationAction.create({
        data: {
          moderatorUserId: moderator.id,
          action: 'hide',
          targetPostId: post.id,
        },
      });
    });

    expect(action.targetPostId).toEqual(expect.any(String));
    expect(action.targetListId).toBeNull();
  });

  it('rejects a moderation action without exactly one target', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const moderator = await createUser(tx);

        await tx.moderationAction.create({
          data: {
            moderatorUserId: moderator.id,
            action: 'hide',
          },
        });
      }),
    ).rejects.toThrow();
  });

  it('checks the moderate_post procedure', async () => {
    const result = await inRollback(async (tx) => {
      const author = await createUser(tx);
      const moderator = await createUser(tx);
      const { rateableId } = await createWork(tx);

      await tx.rating.create({
        data: { userId: author.id, rateableId, value: 3 },
      });
      const post = await tx.post.create({
        data: { authorUserId: author.id, rateableId, body: 'Review' },
      });

      await tx.$executeRaw`CALL moderate_post(${moderator.id}::uuid, ${post.id}::uuid, 'hide'::moderation_action_kind, 'reason')`;

      const updatedPost = await tx.post.findUniqueOrThrow({
        where: { id: post.id },
      });
      const actionCount = await tx.moderationAction.count({
        where: { targetPostId: post.id },
      });

      return { isHidden: updatedPost.isHidden, actionCount };
    });

    expect(result).toEqual({ isHidden: true, actionCount: 1 });
  });
});
