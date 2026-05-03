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
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { ListPersonsQueryDto } from './dto/list-persons.query';

@ApiTags('Persons')
@Controller('persons')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Get()
  @ApiOperation({
    summary:
      'List active persons with user account (paginated, filterable, sortable)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list; passwords are never included',
  })
  findAll(@Query() query: ListPersonsQueryDto) {
    return this.personService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a person and linked user account by person ID',
  })
  @ApiParam({ name: 'id', description: 'Person ID' })
  @ApiResponse({
    status: 200,
    description: 'Person with nested userAccount (no password hash)',
  })
  @ApiResponse({ status: 404, description: 'Person not found' })
  findOne(@Param('id') id: string) {
    return this.personService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create person and linked user account',
    description:
      'Crea la persona (firstName, lastName, birthday, phone, email) y opcionalmente en la misma transacción la cuenta (username, password hasheada con bcrypt, passwordExpired). La contraseña nunca se devuelve. phone y email de persona son únicos; username y email de cuenta son únicos.',
  })
  @ApiResponse({ status: 201, description: 'Person and account created' })
  @ApiResponse({ status: 409, description: 'Phone, email, or username already in use' })
  create(@Body() dto: CreatePersonDto) {
    return this.personService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update person fields',
    description:
      'Actualiza firstName, lastName, birthday, phone y/o email. Todos los campos son opcionales. Para credenciales de cuenta use `/user-accounts`.',
  })
  @ApiParam({ name: 'id', description: 'Person ID' })
  @ApiResponse({ status: 200, description: 'Person updated' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  @ApiResponse({ status: 409, description: 'Phone or email already in use' })
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.personService.update(id, dto);
  }

  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete person and linked user account' })
  @ApiParam({ name: 'id', description: 'Person ID' })
  @ApiResponse({ status: 204, description: 'Permanently deleted' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  hardDelete(@Param('id') id: string) {
    return this.personService.hardDelete(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete person and linked user account' })
  @ApiParam({ name: 'id', description: 'Person ID' })
  @ApiResponse({ status: 200, description: 'Person and account soft deleted' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  softDelete(@Param('id') id: string) {
    return this.personService.softDelete(id);
  }
}
