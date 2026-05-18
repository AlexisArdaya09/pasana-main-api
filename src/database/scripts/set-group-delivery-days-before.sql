-- =============================================================================
-- Opcional: configurar estrategia DAYS_BEFORE en un grupo existente
-- =============================================================================
-- Solo ejecutar ANTES o DESPUÉS de fix-pasanaco-data.sql.
-- Si el grupo ya tiene turnos, este script solo cambia la estrategia en "group";
-- luego ejecutá fix-pasanaco-data.sql para recalcular delivery_date en cada turn.
--
-- Ajustá group_id y delivery_days_before según tu pasanaco.
-- =============================================================================

-- Grupo "Cumpleaños 2026" — 2 días de antelación (ejemplo del producto)
UPDATE "group"
SET delivery_date_strategy = 'DAYS_BEFORE',
    delivery_days_before = 2,
    updated_at = NOW()
WHERE id = 'xhxj4cm43316rdkja167gfnc'
  AND deleted_at IS NULL;

-- Recalcular delivery_date de sus turnos (también incluido en fix-pasanaco-data.sql)
UPDATE turn t
SET delivery_date = t.scheduled_date - g.delivery_days_before,
    updated_at = NOW()
FROM "group" g
WHERE t.group_id = g.id
  AND g.id = 'xhxj4cm43316rdkja167gfnc'
  AND g.delivery_date_strategy = 'DAYS_BEFORE'
  AND g.delivery_days_before IS NOT NULL
  AND t.deleted_at IS NULL;

SELECT turn_number,
       status,
       scheduled_date,
       delivery_date,
       (SELECT first_name || ' ' || last_name FROM person WHERE id = beneficiary_id) AS beneficiary
FROM turn
WHERE group_id = 'xhxj4cm43316rdkja167gfnc'
  AND deleted_at IS NULL
ORDER BY turn_number;
