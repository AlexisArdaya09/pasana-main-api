-- Data fix: turn order chronológico, ACTIVE único, delivery_date y fechas de grupo
-- Idempotente para todos los grupos con turnos inicializados.

UPDATE turn t
SET turn_number = sub.rn + 10000,
    updated_at = NOW()
FROM (
  SELECT t2.id,
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
WHERE t.id = sub.id;--> statement-breakpoint
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
WHERE t.id = sub.id;--> statement-breakpoint
UPDATE turn
SET status = 'PENDING',
    updated_at = NOW()
WHERE status = 'ACTIVE'
  AND deleted_at IS NULL;--> statement-breakpoint
UPDATE turn t
SET status = 'ACTIVE',
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (group_id) id
  FROM turn
  WHERE status <> 'COMPLETED'
    AND deleted_at IS NULL
  ORDER BY group_id, scheduled_date ASC, turn_number ASC
) next_t
WHERE t.id = next_t.id;--> statement-breakpoint
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
  AND g.deleted_at IS NULL;--> statement-breakpoint
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
