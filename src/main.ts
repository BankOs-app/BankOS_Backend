import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Punto de entrada principal de la aplicación NestJS (BankOS Core Banking).
 *
 * En este archivo se realiza el "bootstrap" (arranque) del servidor HTTP:
 * 1. Inicialización de la instancia de NestJS con el módulo raíz (AppModule).
 * 2. Configuración de CORS para permitir peticiones desde frontends web/móviles.
 * 3. Asignación del prefijo global de API ('api/v1') con exclusión para Swagger y la raíz.
 * 4. Configuración del ValidationPipe global con class-validator para sanear y validar payloads DTO.
 * 5. Generación de la documentación interactiva Swagger/OpenAPI en '/api/docs'.
 * 6. Vinculación y escucha en el puerto configurado (por defecto 3000).
 */
async function bootstrap() {
  // Crea la aplicación NestJS utilizando el módulo raíz AppModule
  const app = await NestFactory.create(AppModule);

  // Habilita Cross-Origin Resource Sharing (CORS) para que aplicaciones web de otros dominios puedan consumir la API
  app.enableCors();

  // Define el prefijo global 'api/v1' para versionamiento REST.
  // Se excluyen las rutas raíz ('/') y la documentación de Swagger ('api/docs') para fácil acceso.
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'api/docs', 'api/docs-json'],
  });

  // Pipe global de validación:
  // - whitelist: true -> descarta automáticamente campos no definidos en los DTOs (evita inyección de datos basura).
  // - forbidNonWhitelisted: true -> responde con error 400 Bad Request si envían propiedades prohibidas.
  // - transform: true -> convierte automáticamente los payloads JSON a instancias de sus respectivas clases DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuración de OpenAPI / Swagger para documentación y pruebas interactivas en vivo
  const config = new DocumentBuilder()
    .setTitle('BankOS API')
    .setDescription(
      'BankOS — Sistema Bancario Multitenant como Servicio (Backend Core Banking API).\n\n' +
      'Permite administrar bancos (tenants), clientes, cuentas multimoneda (COP/USD), ' +
      'depósitos, retiros, transferencias con conversión cambiaria, trazabilidad de ledger, ' +
      'auditoría inmutable y webhooks transaccionales.',
    )
    .setVersion('1.0')
    // Autenticación JWT Bearer en el botón "Authorize" de Swagger
    .addBearerAuth()
    // Headers requeridos para operaciones financieras seguras
    .addApiKey(
      { type: 'apiKey', name: 'Idempotency-Key', in: 'header', description: 'UUID v4 para prevenir transacciones duplicadas' },
      'Idempotency-Key',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Correlation-ID', in: 'header', description: 'ID de correlación para trazabilidad distribuida de logs' },
      'X-Correlation-ID',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Obtiene el puerto desde las variables de entorno (.env) o usa el 3000 por defecto
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

// Inicia el proceso de arranque
void bootstrap();
