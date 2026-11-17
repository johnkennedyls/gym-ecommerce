import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppEnvironment } from '../../config/environment';
import { APP_ENV } from '../../config/tokens';

/** RNF-01: las contraseñas se guardan con hash bcrypt; nunca en texto plano. */
@Injectable()
export class PasswordService {
  private readonly rounds: number;

  constructor(@Inject(APP_ENV) environment: AppEnvironment) {
    this.rounds = environment.nodeEnv === 'test' ? 4 : 12;
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
