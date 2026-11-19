# BankOS — Sistema Bancario Multitenant como Servicio

---

## Contexto del Reto

Los bancos pequeños, cooperativas de ahorro y fintechs emergentes en la región carecen de la infraestructura tecnológica y el capital para desarrollar sistemas bancarios propios desde cero. El reto de esta hackatón (diseñada para 10 horas de desarrollo intensivo en equipos de 5 personas) consiste en construir **BankOS**: una plataforma bancaria en la nube (Backend + Aplicación Móvil) donde **cada institución financiera opere como un tenant independiente**, con sus propios clientes, productos, divisas y reglas de negocio totalmente aislados.

---

## Requerimientos Técnicos y de Negocio

### 1. Backend & Arquitectura

---

#### A. Gestión de Tenants & Aislamiento

**Registro de Tenants**
Endpoints para dar de alta nuevos tenants con nombre, identificador único (slug/ID) y configuración inicial.

**Aislamiento Estricto**
Cada tenant debe operar en su propio espacio de datos. Ningún tenant puede consultar, modificar o conocer la existencia de datos de otro bajo ninguna circunstancia.

**Configuración por Tenant**
Cada institución debe poder parametrizar de forma independiente:
- Límite máximo de dinero permitido por transacción
- Comisión fija o porcentual aplicada a transferencias salientes
- Moneda principal de operación (ej. COP, USD, EUR)
- Tabla estática de tasas de cambio para conversión de divisas

**Webhooks de Notificación**
El tenant debe poder configurar un endpoint de Webhook. El sistema backend debe disparar una petición HTTP POST asíncrona a dicho Webhook cada vez que ocurra un evento crítico (ej. transferencia recibida con éxito).

---

#### B. Autenticación, Autorización y Seguridad

**Ámbito de Usuario**
Los usuarios pertenecen obligatoriamente a un tenant específico y solo pueden autenticarse y operar dentro de él.

**Tokens de Sesión**
El token (JWT o similar) debe incluir de forma segura los claims de `tenant_id`, `user_id` y `role`.

**Roles del Sistema**

| Rol | Permisos |
| :--- | :--- |
| `administrador` | Crear cuentas, modificar configuraciones del tenant, auditar logs y consultar todas las operaciones de la institución |
| `cliente` | Consultar y operar únicamente sobre las cuentas de las cuales es titular |

**Rate Limiting**
Implementar un mecanismo de límite de peticiones por dirección IP y por cuenta de usuario en los endpoints de autenticación y transacciones financieras para mitigar ataques de fuerza bruta o denegación de servicio.

**Registro de Auditoría Inmutable**
Todas las acciones administrativas (cambios de límites, desactivación de cuentas, creación de usuarios) deben registrarse en una tabla/colección de solo lectura, indicando fecha, usuario, acción y estado anterior/nuevo.

---

#### C. Gestión de Cuentas Bancarias

**Creación de Cuentas**
Vinculación de cuentas a clientes específicos dentro del tenant.

**Atributos de Cuenta**
Cada cuenta debe contener: identificador único (número de cuenta), ID del titular, saldo actual, moneda, estado y fecha de creación.

**Soft Delete**
La desactivación de una cuenta no debe eliminar físicamente el registro. Debe cambiar su estado a `inactiva` o `bloqueada` mediante borrado lógico para asegurar la integridad referencial histórica. No se permite ninguna operación financiera sobre una cuenta inactiva.

---

#### D. Operaciones Financieras y Multimoneda

**Depósito**
Abonar fondos a una cuenta propia. Validar que la cuenta esté activa y el monto sea estrictamente positivo.

**Retiro**
Debitar fondos de una cuenta. Validar que la cuenta esté activa, el monto sea positivo y el saldo sea suficiente.

**Transferencia Interna**
Mover fondos entre dos cuentas del mismo tenant. Validar existencia, estados activos de ambas cuentas y fondos suficientes en el origen. Aplicar automáticamente la comisión configurada por el tenant.

**Soporte Multimoneda con Tasas Estáticas**
Si la cuenta de origen y la de destino manejan divisas diferentes (ej. origen en USD y destino en COP), el backend debe aplicar la conversión monetaria utilizando la tabla de tasas estáticas configurada por el tenant antes de realizar el débito y crédito correspondientes.

---

#### E. Idempotencia y Trazabilidad ⚠️ Obligatorio

**Manejo de Idempotencia**
Todas las operaciones mutables (depósitos, retiros y transferencias) deben requerir obligatoriamente el encabezado `Idempotency-Key` (UUID generado en el cliente).

