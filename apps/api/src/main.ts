import { NestFactory } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { CsrfGuard } from './auth/csrf.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyHelmet, {
    // The API is a JSON service consumed from a different origin; default
    // CSP would block the Next.js dev server during local development.
    contentSecurityPolicy: false,
  });
  await app.register(fastifyCookie);
  // Global ceiling protects every route from request storms. /auth/login
  // is additionally hardened by argon2's verification cost (~200ms per
  // attempt), so brute-forcing credentials at the global 300 req/min cap
  // is computationally infeasible without dedicated infrastructure.
  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  // CORS during development reflects any origin but must allow credentials so
  // that the browser includes the session and CSRF cookies on cross-origin
  // requests from the Next.js dev server.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalGuards(new CsrfGuard());
  app.useGlobalFilters(new ApiExceptionFilter());

  const host = process.env.API_HOST ?? '0.0.0.0';
  const port = Number(process.env.API_PORT ?? 3001);

  await app.listen(port, host);
}
void bootstrap();
