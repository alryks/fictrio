import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mapPostWriteError } from './prisma-errors';

describe('mapPostWriteError', () => {
  it('maps the review-requires-rating trigger error to a user-facing message', () => {
    const triggerError = new Prisma.PrismaClientUnknownRequestError(
      'Review requires an existing rating by the same user for the same rateable object',
      { clientVersion: 'test' },
    );

    expect(() => mapPostWriteError(triggerError)).toThrow(BadRequestException);
    expect(() => mapPostWriteError(triggerError)).toThrow(
      'Отзыв можно создать только после выставления оценки',
    );
  });
});
