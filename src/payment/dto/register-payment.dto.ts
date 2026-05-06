import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class RegisterPaymentDto {
  @ApiProperty({ description: 'ID de la persona que realiza el pago (person.id)' })
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({ description: 'ID del turno activo' })
  @IsString()
  @IsNotEmpty()
  turnId: string;

  @ApiProperty({
    description:
      'Número de orden del slot (group_member.turnOrder) que identifica cuál de los slots de la persona está pagando. ' +
      'Requerido cuando una persona tiene más de un slot en el grupo.',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  turnOrder: number;

  @ApiProperty({ description: 'Método de pago', enum: ['CASH', 'QR'], example: 'CASH' })
  @IsEnum(['CASH', 'QR'])
  method: 'CASH' | 'QR';
}
