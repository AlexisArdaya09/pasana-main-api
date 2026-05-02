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
