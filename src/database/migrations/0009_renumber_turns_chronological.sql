-- DEPRECATED: usar 0011_fix_pasanaco_data_all_groups.sql o scripts/fix-pasanaco-data.sql
-- (este archivo quedó reemplazado por el fix genérico para todos los grupos).

DO $$
DECLARE
  gid TEXT := 'xhxj4cm43316rdkja167gfnc';
BEGIN
  RAISE NOTICE '0009 is deprecated; run 0011 or scripts/fix-pasanaco-data.sql instead';
  RETURN;
  -- 1) Shift to temp range to avoid uq_turn_group_number conflicts
  UPDATE turn t
  SET turn_number = sub.rn + 10000,
      updated_at = NOW()
  FROM (
    SELECT t2.id,
           ROW_NUMBER() OVER (
             ORDER BY t2.scheduled_date ASC,
                      COALESCE(gm.turn_order, t2.turn_number) ASC
           ) AS rn
    FROM turn t2
    LEFT JOIN group_member gm
      ON gm.group_id = t2.group_id
     AND gm.person_id = t2.beneficiary_id
     AND gm.custom_date = t2.scheduled_date
     AND gm.deleted_at IS NULL
    WHERE t2.group_id = gid
      AND t2.deleted_at IS NULL
  ) sub
  WHERE t.id = sub.id;

  -- 2) Assign final turn_number 1..N
  UPDATE turn t
  SET turn_number = sub.rn,
      updated_at = NOW()
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             ORDER BY scheduled_date ASC,
                      turn_number ASC
           ) AS rn
    FROM turn
    WHERE group_id = gid
      AND deleted_at IS NULL
  ) sub
  WHERE t.id = sub.id;

  -- 3) Single ACTIVE = first non-COMPLETED by calendar
  UPDATE turn
  SET status = 'PENDING',
      updated_at = NOW()
  WHERE group_id = gid
    AND status = 'ACTIVE'
    AND deleted_at IS NULL;

  UPDATE turn t
  SET status = 'ACTIVE',
      updated_at = NOW()
  FROM (
    SELECT id
    FROM turn
    WHERE group_id = gid
      AND status <> 'COMPLETED'
      AND deleted_at IS NULL
    ORDER BY scheduled_date ASC, turn_number ASC
    LIMIT 1
  ) next_t
  WHERE t.id = next_t.id;

  -- 4) Refresh group start/end from turn dates
  UPDATE "group" g
  SET start_date = bounds.min_date,
      end_date = bounds.max_date,
      updated_at = NOW()
  FROM (
    SELECT MIN(scheduled_date) AS min_date,
           MAX(scheduled_date) AS max_date
    FROM turn
    WHERE group_id = gid
      AND deleted_at IS NULL
  ) bounds
  WHERE g.id = gid;
END $$;
