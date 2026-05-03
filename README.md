# Pasana Main API

REST API principal del proyecto Pasana. Construida con NestJS, Drizzle ORM y PostgreSQL (Supabase).

## Stack

- **Runtime:** Node.js
- **Framework:** NestJS 10
- **Lenguaje:** TypeScript
- **ORM:** Drizzle ORM
- **Base de datos:** PostgreSQL (Supabase)
- **Compilador:** SWC (builds más rápidos que tsc)
- **Logger:** Winston + nest-winston
- **Docs:** Swagger / OpenAPI
- **Deploy:** Render

---

## Estructura del proyecto

```
src/
├── common/
│   └── pagination/
│       └── offset-page.ts          # OffsetPage<T> + createOffsetPage
├── database/
│   ├── schema/
│   │   ├── base/
│   │   │   ├── base.schema.ts      # Columnas compartidas (id, timestamps, deletedAt)
│   │   │   └── base.types.ts       # BaseTableType interface
│   │   ├── enums.ts                # Enums PostgreSQL: frequency, group_status, turn_status…
│   │   ├── group/                  # Tabla group
│   │   ├── group-member/           # Tabla group_member
│   │   ├── turn/                   # Tabla turn
│   │   ├── payment/                # Tabla payment
│   │   ├── person/                 # Tabla person
│   │   ├── user-account/           # Tabla user_account
│   │   └── index.ts
│   ├── migrations/                 # Archivos SQL generados por drizzle-kit
│   ├── database.module.ts
│   ├── drizzle.config.ts
│   ├── migrate.ts
│   └── seed.ts
├── group/
├── group-member/
├── turn/
├── payment/
├── person/
├── user-account/
├── health/
├── logger/
├── app.module.ts
└── main.ts
```

---

## Configuración inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

```env
DB_HOST=aws-1-us-west-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.<project-ref>
DB_PASSWORD=tu-password

PORT=3000
NODE_ENV=development
```

### 3. Aplicar migraciones

```bash
npm run db:migrate
```

### 4. Levantar el servidor

```bash
npm run start:dev
```

---

## Scripts

### Desarrollo

```bash
npm run start:dev       # Servidor con hot-reload
npm run start:debug     # Servidor con debugger
```

### Build

```bash
npm run build           # Compilación SWC
```

### Migraciones y base de datos

```bash
npm run db:generate --name=<nombre>  # Generar migración SQL
npm run db:migrate                   # Aplicar migraciones (dev)
npm run db:migrate:prod              # Aplicar migraciones (prod)
npm run db:push                      # Sincronizar schema directo (solo dev)
npm run db:studio                    # Drizzle Studio (UI)
npm run db:seed                      # Ejecutar seed
```

#### Flujo para agregar una tabla o columna

```
1. Crear o editar el schema en src/database/schema/<entidad>/<entidad>.schema.ts
2. Exportarlo desde src/database/schema/index.ts
3. npm run db:generate --name=add_<nombre>
4. Revisar src/database/migrations/<timestamp>_add_<nombre>.sql
5. npm run db:migrate
```

---

## Dominio: Pasanaco

Un **pasanaco** es un grupo de ahorro rotativo. El flujo de vida es:

```
1. Crear grupo           POST /groups
2. Agregar miembros      POST /groups/:id/members
3. Inicializar turnos    POST /groups/:id/initialize   ← calcula fechas automáticamente
4. Registrar pagos       POST /payments
   └─ Al completarse el último turno → grupo pasa a COMPLETED automáticamente
```

### Frecuencias

| Frecuencia | Comportamiento |
|------------|----------------|
| `WEEKLY`   | Los turnos se espacian semanalmente desde la fecha de inicio |
| `MONTHLY`  | Los turnos se espacian mensualmente desde la fecha de inicio |
| `BIRTHDAY` | Fecha de nacimiento — cada turno cae en el próximo cumpleaños del beneficiario a partir de la fecha de inicio. Los turnos se ordenan por fecha de cumpleaños (ascendente); `turnOrder` se usa solo como desempate cuando dos personas comparten la misma fecha |

### Fechas de inicio y fin

`startDate` y `endDate` **no son ingresadas por el usuario**. Se calculan automáticamente al inicializar los turnos:

