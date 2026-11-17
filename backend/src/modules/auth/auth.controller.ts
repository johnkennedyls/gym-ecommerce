import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { THROTTLE } from '../../config/throttle';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { User } from '../users/entities/user.entity';
import { toPublicUser } from '../users/users.service';

type RequestWithMeta = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
};

const metaOf = (req: RequestWithMeta) => ({
  ip: req.ip ?? null,
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
});

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: THROTTLE.register })
  @ApiOperation({ summary: 'RF-01 Registro de usuario' })
  register(@Body() dto: RegisterDto, @Req() req: RequestWithMeta) {
    return this.authService.register(dto, metaOf(req));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: THROTTLE.login })
  @ApiOperation({ summary: 'RF-02 Inicio de sesión' })
  login(@Body() dto: LoginDto, @Req() req: RequestWithMeta) {
    return this.authService.login(dto, metaOf(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'RF-02 Renovar sesión' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: RequestWithMeta) {
    return this.authService.refresh(dto.refreshToken, metaOf(req));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'RF-02 Cierre de sesión' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: THROTTLE.recovery })
  @ApiOperation({ summary: 'RF-01 Solicitud de recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: RequestWithMeta) {
    return this.authService.forgotPassword(dto, metaOf(req));
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: THROTTLE.recovery })
  @ApiOperation({ summary: 'RF-01 Restablecer contraseña con token' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: RequestWithMeta) {
    return this.authService.resetPassword(dto, metaOf(req));
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'RF-03 Cambiar contraseña autenticado' })
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto, @Req() req: RequestWithMeta) {
    return this.authService.changePassword(user.id, dto, metaOf(req));
  }

  @Get('session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'RF-02 Estado de la sesión autenticada' })
  session(@CurrentUser() user: User) {
    return toPublicUser(user);
  }
}
