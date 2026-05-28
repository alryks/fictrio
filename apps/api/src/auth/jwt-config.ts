import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { z } from 'zod';

const ONE_HOUR_SECONDS = 60 * 60;

const durationPattern = /^(\d+)(ms|s|m|h|d|w|y)?$/;

const UNIT_SECONDS: Record<string, number> = {
  ms: 1 / 1000,
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
  w: 60 * 60 * 24 * 7,
  y: 60 * 60 * 24 * 365,
};

const expiresInSchema = z
  .string()
  .regex(
    durationPattern,
    'JWT_ACCESS_TOKEN_EXPIRES_IN должен быть в формате `<число><ms|s|m|h|d|w|y>`',
  );

/**
 * Parses a JWT duration (`<number><unit>` string or a numeric seconds value)
 * into whole seconds, falling back to one hour when missing or malformed.
 */
export function durationToSeconds(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (!value) {
    return ONE_HOUR_SECONDS;
  }

  const match = durationPattern.exec(value);
  if (!match) {
    return ONE_HOUR_SECONDS;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  return Math.floor(amount * UNIT_SECONDS[unit]);
}

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
