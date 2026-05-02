import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserAccountService } from './user-account.service';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import { UpdateUserAccountDto } from './dto/update-user-account.dto';
import { ListUserAccountsQueryDto } from './dto/list-user-accounts.query';

@ApiTags('User accounts')
@Controller('user-accounts')
export class UserAccountController {
  constructor(private readonly userAccountService: UserAccountService) {}

  @Get()
  @ApiOperation({
    summary: 'List active user accounts (paginated, filterable, sortable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list; password hash is never returned',
  })
  findAll(@Query() query: ListUserAccountsQueryDto) {
    return this.userAccountService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user account by ID' })
  @ApiParam({ name: 'id', description: 'User account ID' })
  @ApiResponse({ status: 200, description: 'Account found (no password hash)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string) {
    return this.userAccountService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create standalone or linked user account',
    description:
      'Crea una cuenta con username, email y password (hash bcrypt). `personId` es opcional: sin él la cuenta existe sin vinculación a ninguna persona. Si se provee `personId`, la persona debe existir y no tener cuenta activa.',
  })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 404, description: 'Person not found (if personId provided)' })
  @ApiResponse({
    status: 409,
    description: 'Person already has an account, or username/email already taken',
  })
  create(@Body() dto: CreateUserAccountDto) {
    return this.userAccountService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user account',
    description:
      'Actualiza username, email, passwordExpired y/o password (se re-hashea con bcrypt). username y email son únicos entre cuentas activas. El hash nunca se expone en respuestas.',
  })
  @ApiParam({ name: 'id', description: 'User account ID' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Username or email already taken' })
  update(@Param('id') id: string, @Body() dto: UpdateUserAccountDto) {
    return this.userAccountService.update(id, dto);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete user account' })
  @ApiParam({ name: 'id', description: 'User account ID' })
  @ApiResponse({ status: 204, description: 'Permanently deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  hardDelete(@Param('id') id: string) {
    return this.userAccountService.hardDelete(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete user account' })
  @ApiParam({ name: 'id', description: 'User account ID' })
  @ApiResponse({ status: 200, description: 'Soft deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  softDelete(@Param('id') id: string) {
    return this.userAccountService.softDelete(id);
  }
}
