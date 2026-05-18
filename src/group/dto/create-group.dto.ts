import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DeliveryDateStrategy } from './delivery-date-strategy';

export enum Frequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  BIRTHDAY = 'BIRTHDAY',
}

export { DeliveryDateStrategy };

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

  @ApiPropertyOptional({
    description: 'Monto que cada participante aporta por turno. Puede establecerse luego con PATCH.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  contributionAmount?: number;

  @ApiProperty({
    enum: DeliveryDateStrategy,
    description:
      'Regla para calcular la fecha límite de entrega del aporte (deliveryDate) respecto al turno del beneficiario.',
    example: DeliveryDateStrategy.DAYS_BEFORE,
  })
  @IsEnum(DeliveryDateStrategy)
  deliveryDateStrategy: DeliveryDateStrategy;

  @ApiPropertyOptional({
    description:
      'Días de antelación respecto a scheduledDate. Requerido si deliveryDateStrategy = DAYS_BEFORE.',
    minimum: 1,
    maximum: 365,
    example: 2,
  })
  @ValidateIf((o) => o.deliveryDateStrategy === DeliveryDateStrategy.DAYS_BEFORE)
  @IsInt()
  @Min(1)
  @Max(365)
  deliveryDaysBefore?: number;
}
