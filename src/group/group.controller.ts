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

@ApiTags('Groups')
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get()
  @ApiOperation({
    summary: 'List active groups (paginated, filterable, sortable)',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of active groups' })
  findAll(@Query() query: ListGroupsQueryDto) {
    return this.groupService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a group by ID' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group found' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findOne(@Param('id') id: string) {
    return this.groupService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  @ApiResponse({ status: 201, description: 'Group created' })
  create(@Body() dto: CreateGroupDto) {
    return this.groupService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a group' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a group (logical)' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 204, description: 'Group soft deleted' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  softDelete(@Param('id') id: string) {
    return this.groupService.softDelete(id);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete a group (physical)' })
  @ApiParam({ name: 'id', description: 'Group ID' })
  @ApiResponse({ status: 204, description: 'Group permanently deleted' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  hardDelete(@Param('id') id: string) {
    return this.groupService.hardDelete(id);
  }
}
