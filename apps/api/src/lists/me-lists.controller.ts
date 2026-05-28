import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ListsService } from './lists.service';

/**
 * Current-user-scoped list endpoints. Kept on the `/me` prefix so the
 * collection route does not collide with `/lists/:listId`.
 */
@Controller('me/lists')
@UseGuards(JwtAuthGuard)
export class MeListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.listsService.findMine(user.id);
  }
}