- `startDate` = fecha del primer turno
- `endDate` = fecha del último turno

---

## Endpoints

### Health

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado de la API |

### Groups

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/groups` | Listar grupos activos (paginado, filtrable, ordenable) |
| GET | `/groups/:id` | Obtener grupo por ID |
| POST | `/groups` | Crear grupo |
| POST | `/groups/:id/initialize` | Inicializar turnos (calcula y fija startDate/endDate) |
| PATCH | `/groups/:id` | Actualizar grupo |
| DELETE | `/groups/:id` | Soft delete |
| DELETE | `/groups/:id/hard` | Hard delete |

#### POST /groups — Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | ✓ | Nombre del grupo (máx. 150) |
| `description` | string | — | Descripción (máx. 500) |
| `frequency` | `WEEKLY` \| `MONTHLY` \| `BIRTHDAY` | ✓ | Frecuencia de los turnos |
| `contributionAmount` | number | ✓ | Monto que cada participante aporta por turno |

#### Respuesta de grupo (campos calculados)

| Campo | Descripción |
|-------|-------------|
| `participantCount` | Cantidad de miembros activos. Se actualiza al agregar/remover miembros |
| `totalAmountPerTurn` | `contributionAmount × participantCount`. Total del pasanaco por turno |
| `startDate` | Fecha del primer turno. Se calcula al inicializar turnos |
| `endDate` | Fecha del último turno. Se calcula al inicializar turnos |

#### POST /groups/:id/initialize — Body (opcional)

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `startDate` | string (YYYY-MM-DD) | — | Fecha base para calcular turnos. Default: hoy |

#### GET /groups — Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `name` | string | — | Filtro parcial (case-insensitive) |
| `sortBy` | `name` \| `createdAt` | `createdAt` | Campo de ordenamiento |
| `sortOrder` | `asc` \| `desc` | `desc` | Dirección |
| `page` | number | `0` | Página (0-indexed) |
| `size` | number | `10` | Elementos por página (máx 100) |

### Group Members

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/groups/:groupId/members` | Listar miembros del grupo |
| POST | `/groups/:groupId/members` | Agregar miembro |
| DELETE | `/groups/:groupId/members/:personId` | Remover miembro (soft delete) |

> Los miembros solo se pueden agregar o remover **antes** de inicializar los turnos.

#### POST /groups/:groupId/members — Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `personId` | string | ✓ | ID de la persona |
| `turnOrder` | number | — | Posición en el orden (1 = primero). Se auto-asigna al final si no se envía. Para grupos BIRTHDAY actúa solo como desempate |

Todos los endpoints de miembros devuelven `{ member, person }`:

```json
{
  "member": { "id": "...", "groupId": "...", "personId": "...", "turnOrder": 1, "status": "ACTIVE", ... },
  "person": { "id": "...", "firstName": "María", "lastName": "García", "phone": "...", "email": "..." }
}
```

> Al agregar o remover un miembro se recalculan automáticamente `participantCount` y `totalAmountPerTurn` en el grupo.

### Turns

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/groups/:groupId/turns` | Listar turnos del grupo (paginado, filtrable por status) |
| GET | `/turns/:id` | Obtener turno por ID |
| GET | `/turns/:id/summary` | Resumen del turno con pagos por participante |
| POST | `/turns/:id/complete` | Forzar cierre del turno (si está totalmente pagado) |

#### GET /groups/:groupId/turns — Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `status` | `PENDING` \| `ACTIVE` \| `COMPLETED` | — | Filtrar por estado |
| `page` | number | `0` | Página |
| `size` | number | `20` | Tamaño |

`GET /groups/:groupId/turns` y `GET /turns/:id` incluyen el beneficiario resuelto:

```json
{
  "id": "...",
  "turnNumber": 1,
  "status": "ACTIVE",
  "beneficiaryId": "...",
  "beneficiary": { "id": "...", "firstName": "María", "lastName": "García" },
  "scheduledDate": "2025-03-15",
  "totalExpectedAmount": "500.00",
  "totalPaidAmount": "100.00"
}
```

### Payments

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/payments` | Registrar pago de un participante en un turno activo |
| GET | `/payments/turn/:turnId` | Listar pagos de un turno (paginado) |

