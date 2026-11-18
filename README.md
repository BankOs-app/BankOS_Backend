# BankOS — Backend Core Bancario Multitenant como Servicio (SaaS)

Plataforma bancaria empresarial construida sobre **NestJS**, **TypeScript (Strict Mode)**, **Drizzle ORM** y **PostgreSQL 16**, diseñada bajo principios de **Clean Architecture**, aislamiento estricto por institución (**Database-per-Tenant / Schema-per-Tenant**) y resiliencia financiera (**Idempotencia UUID v4**, **Libro Mayor / Ledger** y **Transactional Outbox**).

---

## 🏛️ Arquitectura del Sistema (Clean Architecture)

El código fuente respeta la regla de dependencias unidireccional: la capa de **Dominio** no posee dependencias de frameworks ni librerías de infraestructura.

```text
src/
├── app.controller.ts            # Health check raíz
├── app.module.ts                # Orquestación de módulos y middlewares globales
├── database/                    # Adaptadores de PostgreSQL y Esquemas Drizzle
│   ├── database.module.ts
│   ├── schema/                  # Definición de tablas relacionales Drizzle
│   └── seeds/                   # Semillas de demostración reproducible
└── modules/                     # Módulos de Dominio y Aplicación
    ├── tenants/                 # Alta y aprovisionamiento dinámico de esquemas (HU-01, HU-02)
    ├── identity/                # Autenticación OIDC, validación JWT y RBAC (HU-03)
    ├── customers/               # Fichas de clientes y usuarios vinculados (HU-04)
    ├── accounts/                # Administración de cuentas y Soft Delete (HU-05)
    ├── transactions/            # Depósitos, retiros y transferencias multimoneda (HU-07, HU-08, HU-09, HU-11)
    ├── ledger/                  # Libro mayor contable / asientos de partida doble (Ledger)
    ├── idempotency/             # Trazabilidad X-Correlation-ID y control de Idempotency-Key (HU-10)
    ├── audit/                   # Registro inmutable de acciones administrativas append-only (HU-14)
    └── webhooks/                # Notificaciones asíncronas seguras con Outbox Pattern (HU-15)
```

---

## 📋 Requisitos Previos

- **Node.js**: Versión `20.19+`, `22.12+` o superior.
- **npm**: Gestor de paquetes oficial.
- **Docker & Docker Compose**: Para orquestar PostgreSQL 16, Redis 7 y Keycloak 24.
- **Git**.

Verificar entorno:
```bash
node --version
npm --version
docker --version
docker compose version
```

---

## 🚀 Puesta en Marcha (Instalación Rápida)

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd BankOS_Backend
```

### 2. Configurar variables de entorno
Copie la plantilla de variables preconfigurada para desarrollo:
```bash
cp .env.example .env
```

### 3. Instalar dependencias exactas
```bash
npm ci
```

### 4. Iniciar infraestructura con Docker Compose
Inicia PostgreSQL 16, Redis 7 y Keycloak 24 en segundo plano con comprobaciones de estado saludables:
```bash
docker compose up postgres redis keycloak -d
```

*(Opcional: Si desea ejecutar toda la solución incluyendo el backend compilado dentro de Docker)*:
```bash
docker compose up --build
```

### 5. Sembrar Datos de Prueba (Seed Oficial)
Ejecute el script de inicialización para aprovisionar los esquemas de PostgreSQL y sembrar instituciones, clientes, cuentas con saldo y tasas de cambio:
```bash
npm run seed
```

### 6. Iniciar el servidor en modo desarrollo
```bash
npm run start:dev
```
La API estará disponible en `http://localhost:3000`.

---

## 📖 Documentación OpenAPI / Swagger

BankOS publica su especificación OpenAPI interactiva y documentada en:
👉 **`http://localhost:3000/api/docs`**

- Incluye autenticación Bearer JWT.
- Documenta encabezados obligatorios: `Idempotency-Key` (UUID) y `X-Correlation-ID`.
- Versionamiento en URL bajo el prefijo `/api/v1/...`.

---

## 🧪 Pruebas Automatizadas y Calidad

El proyecto cuenta con **89 pruebas unitarias y de integración** asociadas estrictamente a los Criterios de Aceptación (Gherkin / Given-When-Then) del Backlog Técnico:

```bash
# Ejecutar todas las suites de pruebas unitarias
npm test

# Ejecutar pruebas e2e
npm run test:e2e

# Análisis estático de código ultra-rápido (Oxlint)
npm run lint

# Compilación estricta TypeScript (Zero-Warnings)
npm run build
```

