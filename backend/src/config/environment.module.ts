import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppEnvironment, loadEnvironment } from './environment';
import { APP_ENV } from './tokens';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] })],
  providers: [
    {
      provide: APP_ENV,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AppEnvironment =>
        loadEnvironment((key) => config.get<string>(key)),
    },
  ],
  exports: [APP_ENV],
})
export class EnvironmentModule {}
