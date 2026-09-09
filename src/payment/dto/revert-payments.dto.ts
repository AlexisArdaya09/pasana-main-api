import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BatchPaymentItemDto } from './batch-payment-item.dto';

export class RevertPaymentsDto {
  @ApiProperty({
    description:
      'ID del turno ACTIVE (cobro actual) o del siguiente turno PENDING (adelanto)',
  })
  @IsString()
  @IsNotEmpty()
  turnId: string;

  @ApiProperty({
    type: [BatchPaymentItemDto],
    description: 'Slots cuyo pago se quiere revertir',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchPaymentItemDto)
  payments: BatchPaymentItemDto[];
}
