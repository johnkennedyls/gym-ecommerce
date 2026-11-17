import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { IsNull, Repository } from 'typeorm';
import { AppEnvironment } from '../../config/environment';
import { APP_ENV } from '../../config/tokens';
import { Role, NotificationEvent } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { UsersService, toPublicUser } from '../users/users.service';
import { PasswordService } from './password.service';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../../common/services/audit.service';
import { hashToken, parseDurationMs, randomToken } from '../../common/security/tokens';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: ReturnType<typeof toPublicUser>;
};

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_ENV) private readonly environment: AppEnvironment,
    @InjectRepository(RefreshTokenEntity) private readonly refreshRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(PasswordResetToken) private readonly resetRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** RF-01 Registro de usuario. El rol siempre es CLIENT: nunca se acepta del cuerpo de la petición. */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    if (await this.usersService.findByEmail(email)) {
      throw new UnauthorizedException('El correo ya está registrado');
    }

    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      phone: dto.phone,
      birthDate: dto.birthDate,
      role: Role.CLIENT,
      passwordHash: await this.passwords.hash(dto.password),
    });

    await this.audit.record({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityName: 'users',
      entityId: user.id,
      ipAddress: meta.ip ?? null,
    });
    await this.notifications.notify(
      user.id,
      NotificationEvent.WELCOME,
      'Bienvenido a GymSoftware',
      `Hola ${user.firstName}, tu cuenta fue creada correctamente.`,
    );

    return this.issueSession(user, meta);
  }

  /** RF-02 Inicio de sesión. No revela si el fallo fue por usuario o por contraseña. */
  async login(dto: LoginDto, meta: RequestMeta): Promise<Session> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordOk = user ? await this.passwords.verify(dto.password, user.passwordHash) : false;

    if (!user || !passwordOk || !user.isActive) {
      await this.audit.record({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entityName: 'users',
        entityId: user?.id ?? null,
        details: { email: dto.email },
        ipAddress: meta.ip ?? null,
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    await this.audit.record({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityName: 'users',
      entityId: user.id,
      ipAddress: meta.ip ?? null,
    });
    return this.issueSession(user, meta);
  }

  /** RNF-01 Renovación de sesión con rotación del token de refresco. */
  async refresh(rawToken: string, meta: RequestMeta): Promise<Session> {
    const stored = await this.refreshRepository.findOne({
      where: { tokenHash: hashToken(rawToken) },
      relations: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('La sesión expiró, inicia sesión nuevamente');
    }

    stored.revokedAt = new Date();
    await this.refreshRepository.save(stored);
    return this.issueSession(stored.user, meta);
  }

  async logout(rawToken: string): Promise<void> {
    const stored = await this.refreshRepository.findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshRepository.save(stored);
    }
  }

  /** RF-01 Recuperación de contraseña. Responde igual exista o no la cuenta (anti enumeración). */
  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user && user.isActive) {
      const token = randomToken();
      await this.resetRepository.save(
        this.resetRepository.create({
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + parseDurationMs('30m')),
        }),
      );
      await this.notifications.notify(
        user.id,
        NotificationEvent.PASSWORD_RESET,
        'Recuperación de contraseña',
        `Usa este enlace para restablecer tu contraseña: ${this.environment.corsOrigin}/restablecer?token=${token}`,
      );
      await this.audit.record({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityName: 'users',
        entityId: user.id,
        ipAddress: meta.ip ?? null,
      });
    }
    return { message: 'Si el correo está registrado, recibirás instrucciones para restablecer la contraseña' };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta): Promise<{ message: string }> {
    const stored = await this.resetRepository.findOne({
      where: { tokenHash: hashToken(dto.token) },
      relations: { user: true },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('El enlace de restablecimiento no es válido o expiró');
    }

    stored.usedAt = new Date();
    await this.resetRepository.save(stored);
    await this.usersService.setPassword(stored.user, await this.passwords.hash(dto.newPassword));
    await this.revokeSessions(stored.userId);

    await this.audit.record({
      userId: stored.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entityName: 'users',
      entityId: stored.userId,
      ipAddress: meta.ip ?? null,
    });
    await this.notifications.notify(
      stored.userId,
      NotificationEvent.PASSWORD_RESET,
      'Contraseña actualizada',
      'Tu contraseña fue cambiada. Si no fuiste tú, contacta al administrador.',
    );
    return { message: 'La contraseña fue actualizada' };
  }

  /** RF-03 Cambio de contraseña autenticado. */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!(await this.passwords.verify(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    await this.usersService.setPassword(user, await this.passwords.hash(dto.newPassword));
    await this.revokeSessions(userId);
    await this.audit.record({
      userId,
      action: 'PASSWORD_CHANGED',
      entityName: 'users',
      entityId: userId,
      ipAddress: meta.ip ?? null,
    });
    return { message: 'La contraseña fue actualizada' };
  }

  private async issueSession(user: User, meta: RequestMeta): Promise<Session> {
    const accessMs = parseDurationMs(this.environment.jwt.accessExpiresIn);
    const refreshMs = parseDurationMs(this.environment.jwt.refreshExpiresIn);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      { secret: this.environment.jwt.accessSecret, expiresIn: Math.floor(accessMs / 1000) },
    );

    const refreshToken = randomToken(48);
    await this.refreshRepository.save(
      this.refreshRepository.create({
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshMs),
        userAgent: meta.userAgent ?? null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(accessMs / 1000),
      user: toPublicUser(user),
    };
  }

  private revokeSessions(userId: string): Promise<unknown> {
    return this.refreshRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
