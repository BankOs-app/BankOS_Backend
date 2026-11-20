# BankOS - Backend Core Banking API

Backend de core bancario multitenant desarrollado con NestJS, TypeScript, Drizzle ORM y PostgreSQL. La plataforma implementa arquitectura limpia (Clean Architecture) con aislamiento logico por esquema de base de datos (Schema-per-Tenant), trazabilidad mediante libro mayor (Ledger), control de idempotencia y publicacion de eventos transaccionales con patron Outbox.

---

## Arquitectura del Proyecto

El sistema sigue los principios de Clean Architecture y diseno guiado por el dominio (DDD). La logica de negocio y las entidades se encuentran desacopladas de frameworks y librerias externas de persistencia o transporte.

```text
src/
├── app.controller.ts            # Verificacion de estado del servicio (health check)
├── app.module.ts                # Modulo raiz y configuracion de middlewares
├── main.ts                      # Punto de entrada, pipes globales, Swagger y CORS
├── common/                      # Filtros de excepcion, guards y decoradores compartidos
├── database/                    # Conexion a PostgreSQL y definicion de esquemas
│   ├── database.module.ts
│   ├── tenant-schema-resolver.service.ts
│   ├── schema/                  # Definicion de tablas Drizzle ORM
│   └── seeds/                   # Inicializacion y aprovisionamiento de esquemas
└── modules/
    ├── tenants/                 # Registro y aprovisionamiento dinamico de bancos
    ├── identity/                # Autenticacion, emision y validacion de tokens JWT
    ├── customers/               # Fichas de clientes y vinculacion a usuarios
    ├── accounts/                # Creacion, consulta y administracion de cuentas bancarias
    ├── transactions/            # Depositos, retiros y transferencias multidivisa
    ├── ledger/                  # Libro mayor contable con asientos de partida doble
    ├── idempotency/             # Registro y validacion de Idempotency-Key (UUID v4)
    ├── audit/                   # Registro inmutable de acciones administrativas
    └── webhooks/                # Despacho asincrono de notificaciones via Outbox
```

---

## Requisitos del Sistema

- Node.js version 20.19+ o 22.12+ (para ejecucion en produccion/desarrollo) o Node.js 24+ (para ejecucion de suites de pruebas Jest).
- npm version 10+.
- PostgreSQL version 16+.
- Redis version 7+ (utilizado para colas de mensajeria con BullMQ).
- Docker y Docker Compose (opcional, para ejecucion contenerizada de base de datos y cache).

---

## Variables de Entorno

Cree un archivo `.env` en la raiz del proyecto tomando como referencia el archivo `.env.example`:

```bash
cp .env.example .env
```

| Variable | Descripcion | Valor por defecto |
|---|---|---|
| `PORT` | Puerto de escucha del servidor HTTP | `3000` |
| `NODE_ENV` | Entorno de ejecucion (`development`, `production`, `test`) | `development` |
| `DATABASE_URL` | Cadena de conexion completa a PostgreSQL | `postgres://postgres:postgres@localhost:5432/bankos_db` |
| `DB_HOST` | Host del servidor PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de conexion a PostgreSQL | `5432` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contrasena del usuario de PostgreSQL | `postgres` |
| `DB_NAME` | Nombre de la base de datos | `bankos_db` |
| `REDIS_HOST` | Host del servidor Redis | `localhost` |
| `REDIS_PORT` | Puerto de conexion a Redis | `6379` |
| `JWT_SECRET` | Clave secreta para firma y verificacion de tokens JWT | Clave segura para entorno local |
| `JWT_EXPIRATION` | Tiempo de expiracion de los tokens generados | `3600s` |
| `AUTO_SEED` | Ejecuta inicializacion automatica de esquemas si la base de datos esta vacia | `true` |

---

## Instalacion y Puesta en Marcha

### 1. Instalacion de dependencias

```bash
npm ci
```

### 2. Inicio de servicios de base de datos y Redis

Si utiliza Docker Compose:
```bash
docker compose up postgres redis -d
```

Si utiliza PostgreSQL y Redis locales, asegurese de que ambos servicios esten iniciados y que la base de datos `bankos_db` se encuentre creada.

### 3. Aprovisionamiento de base de datos (Seed inicial)

Ejecute el script de aprovisionamiento para inicializar el catalogo central de instituciones financieras en `public.tenants` y crear los esquemas aislados de cada banco con sus 11 tablas relacionales:

```bash
npm run seed
```

### 4. Compilacion y arranque del servidor

Modo desarrollo con recarga automatica:
```bash
npm run start:dev
```

