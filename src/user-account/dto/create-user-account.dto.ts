import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Crear cuenta standalone o para una persona sin cuenta. `personId` es opcional. */
export class CreateUserAccountDto {
  @ApiPropertyOptional({
    description: 'ID de la persona a vincular (opcional)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  personId?: string;

  @ApiProperty({ example: 'mgarcia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @ApiProperty({ example: 'mgarcia@mail.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Contraseña en texto plano; se persiste como hash bcrypt',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  passwordExpired?: boolean;
}
