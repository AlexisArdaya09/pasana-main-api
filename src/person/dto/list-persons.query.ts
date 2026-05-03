import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PersonSortBy {
  CREATED_AT = 'createdAt',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListPersonsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro parcial por nombre (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Filtro parcial por apellido (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: PersonSortBy, default: PersonSortBy.CREATED_AT })
  @IsOptional()
  @IsEnum(PersonSortBy)
  sortBy?: PersonSortBy = PersonSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ default: 0, minimum: 0, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number = 0;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 10;
}
