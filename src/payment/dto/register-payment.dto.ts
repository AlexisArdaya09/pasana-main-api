import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterPaymentDto {
  @ApiProperty({ description: 'ID del participante (person) que realiza el pago' })
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({ description: 'ID del turno activo' })
  @IsString()
  @IsNotEmpty()
  turnId: string;
}
