import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class DepositRequestDto {
  @ApiProperty({
    example: '1099887766',
    description: 'Número de cuenta activa de destino',
  })
  @IsString({ message: 'El número de cuenta debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de cuenta es obligatorio' })
  accountNumber: string;

  @ApiProperty({
    example: '500000.00',
    description: 'Monto a depositar (estrictamente mayor a 0)',
  })
  @IsString({ message: 'El monto debe ser una cadena numérica decimal' })
  @IsNotEmpty({ message: 'El monto del depósito es obligatorio' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'El monto debe ser un número decimal válido (ej. 500000.00)',
  })
  amount: string;
}

