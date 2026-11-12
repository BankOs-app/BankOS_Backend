import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Currency } from '../../domain/value-objects/currency.enum';

export class SetExchangeRateRequestDto {
  @ApiProperty({
    description: 'Moneda base de la conversión (1 unidad de esta moneda)',
    enum: Currency,
    example: Currency.USD,
  })
  @IsEnum(Currency, {
    message: 'La moneda origen debe ser una de las admitidas: COP, USD, EUR',
  })
  @IsNotEmpty({ message: 'La moneda origen es obligatoria' })
  fromCurrency: Currency;

  @ApiProperty({
    description: 'Moneda cotizada o de destino',
    enum: Currency,
    example: Currency.COP,
  })
  @IsEnum(Currency, {
    message: 'La moneda destino debe ser una de las admitidas: COP, USD, EUR',
  })
  @IsNotEmpty({ message: 'La moneda destino es obligatoria' })
  toCurrency: Currency;

  @ApiProperty({
    description:
      'Tasa de cambio: unidades de moneda destino equivalentes a 1 unidad de moneda origen (estrictamente mayor a 0)',
    example: '4000.50',
  })
  @IsString({
    message: 'La tasa de cambio debe enviarse como cadena numérica',
  })
  @IsNotEmpty({ message: 'La tasa de cambio es obligatoria' })
  @Matches(/^\d+(\.\d{1,6})?$/, {
    message:
      'La tasa de cambio debe ser un número decimal positivo con hasta 6 decimales',
  })
  rate: string;
}

