import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCustomerRequestDto {
  @ApiProperty({
    example: 'Carlos Alberto Rodríguez',
    description: 'Nombre y apellidos completos del cliente',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({
    example: '1020304050',
    description: 'Documento nacional de identidad (CC, DNI, Pasaporte)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(50)
  documentNumber: string;

  @ApiProperty({
    example: 'carlos.rodriguez@email.com',
    description: 'Correo electrónico de contacto y acceso a BankOS',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: '+573001234567',
    description: 'Número de teléfono móvil',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}

