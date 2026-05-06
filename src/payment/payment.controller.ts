import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a payment for a participant in an active turn',
    description:
      'Validates participant membership, prevents duplicate payments, updates totalPaidAmount atomically (FOR UPDATE lock). Auto-completes the turn and activates the next one when fully paid.',
  })
  @ApiResponse({ status: 201, description: 'Payment registered' })
  @ApiResponse({ status: 400, description: 'Turn is not ACTIVE' })
  @ApiResponse({ status: 404, description: 'Turn or participant not found / not a member' })
  @ApiResponse({ status: 409, description: 'Already paid for this turn' })
  register(@Body() dto: RegisterPaymentDto) {
    return this.paymentService.registerPayment(dto);
  }

  @Get('turns/:turnId')
  @ApiOperation({ summary: 'List payments for a turn' })
  @ApiParam({ name: 'turnId', description: 'Turn ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200 })
  findByTurn(
    @Param('turnId') turnId: string,
    @Query('page') page = 0,
    @Query('size') size = 50,
  ) {
    return this.paymentService.findByTurn(turnId, Number(page), Number(size));
  }
}
