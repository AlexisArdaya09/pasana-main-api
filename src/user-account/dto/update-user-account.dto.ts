import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserAccountDto {
  @ApiPropertyOptional({ example: 'nuevo_username' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ example: 'nuevo@mail.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description:
      'Nueva contraseña en texto plano; se reemplaza el hash almacenado',
    format: 'password',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Marcar que la contraseña caducó y debe cambiarse en el próximo login',
  })
  @IsOptional()
  @IsBoolean()
  passwordExpired?: boolean;
}
