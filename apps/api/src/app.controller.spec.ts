import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getHealth: () =>
              Promise.resolve({
                status: 'ok',
                api: 'ok',
                database: 'ok',
              }),
          },
        },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('should return API and database status', async () => {
      await expect(healthController.getHealth()).resolves.toEqual({
        status: 'ok',
        api: 'ok',
        database: 'ok',
      });
    });
  });
});
