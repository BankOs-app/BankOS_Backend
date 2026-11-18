import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class PreviewTransferRequestDto {
  @ApiProperty({
    description: 'Número de cuenta de origen desde donde saldrán los fondos',
    example: '1001234567',
  })
  @IsString()
  @IsNotEmpty()
  sourceAccountNumber: string;

  @ApiProperty({
    description: 'Número de cuenta de destino que recibirá los fondos',
    example: '2009876543',
  })
  @IsString()
  @IsNotEmpty()
  destinationAccountNumber: string;

  @ApiProperty({
    description: 'Monto exacto que debe recibir la cuenta destino (estrictamente mayor a 0)',
    example: '100.00',
  })
  @IsNumberString()
  @IsNotEmpty()
  targetAmount: string;
}

