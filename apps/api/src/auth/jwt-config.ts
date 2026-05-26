import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { z } from 'zod';

const expiresInSchema = z
  .string()
  .regex(
    /^\d+(ms|s|m|h|d|w|y)?$/,
    'JWT_ACCESS_TOKEN_EXPIRES_IN должен быть в формате `<число><ms|s|m|h|d|w|y>`',
  );

export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }

  return secret;
}

export function getJwtAccessTokenExpiresIn(
  configService: ConfigService,
): JwtSignOptions['expiresIn'] {
  const raw = configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN') ?? '1h';
  return expiresInSchema.parse(raw) as JwtSignOptions['expiresIn'];
}
