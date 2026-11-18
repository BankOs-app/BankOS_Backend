import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para la petición HTTP de creación de un Tenant.
 *
 * Incluye validaciones mediante class-validator y metadatos de Swagger.
 */
export class CreateTenantRequestDto {
  @ApiProperty({
    description: 'Nombre comercial o razón social de la institución financiera',
    example: 'Banco de Bogotá',
    minLength: 3,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la institución es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  name: string;

  @ApiProperty({
    description:
      'Identificador único (slug) para el tenant, usado en URLs y nombres de esquema',
    example: 'banco-bogota',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El slug debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El slug es obligatorio' })
  @MinLength(3, { message: 'El slug debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El slug no puede exceder los 50 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'El slug solo permite caracteres alfanuméricos en minúscula separados por guiones simples',
  })
  slug: string;
}

