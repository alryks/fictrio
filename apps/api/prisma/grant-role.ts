import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KNOWN_ROLES = ['user', 'moderator', 'admin'] as const;
type KnownRole = (typeof KNOWN_ROLES)[number];

function isKnownRole(value: string): value is KnownRole {
  return (KNOWN_ROLES as readonly string[]).includes(value);
}

/**
 * Grants a role to a user by username. Idempotent: re-running with the same
 * arguments is a no-op. Used to provision a moderator/admin account for
 * demonstrating moderation, since registration only ever assigns `user`.
 *
 *   bun run --cwd apps/api db:grant-role <username> <user|moderator|admin>
 */
async function main() {
  const [username, roleCode] = process.argv.slice(2);

  if (!username || !roleCode) {
    throw new Error(
      'Usage: db:grant-role <username> <user|moderator|admin>',
    );
  }

  if (!isKnownRole(roleCode)) {
    throw new Error(
      `Unknown role "${roleCode}". Expected one of: ${KNOWN_ROLES.join(', ')}`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, username: true },
  });

  if (!user) {
    throw new Error(`User "${username}" not found`);
  }

  const role = await prisma.role.findUnique({
    where: { code: roleCode },
    select: { id: true, name: true },
  });

  if (!role) {
    throw new Error(
      `Role "${roleCode}" not found. Run migrations to seed default roles.`,
    );
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    create: {
      userId: user.id,
      roleId: role.id,
    },
    update: {},
  });

  console.log(`Granted role "${role.name}" to user "${user.username}".`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
