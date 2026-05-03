import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { GroupService } from './group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups.query';
import { InitializeTurnsDto } from './dto/initialize-turns.dto';

@ApiTags('Groups')
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get()
  @ApiOperation({ summary: 'List active groups (paginated, filterable, sortable)' })
  @ApiResponse({ status: 200, description: 'Paginated list of active groups' })
  findAll(@Query() query: ListGroupsQueryDto) {
    return this.groupService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a group by ID' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(@Param('id') id: string) {
    return this.groupService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new group',
    description: 'Creates a group without dates. startDate and endDate are calculated automatically when turns are initialized.',
  })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateGroupDto) {
    return this.groupService.create(dto);
  }

  @Post(':id/initialize')
  @ApiOperation({
    summary: 'Initialize turns for a group',
    description:
      'Creates one turn per active member and activates the first one. ' +
      'Calculates and sets startDate (first turn) and endDate (last turn) on the group. ' +
      'Call this once all members have been added.',
  })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 201, description: 'Turns created, group dates calculated, first turn activated' })
  @ApiResponse({ status: 400, description: 'No members / turns already initialized' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  initializeTurns(@Param('id') id: string, @Body() dto: InitializeTurnsDto) {
    return this.groupService.initializeTurns(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  softDelete(@Param('id') id: string) {
    return this.groupService.softDelete(id);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete a group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  hardDelete(@Param('id') id: string) {
    return this.groupService.hardDelete(id);
  }
}
