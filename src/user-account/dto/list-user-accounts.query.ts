import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UserAccountSortBy {
  CREATED_AT = 'createdAt',
  USERNAME = 'username',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListUserAccountsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro parcial por nombre de usuario (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    enum: UserAccountSortBy,
    default: UserAccountSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(UserAccountSortBy)
  sortBy?: UserAccountSortBy = UserAccountSortBy.CREATED_AT;

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
