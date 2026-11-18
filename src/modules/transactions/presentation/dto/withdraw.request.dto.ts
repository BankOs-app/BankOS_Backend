import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class WithdrawRequestDto {
  @ApiProperty({
    description: 'Número de cuenta bancaria desde donde se retirarán los fondos',
    example: '1001234567',
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'Monto a debitar/retirar en la moneda de la cuenta (estrictamente mayor a 0)',
    example: '50.00',
  })
  @IsNumberString()
  @IsNotEmpty()
  amount: string;
}

