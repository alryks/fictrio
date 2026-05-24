import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type HealthStatus = 'ok' | 'error';

type HealthResponse = {
  status: HealthStatus;
  api: HealthStatus;
  database: HealthStatus;
  redis: HealthStatus;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const database = await this.getDatabaseStatus();
    const redis = await this.getRedisStatus();

    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'error',
      api: 'ok',
      database,
      redis,
    };
  }

  private async getDatabaseStatus(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async getRedisStatus(): Promise<HealthStatus> {
    try {
      await this.redis.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
