import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodError, ZodType } from 'zod';

type ZodDto = {
  schema?: ZodType;
};

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = this.getSchema(metadata.metatype);

    if (!schema) {
      return value;
    }

    const result = schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      message: 'Ошибка валидации входных данных',
      issues: this.formatIssues(result.error),
    });
  }

  private getSchema(metatype: ArgumentMetadata['metatype']): ZodType | null {
    if (!metatype || typeof metatype !== 'function') {
      return null;
    }

    return (metatype as ZodDto).schema ?? null;
  }

  private formatIssues(error: ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
}
