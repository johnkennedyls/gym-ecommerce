import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '../enums';
import { JwtPrincipal, ROLES_KEY } from '../decorators/auth.decorators';
import { User } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  /** Resuelve el usuario desde la base de datos para que un cambio de rol o una desactivación surtan efecto de inmediato. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = (await super.canActivate(context)) as boolean;
    if (!allowed) throw new UnauthorizedException('Credenciales inválidas o expiradas');

    const request = context.switchToHttp().getRequest();
    const principal = request.user as JwtPrincipal;
    const user = await this.usersService.findByIdForAuth(principal.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('La cuenta no está activa');
    }
    request.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as User;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('No tiene permisos para ejecutar esta operación');
    }
    return true;
  }
}
