import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateMemberSlotDto {
  @ApiProperty({ description: 'ID de la persona (person.id)' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiProperty({
    description: 'Número de orden del slot a actualizar (group_member.turnOrder)',
    example: 3,
  })
  @IsInt()
  @IsPositive()
  turnOrder: number;

  @ApiPropertyOptional({
    description:
      'YYYY-MM-DD. null u omitir limpia el override y vuelve al cálculo automático / cumpleaños del perfil (BIRTHDAY).',
    example: '1994-09-02',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  customDate?: string | null;
}
