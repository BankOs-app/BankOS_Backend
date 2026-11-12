import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { AccountStatus } from '../../domain/value-objects/account-status.enum';

export class UpdateAccountStatusRequestDto {
  @ApiProperty({
    enum: AccountStatus,
    example: AccountStatus.BLOCKED,
    description:
      'Nuevo estado de la cuenta: ACTIVE (operativa), BLOCKED (bloqueada) o INACTIVE (borrado lógico / soft delete)',
  })
  @IsEnum(AccountStatus, {
    message: 'El estado debe ser ACTIVE, BLOCKED o INACTIVE',
  })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  status: AccountStatus;
}