#### POST /payments — Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `turnId` | string | ✓ | ID del turno (debe estar `ACTIVE`) |
| `participantId` | string | ✓ | ID de la persona que paga |

> El monto se toma automáticamente de `contributionAmount` del grupo. Cuando se alcanza el `totalExpectedAmount`, el turno pasa a `COMPLETED`, el siguiente turno pasa a `ACTIVE` y, si era el último, el grupo pasa a `COMPLETED`.

### Persons

Relación **1:1** con `user_account`: al crear una persona (`POST /persons`) se crea en la misma transacción su cuenta.

Campos únicos: `phone`, `email`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/persons` | Listar personas activas (paginado, filtros, orden) |
| GET | `/persons/:id` | Persona por ID (incluye `userAccount` sin hash) |
| POST | `/persons` | Crear persona y cuenta de usuario |
| PATCH | `/persons/:id` | Actualizar datos |
| DELETE | `/persons/:id` | Soft delete (persona + cuenta) |
| DELETE | `/persons/:id/hard` | Hard delete |

#### POST /persons — Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `firstName` | string | ✓ | Nombre (máx. 100) |
| `lastName` | string | ✓ | Apellido (máx. 100) |
| `birthday` | string (YYYY-MM-DD) | ✓ | Fecha de nacimiento |
| `phone` | string | ✓ | Teléfono (único, máx. 30) |
| `email` | string (email) | ✓ | Correo de la persona (único) |
| `username` | string | — | Username de la cuenta (único, máx. 100). Si se omite, no se crea cuenta |
| `password` | string | — | Contraseña en texto plano (mín. 8, máx. 128). Requerida si se envía `username` |
| `passwordExpired` | boolean | — | Forzar cambio en próximo login (default `false`) |

### User accounts

`personId` es **opcional**: una cuenta puede existir sin persona.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/user-accounts` | Listar cuentas activas (paginado) |
| GET | `/user-accounts/:id` | Cuenta por ID |
| POST | `/user-accounts` | Crear cuenta standalone |
| PATCH | `/user-accounts/:id` | Actualizar |
| DELETE | `/user-accounts/:id` | Soft delete |
| DELETE | `/user-accounts/:id/hard` | Hard delete |

---

## Respuesta paginada (OffsetPage)

```json
{
  "content": [...],
  "totalSize": 20,
  "totalPages": 2,
  "numberOfElements": 10,
  "pageNumber": 0,
  "empty": false,
  "size": 10,
  "offset": 0
}
```

---

## Documentación Swagger

Disponible en: `http://localhost:3000/api/docs`

YAML descargable en: `http://localhost:3000/api/docs-yaml`

---

## Multi-ambiente

| Archivo | Ambiente |
|---------|----------|
| `.env` | Development (default) |
| `.env.prod` | Production |

```bash
npm run start:dev        # Carga .env
npm run start:prod       # Carga .env.prod
npm run db:migrate:prod  # Migraciones contra prod
```

---

## Logging

- **Development:** logs coloreados y legibles en consola
- **Production:** JSON estructurado a stdout (capturado por Render)

---

## Base de datos

### Convenciones

- Nombres de tablas en **singular** (`group`, `person`, `turn`)
- Columnas en **snake_case**, propiedades TypeScript en **camelCase**
- Todas las tablas incluyen: `id` (cuid2), `created_at`, `updated_at`, `deleted_at`
- Soft delete mediante `deleted_at` (null = activo)

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `person` | Datos personales. Campos únicos: `phone`, `email` |
| `user_account` | Cuenta de acceso. `person_id` nullable (cuenta standalone). Campos únicos: `username`, `email` |
| `group` | Pasanaco. `participant_count` y `total_amount_per_turn` se recalculan al modificar miembros. `start_date`/`end_date` se calculan al inicializar turnos |
| `group_member` | Relación persona ↔ grupo. `turn_order` define posición (o desempate en BIRTHDAY) |
| `turn` | Un turno por miembro activo. Incluye `beneficiary` (join a `person`). `status`: PENDING → ACTIVE → COMPLETED |
| `payment` | Pago de un participante en un turno. Índice único `(turn_id, participant_id)` |

---

## Deploy en Render

**Build command:**
```bash
npm run build
```

**Start command:**
```bash
npm run start:prod
```
