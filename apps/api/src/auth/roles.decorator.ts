import { SetMetadata } from '@nestjs/common';

export const ROLES_METADATA_KEY = 'fictrio:roles';

/**
 * Restricts a route to the listed role codes. Must be paired with
 * `JwtAuthGuard` (which populates `request.user`) followed by `RolesGuard`,
 * e.g. `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ROLE_MODERATOR)`.
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
