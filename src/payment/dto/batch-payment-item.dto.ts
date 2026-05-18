import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class BatchPaymentItemDto {
  @ApiProperty({ description: 'ID de la persona (person.id)' })
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({
    description: 'Número de orden del slot (group_member.turnOrder)',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  turnOrder: number;
}
