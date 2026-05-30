import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { FeedModule } from './feed/feed.module';
import { HealthModule } from './health/health.module';
import { ListsModule } from './lists/lists.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { RatingsModule } from './ratings/ratings.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { WorksModule } from './works/works.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../infra/.env.dev', '.env'],
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WorksModule,
    ProgressModule,
    RatingsModule,
    PostsModule,
    ListsModule,
    FeedModule,
  ],
})
export class AppModule {}
