import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { RegisterBatchPaymentDto } from './dto/register-batch-payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register multiple payments for an active turn (same method)',
    description:
      'All-or-nothing batch for the ACTIVE turn only. Advance payments on the next PENDING turn use POST /payments.',
  })
  @ApiResponse({ status: 201, description: 'Batch processed' })
  @ApiResponse({ status: 400, description: 'Invalid payload / turn not ACTIVE' })
  @ApiResponse({ status: 404, description: 'Turn or slot not found' })
  @ApiResponse({ status: 409, description: 'Duplicate slot in batch or already paid' })
  registerBatch(@Body() dto: RegisterBatchPaymentDto) {
    return this.paymentService.registerBatchPayment(dto);
  }

  @Post()
  @ApiOperation({
    summary: 'Register a payment (active turn or advance on next pending turn)',
    description:
      'turnId = ACTIVE turn → current collection (auto-completes when fully paid). ' +
      'turnId = immediately next PENDING turn → advance payment (increments that turn totalPaidAmount; does not activate it).',
  })
  @ApiResponse({ status: 201, description: 'Payment registered' })
  @ApiResponse({
    status: 400,
    description: 'Turn is not ACTIVE nor the next PENDING / not immediate next',
  })
  @ApiResponse({ status: 404, description: 'Turn or participant not found / not a member' })
  @ApiResponse({ status: 409, description: 'Already paid for this turn' })
  register(@Body() dto: RegisterPaymentDto) {
    return this.paymentService.registerPayment(dto);
  }

  @Get('turns/:turnId')
  @ApiOperation({
    summary: 'List payments for a turn',
    description: 'Works for ACTIVE or PENDING turns (including advance payments).',
  })
  @ApiParam({ name: 'turnId', description: 'Turn ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated payment list with personId and turnOrder' })
  findByTurn(
    @Param('turnId') turnId: string,
    @Query('page') page = 0,
    @Query('size') size = 50,
  ) {
    return this.paymentService.findByTurn(turnId, Number(page), Number(size));
  }
}
