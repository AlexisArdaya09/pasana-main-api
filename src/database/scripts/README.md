# Scripts SQL de datos

## `fix-pasanaco-data.sql`

Corrige **todos** los grupos con turnos:

1. `turn_number` ordenado por `scheduled_date` (cronológico).
2. Un solo turno `ACTIVE` = primer no `COMPLETED` por fecha.
3. `delivery_date` según `delivery_date_strategy` / `delivery_days_before`.
4. `start_date` / `end_date` del grupo.

```bash
npx dotenv -e .env -- node -e "
const {readFileSync}=require('fs');const{Client}=require('pg');
(async()=>{
  const c=new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  await c.query(readFileSync('src/database/scripts/fix-pasanaco-data.sql','utf8'));
  console.log('OK');
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
"
```

O pegar el contenido en el SQL Editor de Supabase.

## `recalculate-delivery-dates.sql`

Recalcula `delivery_date` de todos los turnos según `delivery_date_strategy` del grupo. Útil si los datos están bien en BD pero el front mostraba mal las fechas (ver fix de API `formatDateOnly`).

## `set-group-delivery-days-before.sql`

Opcional. Configura un grupo a `DAYS_BEFORE` (ej. 2 días) y recalcula `delivery_date` de sus turnos. Editar `group_id` y `delivery_days_before` antes de ejecutar.

Orden recomendado:

1. `set-group-delivery-days-before.sql` (si querés cambiar la estrategia).
2. `fix-pasanaco-data.sql` (siempre, para alinear todo).
