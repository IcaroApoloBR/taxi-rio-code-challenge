import { SetMetadata } from '@nestjs/common';
import { ActorRole } from './auth-user';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: ActorRole[]) => SetMetadata(ROLES_KEY, roles);