**Lógica de Control**
- Si la clave ya fue procesada con éxito, retornar exactamente el mismo cuerpo de respuesta y código de estado original, sin volver a ejecutar el proceso financiero.
- Si la operación se encuentra en ejecución concurrente, responder inmediatamente con un código de error semántico (ej. `409 Conflict` o `423 Locked`) indicando que la transacción está en curso.
- La clave de idempotencia se asocia de forma estricta al par `tenant_id` + `user_id` y expira automáticamente pasadas las 24 horas.

**X-Correlation-ID**
Todas las peticiones deben llevar un encabezado de trazabilidad `X-Correlation-ID`. Este identificador único debe ser propagado en todos los logs internos del backend y devuelto en la respuesta HTTP para facilitar el rastreo de fallos en producción.

---

#### F. Historial de Transacciones

**Registro Detallado**
Cada transacción debe persistirse con: tipo de operación, monto original, monto convertido (si aplica), tasa de cambio aplicada, comisión cobrada, cuentas involucradas, marca de tiempo, estado (Éxito/Error) y la `Idempotency-Key` utilizada.

**Paginación Obligatoria**
Los endpoints de historial deben implementar paginación obligatoria basada en límites/offsets o cursores, soportando filtros avanzados por rangos de fechas y tipo de operación.

---

#### G. API General

**Consistencia**
Respuestas estandarizadas para flujos de éxito y error con una estructura única que incluya código interno y descripción.

**Versionamiento**
La API debe estar versionada en la URL desde la primera entrega (ej. `/api/v1/...`).

---

### 2. Aplicación Móvil

---

#### A. Autenticación y Seguridad Local

**Ingreso por Tenant**
El inicio de sesión debe requerir las credenciales del usuario y el identificador/slug del tenant al que pertenece.

**Persistencia**
Almacenamiento seguro del token de sesión mientras este sea válido.

**Doble Factor Local (PIN o Biometría)**
Antes de confirmar una transferencia o retiro, la aplicación debe solicitar una confirmación de seguridad adicional (PIN de 4 dígitos o autenticación biométrica simulada) para autorizar la transacción.

---

#### B. Gestión Visual de Cuentas

**Dashboard**
Visualización clara de las cuentas del cliente, reflejando saldos y estados en tiempo real.

---

#### C. Flujos de Operación y Resiliencia de Red

**Formularios Dinámicos**
Pantallas específicas para depósitos, retiros y transferencias, buscando la cuenta destino por su identificador único.

**Pantalla de Resumen Pre-Transacción**
Antes del envío final, el usuario debe aprobar un desglose exacto que muestre:
- Monto a debitar
- Comisión calculada
- Tasa de cambio aplicada (si hay conversión)
- Monto final que recibirá el destino
- Monedas implicadas

**Reintento Transparente en Red**
Al confirmar, la app genera el `Idempotency-Key` y el `X-Correlation-ID`. Si la petición falla por pérdida momentánea de conectividad, la aplicación debe reintentar automáticamente o mediante un botón visible usando **exactamente las mismas llaves** generadas inicialmente, demostrando la robustez del sistema.

---

#### D. Historial Visual

**Filtros Interactivos**
Consulta de transacciones con filtrado rápido por tipo: depósito, retiro o transferencia.

**Alertas Visuales de Costo**
Resaltar visualmente en el listado las transacciones que hayan generado cobro de comisiones o conversión de divisas, mediante etiquetas o colores de contraste.

---

## Entregables

Al finalizar las 10 horas, cada equipo debe proveer:

1. **Código Fuente Completo** — Enlace a un repositorio organizado con el código del backend y el proyecto de la aplicación móvil.
2. **Documentación de la API** — Colección de Postman, Thunder Client, archivo OpenAPI/Swagger o equivalente que describa los flujos de la API versión 1.
3. ** Docker Compose** — Un archivo `docker-compose.yml` en la raíz del proyecto backend que permita levantar la aplicación, la base de datos y los servicios de caché/idempotencia con un único comando (`docker-compose up --build`).
4. **Demostración en Vivo** — Presentación funcional ante los jueces donde se evidencien obligatoriamente los siguientes escenarios críticos:
   - Dos tenants operando en paralelo sin cruce de datos
   - Una petición de transferencia interrumpida y reintentada con la misma `Idempotency-Key`, demostrando que no hay doble cobro
   - Una transferencia multimoneda aplicando la tasa estática del tenant y el cobro de la comisión parametrizada