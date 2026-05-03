import { Module } from '@nestjs/common';
import { TurnController } from './turn.controller';
import { TurnService } from './turn.service';

@Module({
  controllers: [TurnController],
  providers: [TurnService],
  exports: [TurnService],
})
export class TurnModule {}
