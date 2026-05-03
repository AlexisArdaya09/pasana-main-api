import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class InitializeTurnsDto {
  @ApiPropertyOptional({
    description:
      'Fecha a partir de la cual se calculan los turnos (YYYY-MM-DD). ' +
      'Si no se envía, se usa la fecha de hoy.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
