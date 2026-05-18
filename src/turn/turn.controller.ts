import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TurnService } from './turn.service';
import { ListTurnsQueryDto } from './dto/list-turns.query';

@ApiTags('Turns')
@Controller()
export class TurnController {
  constructor(private readonly turnService: TurnService) {}

  @Get('groups/:groupId/turns')
  @ApiOperation({ summary: 'List turns for a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Paginated list of turns' })
  findAll(@Param('groupId') groupId: string, @Query() query: ListTurnsQueryDto) {
    return this.turnService.findAll(groupId, query);
  }

  @Get('turns/:id')
  @ApiOperation({ summary: 'Get a turn by ID' })
  @ApiParam({ name: 'id', description: 'Turn ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(@Param('id') id: string) {
    return this.turnService.findOne(id);
  }

  @Get('turns/:id/summary')
  @ApiOperation({
    summary: 'Get full turn summary',
    description:
      'ACTIVE turn: participantsPaid/Pending, nextTurn, participantsAdvancePaid. Other statuses: paid/pending for that turn only.',
  })
  @ApiParam({ name: 'id', description: 'Turn ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getSummary(@Param('id') id: string) {
    return this.turnService.getTurnSummary(id);
  }

  @Post('turns/:id/complete')
  @ApiOperation({
    summary: 'Manually complete a turn (admin)',
    description:
      'Force-completes a turn if totalPaidAmount >= totalExpectedAmount. Activates the next PENDING turn.',
  })
  @ApiParam({ name: 'id', description: 'Turn ID' })
  @ApiResponse({ status: 201, description: 'Turn completed' })
  @ApiResponse({ status: 400, description: 'Not fully paid or wrong status' })
  completeTurn(@Param('id') id: string) {
    return this.turnService.completeTurnIfReady(id);
  }
}
