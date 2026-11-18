import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';

export class CreateAccountRequestDto {
  @ApiProperty({
    example: 'd9b2d63d-a233-4123-85b4-d5395a1a1139',
    description: 'UUID del cliente titular de la cuenta dentro del tenant',
  })
  @IsUUID('4', { message: 'El customerId debe ser un UUID válido versión 4' })
  @IsNotEmpty({ message: 'El customerId es obligatorio' })
  customerId: string;

  @ApiProperty({
    enum: Currency,
    example: Currency.COP,
    description: 'Divisa en la que operará la cuenta (COP, USD, EUR)',
  })
  @IsEnum(Currency, {
    message: 'La divisa debe ser una de las soportadas: COP, USD, EUR',
  })
  @IsNotEmpty({ message: 'La divisa es obligatoria' })
  currency: Currency;

  @ApiPropertyOptional({
    example: '1092837465',
    description:
      'Número de cuenta único opcional. Si se omite, el sistema genera automáticamente uno de 10 dígitos',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6,20}$/, {
    message: 'El número de cuenta debe contener entre 6 y 20 dígitos numéricos',
  })
  accountNumber?: string;

  @ApiPropertyOptional({
    example: '0.00',
    description: 'Saldo inicial de la cuenta (no puede ser negativo)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'El saldo inicial debe ser un número decimal válido (ej. 100.00)',
  })
  initialBalance?: string;
}

