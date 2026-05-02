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
│   │   ├── group/
│   │   │   └── group.schema.ts     # Tabla group
│   │   ├── person/
│   │   │   └── person.schema.ts    # Tabla person (nombre, apellido, cumpleaños, DNI)
│   │   ├── user-account/
│   │   │   └── user-account.schema.ts  # Tabla user_account (username, hash, password_expired)
│   │   └── index.ts
│   ├── migrations/                 # Archivos SQL generados por drizzle-kit
│   ├── database.module.ts          # Módulo global, provee 'DB_CONNECTION'
│   ├── drizzle.config.ts           # Config drizzle-kit (lee process.env.DB_*)
│   ├── migrate.ts                  # Migrador programático
│   └── seed.ts                     # Script de seed
├── group/
│   ├── dto/
│   │   ├── create-group.dto.ts
│   │   ├── update-group.dto.ts
│   │   └── list-groups.query.ts    # Paginación, filtros y sorting
│   ├── group.controller.ts
│   ├── group.module.ts
│   └── group.service.ts
├── person/
│   ├── dto/
│   │   ├── create-person.dto.ts    # Persona + credenciales (crea cuenta en la misma operación)
│   │   ├── update-person.dto.ts
│   │   └── list-persons.query.ts
│   ├── person.controller.ts
│   ├── person.module.ts
│   └── person.service.ts
├── user-account/
│   ├── dto/
│   │   ├── create-user-account.dto.ts
│   │   ├── update-user-account.dto.ts
│   │   └── list-user-accounts.query.ts
│   ├── user-account.controller.ts
│   ├── user-account.module.ts
│   └── user-account.service.ts
├── health/
│   └── health.controller.ts
├── logger/
│   └── logger.config.ts            # Config Winston (dev/prod)
├── app.module.ts
└── main.ts                         # Bootstrap, CORS, Swagger, ValidationPipe
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
# Generar nueva migración SQL a partir del schema
npm run db:generate --name=<nombre>

# Aplicar migraciones pendientes (desarrollo)
npm run db:migrate

# Aplicar migraciones en producción
npm run db:migrate:prod

# Sincronizar schema directo a la DB (sin generar archivo, solo dev)
npm run db:push

# Drizzle Studio (UI para explorar datos)
npm run db:studio

# Ejecutar seed
npm run db:seed
```

#### Flujo para agregar una tabla o columna

```
1. Crear o editar el schema en src/database/schema/<entidad>/<entidad>.schema.ts
2. Exportarlo desde src/database/schema/index.ts
3. npm run db:generate --name=add_<nombre>
4. Revisar src/database/migrations/<timestamp>_add_<nombre>.sql
5. npm run db:migrate
```

### Tests

```bash
npm run test            # Unit tests
npm run test:watch      # Watch mode
npm run test:cov        # Coverage
npm run test:e2e        # End-to-end
```

### Calidad de código

```bash
npm run lint            # ESLint con auto-fix
npm run format          # Prettier
```

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
| PATCH | `/groups/:id` | Actualizar grupo |
| DELETE | `/groups/:id` | Eliminar lógicamente (soft delete) |
| DELETE | `/groups/:id/hard` | Eliminar físicamente (hard delete) |

#### GET /groups — Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `name` | string | — | Filtro parcial por nombre (case-insensitive) |
| `sortBy` | `name` \| `createdAt` | `createdAt` | Campo de ordenamiento |
| `sortOrder` | `asc` \| `desc` | `desc` | Dirección del ordenamiento |
| `page` | number | `0` | Página (0-indexed) |
| `size` | number | `10` | Elementos por página (máx 100) |

### Persons

Relación **1:1** con `user_account`: al crear una persona (`POST /persons`) se crea en la misma transacción su cuenta con **username**, **email**, **password** (hash bcrypt, nunca se devuelve) y **passwordExpired**.

Campos únicos en `person`: `dni`, `phone`, `email`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/persons` | Listar personas activas con su cuenta (paginado, filtros, orden) |
| GET | `/persons/:id` | Persona por ID (incluye `userAccount` sin hash) |
| POST | `/persons` | Crear persona **y** cuenta de usuario |
| PATCH | `/persons/:id` | Actualizar datos de persona (nombre, apellido, cumpleaños, DNI, teléfono, email) |
| DELETE | `/persons/:id` | Soft delete de persona y cuenta vinculada |
| DELETE | `/persons/:id/hard` | Hard delete de persona y cuenta |