Compilacion y ejecucion en modo produccion:
```bash
npm run build
npm run start:prod
```

La API quedara disponible en `http://localhost:3000`.

---

## Modelo Multitenant (Schema-per-Tenant)

El sistema implementa separacion de datos a nivel de esquema en PostgreSQL para cumplir con normativas de seguridad y privacidad financiera:

1. **Catalogo central (`public.tenants`):**
   Almacena las instituciones registradas, su slug unico, estado de aprovisionamiento y parametros operativos (moneda base, comisiones por transaccion y limites por operacion).

2. **Esquema aislado por institucion (`tenant_<slug>`):**
   Al registrar un nuevo banco via `POST /api/v1/tenants`, el sistema crea de forma automatica su esquema fisico en PostgreSQL y aprovisiona las tablas correspondientes:
   - `users`: Credenciales, rol y estado del usuario.
   - `customers`: Informacion personal y documento de identidad del cliente.
   - `accounts`: Cuentas bancarias multimoneda asociadas al cliente.
   - `transactions`: Registro de depositos, retiros y transferencias.
   - `ledger_entries`: Asientos contables inmutables de partida doble.
   - `tenant_settings`: Parametros financieros especificos del banco.
   - `tenant_exchange_rates`: Tasas de cambio entre divisas (COP, USD, EUR).
   - `idempotency_records`: Registro de llaves de idempotencia y respuestas cacheadas.
   - `audit_logs`: Trazabilidad inmutable de acciones administrativas.
   - `webhook_endpoints`: Endpoints suscritos a eventos del banco.
   - `outbox_events`: Eventos pendientes de envio asincrono.

---

## Autenticacion y Encabezados Requeridos

### Autenticacion
Las rutas protegidas requieren un encabezado de autorizacion HTTP:
```text
Authorization: Bearer <token_jwt>
```
El token se obtiene mediante el endpoint `POST /api/v1/identity/login`.

### Idempotencia Financiera
Las operaciones de deposito, retiro y transferencia requieren obligatoriamente el envio de una llave de idempotencia en los encabezados HTTP:
```text
Idempotency-Key: <UUID_v4>
```
Si una peticion con la misma llave y mismo cuerpo se reenvia (por reintento de red), el servidor responde con la transaccion original sin duplicar cargos ni abonos. Si se reenvia la misma llave con datos distintos, el sistema retorna un error `409 Conflict`.

### Trazabilidad de Logs
Opcionalmente se puede incluir un identificador de correlacion para rastreo en logs:
```text
X-Correlation-ID: <UUID_v4>
```

---

## Datos Iniciales de Prueba en Entorno Local

El script de seed configura las siguientes instituciones y cuentas iniciales:

- **Bancolombia (slug: `banco-lombia`):**
  - Moneda principal: COP.
  - Administrador: `admin@bancolombia.com` / PIN: `1234`.
  - Administrador de plataforma: `admin@bankos.com` / PIN: `1234`.
  - Cliente: `cliente@bancolombia.com` / PIN: `1234`.
  - Cuenta de prueba: `7007007001` (COP).

- **Banco de Bogota (slug: `banco-bogota`):**
  - Moneda principal: COP.
  - Administrador: `admin@bogota.com` / PIN: `1234`.
  - Cliente: `carlos@bogota.com` / PIN: `1234`.
  - Cuentas de prueba: `1001001001` (COP), `1001001002` (USD).

- **Banco Santander (slug: `banco-santander`):**
  - Moneda principal: USD.
  - Administrador: `admin@santander.com` / PIN: `1234`.
  - Cliente: `john@santander.com` / PIN: `1234`.
  - Cuenta de prueba: `9009009001` (USD).

- **Banco de NU (slug: `banco-nu`):**
  - Moneda principal: COP.
  - Administrador: `admin@nu.com` / PIN: `1234`.
  - Cliente: `cliente@nu.com` / PIN: `1234`.
  - Cuenta de prueba: `8008008001` (COP).

---

## Documentacion OpenAPI (Swagger)

Una vez iniciado el servidor, la documentacion interactiva de endpoints y esquemas se encuentra disponible en:

```text
http://localhost:3000/api/docs
```

La especificacion en formato JSON puede consultarse en:
```text
http://localhost:3000/api/docs-json
```

---

## Pruebas Automatizadas

```bash
# Ejecutar todas las pruebas unitarias y de integracion
npm test

# Ejecutar pruebas end-to-end
npm run test:e2e

# Analisis estatico de codigo
npm run lint

# Verificacion de compilacion TypeScript
npm run build
```
