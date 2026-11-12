import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class RegisterWebhookRequestDto {
  @ApiProperty({
    description: 'URL HTTPS o HTTP del endpoint externo que recibirá las notificaciones',
    example: 'https://webhook.site/demo-bankos',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({
    description: 'Lista de eventos a los cuales se suscribe el endpoint',
    example: ['transfer.completed'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  events: string[];
}

