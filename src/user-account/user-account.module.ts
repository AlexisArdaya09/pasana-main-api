import { Module } from '@nestjs/common';
import { UserAccountController } from './user-account.controller';
import { UserAccountService } from './user-account.service';

@Module({
  controllers: [UserAccountController],
  providers: [UserAccountService],
})
export class UserAccountModule {}
