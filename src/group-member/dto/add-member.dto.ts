import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Fecha personalizada para este slot (YYYY-MM-DD). ' +
      'BIRTHDAY: reemplaza person.birthday como base para calcular el próximo cumpleaños. ' +
      'WEEKLY/MONTHLY: se usa directamente como scheduledDate de este turno, ignorando el orden automático. ' +
      'Si no se envía, se usa la fecha de nacimiento de la persona (BIRTHDAY) o el cálculo automático desde startDate.',
    example: '1994-09-02',
  })
  @IsOptional()
  @IsDateString()
  customDate?: string;
}
