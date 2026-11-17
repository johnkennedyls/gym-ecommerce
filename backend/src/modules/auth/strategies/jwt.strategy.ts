import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppEnvironment } from '../../../config/environment';
import { APP_ENV } from '../../../config/tokens';
import { JwtPrincipal } from '../../../common/decorators/auth.decorators';

export type JwtPayload = JwtPrincipal & { type: 'access' };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(APP_ENV) environment: AppEnvironment) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: environment.jwt.accessSecret,
    });
  }

  validate(payload: JwtPayload): JwtPrincipal {
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
