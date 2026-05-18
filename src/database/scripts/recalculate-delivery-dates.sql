-- Recalcula delivery_date para todos los turnos según la estrategia del grupo.
-- DAYS_BEFORE: delivery_date = scheduled_date - delivery_days_before (días calendario)
-- SAME_DAY: delivery_date = scheduled_date

BEGIN;

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

COMMIT;

-- Verificación grupo Cumpleaños 2026 v2
SELECT t.turn_number,
       p.first_name || ' ' || p.last_name AS beneficiary,
       t.scheduled_date,
       t.delivery_date,
       t.scheduled_date - t.delivery_date AS days_before,
       g.delivery_days_before AS configured_days
FROM turn t
JOIN "group" g ON g.id = t.group_id
JOIN person p ON p.id = t.beneficiary_id
WHERE g.id = 's5qjbo0pyfaso5qlxy8vpu6w'
  AND t.deleted_at IS NULL
ORDER BY t.turn_number
LIMIT 5;
