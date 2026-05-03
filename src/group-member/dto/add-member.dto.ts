import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ description: 'ID de la persona a agregar' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({
    description:
      'Posición en el orden de turnos (1 = primero en cobrar). ' +
      'Para grupos WEEKLY/MONTHLY determina el orden de cobro. ' +
      'Para grupos BIRTHDAY es un desempate cuando dos personas comparten fecha de nacimiento. ' +
      'Si no se envía, se asigna automáticamente al final.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  turnOrder?: number;
}
