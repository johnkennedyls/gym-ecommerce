import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { APP_ENV } from '../config/tokens';
import { AppEnvironment } from '../config/environment';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(APP_ENV) private readonly environment: AppEnvironment,
  ) {}

  /** RNF-03 disponibilidad: punto de sondeo para balanceadores y monitoreo. */
  @Get()
  @ApiOperation({ summary: 'Estado del servicio y de la conexión a datos' })
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde');
    }
    return {
      status: 'ok',
      service: this.environment.appName,
      environment: this.environment.nodeEnv,
      database: this.environment.database.name,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
