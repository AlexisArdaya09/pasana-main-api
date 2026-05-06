import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @ApiProperty({ description: 'ID de la persona (person.id)' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiProperty({ description: 'Nuevo número de orden del slot', example: 1 })
  @IsInt()
  @IsPositive()
  turnOrder: number;
}

export class ReorderMembersDto {
  @ApiProperty({
    type: [ReorderItemDto],
    description:
      'Lista completa de slots con su nuevo turnOrder. ' +
      'Una persona con múltiples slots debe aparecer una vez por cada slot. ' +
      'El i-ésimo slot de cada persona (ordenado por turnOrder actual) se asigna ' +
      'al i-ésimo turnOrder enviado para esa persona.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  members: ReorderItemDto[];
}
