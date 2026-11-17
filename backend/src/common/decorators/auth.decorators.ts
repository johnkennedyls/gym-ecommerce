import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../enums';
import { User } from '../../modules/users/entities/user.entity';

export const ROLES_KEY = 'gymsoftware:roles';

/** Restringe un endpoint a los roles indicados (RNF-01 autorización). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type JwtPrincipal = {
  sub: string;
  email: string;
  role: Role;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): User => context.switchToHttp().getRequest().user,
);

export const CurrentPrincipal = createParamDecorator(
  (_: unknown, context: ExecutionContext): JwtPrincipal => context.switchToHttp().getRequest().user,
);
