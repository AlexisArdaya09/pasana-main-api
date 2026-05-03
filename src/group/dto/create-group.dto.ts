import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export enum Frequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  BIRTHDAY = 'BIRTHDAY',
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Pasanaco Enero 2025' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Grupo de ahorro mensual del equipo' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: Frequency, example: Frequency.MONTHLY })
  @IsEnum(Frequency)
  frequency: Frequency;

  @ApiProperty({
    description: 'Monto que cada participante aporta por turno',
    example: 1000,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  contributionAmount: number;
}
