import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './logger/logger.config';
import { DatabaseModule } from './database/database.module';
import { GroupModule } from './group/group.module';
import { GroupMemberModule } from './group-member/group-member.module';
import { TurnModule } from './turn/turn.module';
import { PaymentModule } from './payment/payment.module';
import { PersonModule } from './person/person.module';
import { UserAccountModule } from './user-account/user-account.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      isGlobal: true,
    }),
    WinstonModule.forRoot(winstonConfig),
    DatabaseModule,
    GroupModule,
    GroupMemberModule,
    TurnModule,
    PaymentModule,
    PersonModule,
    UserAccountModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
