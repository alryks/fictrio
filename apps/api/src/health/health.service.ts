import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HealthStatus = 'ok' | 'error';

type HealthResponse = {
  status: HealthStatus;
  api: HealthStatus;
  database: HealthStatus;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        api: 'ok',
        database: 'ok',
      };
    } catch {
      return {
        status: 'error',
        api: 'ok',
        database: 'error',
      };
    }
  }
}
