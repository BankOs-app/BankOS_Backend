# BankOS Backend

API de core bancario multitenant desarrollada con NestJS, TypeScript, Drizzle ORM y PostgreSQL. Provee autenticación, administración de instituciones, clientes, cuentas, transacciones, libro mayor, auditoría y notificaciones webhook. Cada banco opera en un esquema PostgreSQL propio.

## Requisitos

- Git.
- Node.js `20.19+` o `22.12+` y npm `10+`.
- PostgreSQL `16+` y Redis `7+`, instalados localmente o ejecutados con Docker Compose.
- Docker Desktop en Windows o Docker Engine y Docker Compose en macOS/Linux, si se desea usar contenedores.

Verifica las herramientas:

```sh
node --version
npm --version
docker compose version
```

## Clonar el repositorio

Los mismos comandos funcionan en PowerShell, Terminal de macOS y Linux:

```sh
git clone https://github.com/BankOs-app/BankOS_Backend.git
cd BankOS_Backend
```

## Ejecutar con Docker Compose

Desde la raíz del repositorio, inicia PostgreSQL, Redis y la API:

```sh
docker compose up --build -d
```

La API queda disponible en `http://localhost:3000`; PostgreSQL usa el puerto `5432` y Redis el `6379`. Para revisar los registros de la API:

```sh
docker compose logs -f backend
```

Para detener los servicios sin borrar los datos:

```sh
docker compose down
```

## Ejecutar la API localmente

1. Instala las dependencias:

   ```sh
   npm ci
   ```

2. Crea `.env` desde la plantilla. En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   En macOS o Linux:

   ```sh
   cp .env.example .env
   ```

3. Inicia PostgreSQL y Redis. Para usar los contenedores incluidos sin iniciar el backend de Compose:

   ```sh
   docker compose up -d postgres redis
   ```

4. Inicia la API en modo desarrollo:

   ```sh
   npm run start:dev
   ```

La configuración de `.env.example` apunta a los servicios locales en los puertos predeterminados. Con `AUTO_SEED` activo (valor predeterminado), el backend prepara los datos de demostración al iniciar. Para cargar los datos de forma manual, ejecuta `npm run seed`.

## Configuración

Las variables principales están documentadas en `.env.example`:

| Variable | Uso | Valor local predeterminado |
|---|---|---|
| `PORT` | Puerto HTTP de la API | `3000` |
| `DATABASE_URL` | Conexión PostgreSQL | `postgres://postgres:postgres@localhost:5432/bankos_db` |
| `REDIS_HOST` / `REDIS_PORT` | Conexión Redis | `localhost:6379` |
| `JWT_SECRET` | Firma de tokens locales | Definido en `.env.example` |
| `JWT_EXPIRATION` | Vigencia del token | `3600s` |
| `AUTO_SEED` | Carga de datos de demostración al iniciar | Activo si no se establece `false` |

Usa secretos propios y cambia las credenciales predeterminadas antes de exponer cualquier entorno fuera de tu equipo.

## Estructura del proyecto

```text
src/
├── common/       Filtros, guards y utilidades compartidas
├── database/     Conexión, esquemas Drizzle, resolución de tenants y seed
└── modules/      Módulos de negocio organizados por funcionalidad
    ├── identity/       Autenticación y autorización
    ├── tenants/        Instituciones y configuración financiera
    ├── customers/      Datos de clientes
    ├── accounts/       Cuentas bancarias
    ├── transactions/   Depósitos, retiros, transferencias e historial
    ├── ledger/         Libro mayor
    ├── idempotency/    Protección contra operaciones duplicadas
    ├── audit/          Auditoría
    └── webhooks/       Endpoints y eventos de salida
test/            Pruebas de integración
docs/            Guías funcionales y colección Postman
```

Los módulos separan `domain` (reglas y entidades), `application` (casos de uso), `infrastructure` (persistencia e integraciones) y `presentation` (controladores y DTOs).

## API y autenticación

Con la API iniciada, la documentación interactiva está en `http://localhost:3000/api/docs`. Las rutas protegidas usan `Authorization: Bearer <token>`. Las operaciones financieras requieren el encabezado `Idempotency-Key` con un UUID v4.

El seed local incluye usuarios de demostración con PIN `1234` para cada banco. Úsalos solo en desarrollo local.

## Verificación

```sh
npm run build
npm test -- --runInBand
npm run test:e2e
npm run lint
```

## Repositorio relacionado

La aplicación Flutter está en [BankOS Frontend](https://github.com/BankOs-app/BankOs_Frontend). Para probar la aplicación web, inicia esta API y sigue las instrucciones de su README.
