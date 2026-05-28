import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthResponse, CsrfTokenResponse } from '@fictrio/contracts';
import { AuthService, type AuthSession } from './auth.service';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
  csrfCookieOptions,
  sessionCookieOptions,
} from './cookies';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const session = await this.authService.register(dto);
    this.applySessionCookie(reply, session);
    return session.response;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const session = await this.authService.login(dto);
    this.applySessionCookie(reply, session);
    return session.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user);
  }

  /**
   * Issues (or refreshes) the CSRF token cookie and returns its value in
   * the response body. The cookie is intentionally not HttpOnly so the
   * client can echo it back in the `x-csrf-token` header on mutations
   * (double-submit cookie pattern).
   */
  @Get('csrf')
  csrf(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): CsrfTokenResponse {
    const existingToken = request.cookies?.[CSRF_COOKIE_NAME];
    const token = existingToken ?? randomBytes(32).toString('base64url');

    if (!existingToken) {
      reply.setCookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
    }

    return { csrfToken: token };
  }

  private applySessionCookie(reply: FastifyReply, session: AuthSession) {
    reply.setCookie(
      SESSION_COOKIE_NAME,
      session.accessToken,
      sessionCookieOptions(session.maxAgeSeconds),
    );
  }
}
