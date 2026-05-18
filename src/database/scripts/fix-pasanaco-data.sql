-- =============================================================================
-- Corrección de datos — pasanacos ya inicializados
-- =============================================================================
-- Ejecutar en Supabase SQL Editor o:
--   npx dotenv -e .env -- psql "$DATABASE_URL" -f src/database/scripts/fix-pasanaco-data.sql
--
-- Qué corrige:
--   1. turn_number según scheduled_date (orden cronológico real del pasanaco)
--   2. Un solo turno ACTIVE = primer no COMPLETED por fecha
--   3. delivery_date según delivery_date_strategy / delivery_days_before del grupo
--   4. start_date / end_date del grupo alineados a los turnos
--
-- Seguro re-ejecutar: usa rangos temporales para evitar conflictos de unique.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PASO 1: Renumerar turn_number por grupo (scheduled_date ASC)
-- -----------------------------------------------------------------------------
UPDATE turn t
SET turn_number = sub.rn + 10000,
    updated_at = NOW()
FROM (
  SELECT t2.id,
         t2.group_id,
         ROW_NUMBER() OVER (
           PARTITION BY t2.group_id
           ORDER BY t2.scheduled_date ASC,
                    COALESCE(gm.turn_order, t2.turn_number) ASC,
                    t2.id ASC
         ) AS rn
  FROM turn t2
  LEFT JOIN group_member gm
    ON gm.group_id = t2.group_id
   AND gm.person_id = t2.beneficiary_id
   AND gm.custom_date = t2.scheduled_date
   AND gm.deleted_at IS NULL
  WHERE t2.deleted_at IS NULL
) sub
WHERE t.id = sub.id;

UPDATE turn t
SET turn_number = sub.rn,
    updated_at = NOW()
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY group_id
           ORDER BY turn_number ASC
         ) AS rn
  FROM turn
  WHERE deleted_at IS NULL
    AND turn_number > 10000
) sub
WHERE t.id = sub.id;

-- -----------------------------------------------------------------------------
-- PASO 2: Un solo ACTIVE por grupo (primer turno no COMPLETED por calendario)
-- -----------------------------------------------------------------------------
UPDATE turn
SET status = 'PENDING',
    updated_at = NOW()
WHERE status = 'ACTIVE'
  AND deleted_at IS NULL;

UPDATE turn t
SET status = 'ACTIVE',
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (group_id) id, group_id
  FROM turn
  WHERE status <> 'COMPLETED'
    AND deleted_at IS NULL
  ORDER BY group_id, scheduled_date ASC, turn_number ASC
) next_t
WHERE t.id = next_t.id;

-- -----------------------------------------------------------------------------
-- PASO 3: Recalcular delivery_date según estrategia del grupo
-- -----------------------------------------------------------------------------
UPDATE turn t
SET delivery_date = CASE
      WHEN g.delivery_date_strategy = 'DAYS_BEFORE'
        AND g.delivery_days_before IS NOT NULL
        AND g.delivery_days_before >= 1
      THEN t.scheduled_date - g.delivery_days_before
      ELSE t.scheduled_date
    END,
    updated_at = NOW()
FROM "group" g
WHERE t.group_id = g.id
  AND t.deleted_at IS NULL
  AND g.deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- PASO 4: Actualizar start_date / end_date del grupo
-- -----------------------------------------------------------------------------
UPDATE "group" g
SET start_date = bounds.min_date,
    end_date = bounds.max_date,
    updated_at = NOW()
FROM (
  SELECT group_id,
         MIN(scheduled_date) AS min_date,
         MAX(scheduled_date) AS max_date
  FROM turn
  WHERE deleted_at IS NULL
  GROUP BY group_id
) bounds
WHERE g.id = bounds.group_id
  AND g.deleted_at IS NULL;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (opcional — comentar si ejecutás desde migrator sin result set)
-- -----------------------------------------------------------------------------
SELECT g.name,
       g.delivery_date_strategy,
       g.delivery_days_before,
       t.turn_number,
       t.status,
       t.scheduled_date,
       t.delivery_date,
       p.first_name || ' ' || p.last_name AS beneficiary
FROM turn t
JOIN "group" g ON g.id = t.group_id
JOIN person p ON p.id = t.beneficiary_id
WHERE t.deleted_at IS NULL
  AND g.deleted_at IS NULL
ORDER BY g.name, t.turn_number;