---

## 🎬 Guion de Demostración Oficial (HU-16)

Para facilitar la evaluación de los jueces, se incluye una colección lista para importar en Postman o Thunder Client:
📁 [`docs/BankOS_Demo_Postman_Collection.json`](file:///c:/Users/coder/Desktop/BankOS_Backend/docs/BankOS_Demo_Postman_Collection.json)

### Datos Sembrados para la Demo:
- **Tenant 1: Banco de Bogotá (`slug: banco-bogota`)**
  - Moneda principal: `COP`. Límite: $50,000,000 COP. Comisión fija: $2,500 COP.
  - Tasa: `1 USD = 4,000 COP`.
  - Cliente Carlos Gómez (`carlos@bogota.com`):
    - Cuenta COP `1001001001` (Saldo inicial: **$5,000,000 COP**).
    - Cuenta USD `1001001002` (Saldo inicial: **$1,500 USD**).
  - Cliente María Rodríguez (`maria@bogota.com`):
    - Cuenta COP `2002002001` (Saldo inicial: **$250,000 COP**).
- **Tenant 2: Banco Santander (`slug: banco-santander`)**
  - Moneda principal: `USD`. Comisión porcentual: 1.5%.
  - Cliente John Smith (`john@santander.com`):
    - Cuenta USD `9009009001` (Saldo inicial: **$3,500 USD**).

---

### Escenario 1: Aislamiento Multitenant Estricto (CA-HU-16-03)
1. **Acceso legítimo**: Carlos Gómez autenticado consulta su cuenta en Bogotá:
   - `GET /api/v1/tenants/banco-bogota/accounts/1001001001`
   - **Resultado**: `200 OK`, saldo $5,000,000 COP.
2. **Intento de acceso cruzado**: Carlos Gómez intenta consultar la cuenta de John Smith en Santander:
   - `GET /api/v1/tenants/banco-santander/accounts/9009009001`
   - **Resultado**: `403 Forbidden` (`TenantMatchGuard`). Ninguna institución puede conocer ni consultar datos ajenos.

---

### Escenario 2: Resiliencia e Idempotencia Absoluta (CA-HU-16-04)
1. **Primer envío**: Carlos realiza un abono a su cuenta:
   - `POST /api/v1/tenants/banco-bogota/transactions/deposits`
   - Encabezado: `Idempotency-Key: a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6`
   - Cuerpo: `{"accountNumber": "1001001001", "amount": "150000.00"}`
   - **Resultado**: `201 Created`. Saldo aumenta a $5,150,000 COP.
2. **Reintento transparente**: Simulación de reintento por pérdida momentánea de conectividad usando exactamente el mismo `Idempotency-Key`:
   - `POST /api/v1/tenants/banco-bogota/transactions/deposits` (Mismos headers y body).
   - **Resultado**: `201 Created` inmediato. El backend retorna la respuesta cacheada sin ejecutar un segundo abono. El saldo permanece en $5,150,000 COP.
3. **Detección de alteración**: Reutilizar el mismo `Idempotency-Key` con un monto modificado responde `409 Conflict`.

---

### Escenario 3: Transferencia Multimoneda con Tasas y Comisión (CA-HU-16-05)
1. **Previsualización en tiempo real**: Carlos desea transferir desde su cuenta en **USD** (`1001001002`) para que María reciba **$400,000 COP** en su cuenta (`2002002001`):
   - `POST /api/v1/tenants/banco-bogota/transactions/preview`
   - Cuerpo: `{"sourceAccountNumber": "1001001002", "destinationAccountNumber": "2002002001", "targetAmount": "400000.00"}`
   - **Resultado `200 OK`**:
     - Tasa aplicada: `4000.000000` (1 USD = 4,000 COP).
     - Equivalente en origen: `100.00 USD`.
     - Comisión fija: `2500.00 COP` (o equivalente en origen).
     - Total a debitar exacto sin afectar saldos.
2. **Confirmación y Ejecución Atómica**:
   - `POST /api/v1/tenants/banco-bogota/transactions/transfers`
   - Encabezado: `Idempotency-Key: f47ac10b-58cc-4372-a567-0e02b2c3d479`
   - **Resultado `201 Created`**:
     - Se debita la cuenta origen en USD.
     - Se acredita la cuenta destino en COP.
     - Se generan los asientos de débito y crédito en el **Ledger**.
     - Se genera automáticamente el evento en **Transactional Outbox** para notificar al webhook suscrito.
