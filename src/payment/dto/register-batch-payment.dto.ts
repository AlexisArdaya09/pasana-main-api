import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BatchPaymentItemDto } from './batch-payment-item.dto';

export class RegisterBatchPaymentDto {
  @ApiProperty({ description: 'ID del turno activo' })
  @IsString()
  @IsNotEmpty()
  turnId: string;

  @ApiProperty({ description: 'Método de pago (único para todo el lote)', enum: ['CASH', 'QR'], example: 'CASH' })
  @IsEnum(['CASH', 'QR'])
  method: 'CASH' | 'QR';

  @ApiProperty({
    type: [BatchPaymentItemDto],
    description: 'Slots pendientes a cobrar en este turno',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchPaymentItemDto)
  payments: BatchPaymentItemDto[];
}
