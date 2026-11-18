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
  @ApiPropertyOptional({
    example: 'banco-bogota',
    description:
      'Slug de la institución bancaria donde el cliente abre su cuenta (opcional si viene en la URL /tenants/:slug/customers/register)',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;

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

  @ApiPropertyOptional({
    example: '1234',
    description: 'PIN numérico de 4 dígitos o contraseña para iniciar sesión en la App Móvil',
  })
  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'El PIN o contraseña debe tener al menos 4 caracteres.' })
  @MaxLength(50)
  pin?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Alias de pin (contraseña)',
  })
  @IsOptional()
  @IsString()
  password?: string;
}

