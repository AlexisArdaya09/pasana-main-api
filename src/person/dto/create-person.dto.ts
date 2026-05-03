import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePersonDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'García' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    description: 'Fecha de nacimiento (ISO 8601)',
    example: '1990-05-15',
  })
  @IsDateString()
  birthday: string;

  @ApiProperty({ example: '+54 9 11 1234-5678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiProperty({ example: 'mgarcia@mail.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    description: 'Username de la cuenta de usuario. Si se omite, no se crea cuenta.',
    example: 'mgarcia',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({
    description:
      'Contraseña en texto plano; se almacena como hash (bcrypt) y no se devuelve en las respuestas. Requerida si se envía username.',
    example: 'SecretP@ssw0rd',
    format: 'password',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Si es true, el cliente debe forzar cambio de contraseña en el próximo inicio de sesión',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  passwordExpired?: boolean;
}
