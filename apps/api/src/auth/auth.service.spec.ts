import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('rejects login for an unknown user without revealing which field is wrong', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    const service = moduleRef.get(AuthService);

    await expect(
      service.login({ username: 'ghost', password: 'secret' }),
    ).rejects.toThrow(
      new UnauthorizedException('Неверное имя пользователя или пароль'),
    );
  });
});
