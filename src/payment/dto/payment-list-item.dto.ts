import { ApiProperty } from '@nestjs/swagger';

export class PaymentListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'person.id' })
  participantId: string;

  @ApiProperty({ description: 'group_member.turnOrder del slot' })
  turnOrder: number;

  @ApiProperty({ enum: ['CASH', 'QR'] })
  method: 'CASH' | 'QR';

  @ApiProperty()
  amount: number;

  @ApiProperty({ nullable: true })
  paidAt: Date | null;
}