#### POST /persons — Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `firstName` | string | ✓ | Nombre (máx. 100) |
| `lastName` | string | ✓ | Apellido (máx. 100) |
| `birthday` | string (ISO 8601) | ✓ | Fecha de nacimiento (`YYYY-MM-DD`) |
| `dni` | string | ✓ | Documento (único, máx. 32) |
| `phone` | string | ✓ | Teléfono (único, máx. 30) |
| `email` | string (email) | ✓ | Correo de la persona (único, máx. 255) |
| `username` | string | ✓ | Username de la cuenta (único, máx. 100) |
| `password` | string | ✓ | Contraseña en texto plano (mín. 8, máx. 128) |
| `passwordExpired` | boolean | — | Forzar cambio en próximo login (default `false`) |

#### GET /persons — Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `firstName` | string | — | Filtro parcial por nombre |
| `lastName` | string | — | Filtro parcial por apellido |
| `sortBy` | `createdAt` \| `firstName` \| `lastName` \| `dni` | `createdAt` | Orden |
| `sortOrder` | `asc` \| `desc` | `desc` | Dirección |
| `page` | number | `0` | Página |
| `size` | number | `10` | Tamaño (máx. 100) |

### User accounts

CRUD independiente para cuentas. Las respuestas **no** incluyen el hash de contraseña.

`personId` es **opcional**: una cuenta puede existir sin estar vinculada a una persona. Normalmente la cuenta se crea junto con la persona (`POST /persons`); `POST /user-accounts` sirve para crear una cuenta standalone o vincularla a una persona sin cuenta.

Campos únicos en `user_account`: `username`, `email`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/user-accounts` | Listar cuentas activas (paginado) |
| GET | `/user-accounts/:id` | Cuenta por ID |
| POST | `/user-accounts` | Crear cuenta (con o sin persona) |
| PATCH | `/user-accounts/:id` | Actualizar username / email / password / passwordExpired |
| DELETE | `/user-accounts/:id` | Soft delete |
| DELETE | `/user-accounts/:id/hard` | Hard delete |

#### POST /user-accounts — Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `personId` | string | — | ID de la persona a vincular (opcional) |
| `username` | string | ✓ | Username único (máx. 100) |
| `email` | string (email) | ✓ | Correo de la cuenta (único, máx. 255) |
| `password` | string | ✓ | Contraseña en texto plano (mín. 8, máx. 128) |
| `passwordExpired` | boolean | — | Default `false` |

#### GET /user-accounts — Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `username` | string | — | Filtro parcial por nombre de usuario |
| `sortBy` | `createdAt` \| `username` | `createdAt` | Orden |
| `sortOrder` | `asc` \| `desc` | `desc` | Dirección |
| `page` | number | `0` | Página |
| `size` | number | `10` | Tamaño (máx. 100) |

#### Response paginado (OffsetPage)

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

### Documentación Swagger

Disponible en: `http://localhost:3000/api/docs`

El YAML descargable está en: `http://localhost:3000/api/docs-yaml`

Los tags **Persons** y **User accounts** documentan campos, validaciones y el comportamiento de contraseñas (solo entrada en texto plano; persistencia como hash).

---

## Multi-ambiente

| Archivo | Ambiente |
|---------|----------|
| `.env` | Development (default) |
| `.env.prod` | Production |

```bash
npm run start:dev    # Carga .env
npm run start:prod   # Carga .env.prod
npm run db:migrate:prod  # Migraciones contra prod (requiere .env.prod)
```

---

## Logging

- **Development:** logs coloreados y legibles en consola
- **Production:** JSON estructurado a stdout (capturado por Render)

---

## Base de datos

### Convenciones

- Nombres de tablas en **singular** (`group`, `user`, `member`)
- Columnas en **snake_case**, propiedades TypeScript en **camelCase**
- Todas las tablas incluyen: `id` (cuid), `created_at`, `updated_at`, `deleted_at`
- Soft delete mediante `deleted_at` (null = activo)

### Tablas `person` y `user_account`

- **`person`:** `first_name`, `last_name`, `birthday` (date), `dni` (único), `phone` (único), `email` (único).
- **`user_account`:** `person_id` (FK a `person`, único, **nullable** → cuenta puede existir sin persona), `username` (único), `email` (único), `password_hash` (bcrypt), `password_expired` (boolean).

### Agregar un nuevo módulo con tabla

1. Crear el schema en `src/database/schema/member/member.schema.ts`:

```typescript
import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';

export const member = pgTable('member', {
  ...baseSchema,
  name: varchar('name', { length: 150 }).notNull(),
});
```

2. Exportar desde `src/database/schema/index.ts`:

```typescript
export * from './member/member.schema';
```

3. Generar y aplicar la migración:

```bash
npm run db:generate --name=add_member_table
npm run db:migrate
```

4. Crear el módulo NestJS en `src/member/` siguiendo la estructura de `src/group/`.

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

Las variables de entorno se configuran en el dashboard de Render (equivalente a `.env.prod`).
