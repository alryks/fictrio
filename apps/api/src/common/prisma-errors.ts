import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Maps known post-write database errors to BadRequestException; any other
 * error is re-thrown unchanged. Always throws, so callers can use it as the
 * single statement in their catch block.
 */
export function mapPostWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new BadRequestException(
        'Пользователь уже оставил отзыв на этот объект',
      );
    }
    if (error.code === 'P2003') {
      throw new BadRequestException('Некорректная ссылка на объект отзыва');
    }
  }

  // The review-requires-rating trigger surfaces as an unknown request error.
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes(
      'Review requires an existing rating by the same user for the same rateable object',
    )
  ) {
    throw new BadRequestException(
      'Отзыв можно создать только после выставления оценки',
    );
  }

  throw error;
}
