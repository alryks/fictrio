import { NestFactory } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
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

  await app.register(fastifyCookie);

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
