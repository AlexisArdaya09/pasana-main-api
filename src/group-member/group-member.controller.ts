import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GroupMemberService } from './group-member.service';
import { AddMemberDto } from './dto/add-member.dto';

@ApiTags('Group Members')
@Controller('groups/:groupId/members')
export class GroupMemberController {
  constructor(private readonly groupMemberService: GroupMemberService) {}

  @Get()
  @ApiOperation({ summary: 'List members of a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200 })
  listMembers(@Param('groupId') groupId: string) {
    return this.groupMemberService.listMembers(groupId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a person to a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Turns already initialized' })
  @ApiResponse({ status: 409, description: 'Person already member / turnOrder taken' })
  addMember(@Param('groupId') groupId: string, @Body() dto: AddMemberDto) {
    return this.groupMemberService.addMember(groupId, dto);
  }

  @Delete(':personId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a person from a group (before initialization)' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'personId', description: 'Person ID' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 400, description: 'Turns already initialized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  removeMember(
    @Param('groupId') groupId: string,
    @Param('personId') personId: string,
  ) {
    return this.groupMemberService.removeMember(groupId, personId);
  }
}
