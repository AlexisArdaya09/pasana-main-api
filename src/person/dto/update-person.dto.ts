import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePersonDto } from './create-person.dto';

/** Actualiza solo datos de persona; credenciales vía `/user-accounts`. */
export class UpdatePersonDto extends PartialType(
  OmitType(CreatePersonDto, [
    'username',
    'password',
    'passwordExpired',
  ] as const),
) {}
