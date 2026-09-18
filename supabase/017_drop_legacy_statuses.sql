-- Los estados NUEVO y APROBADO ya no existen en la app (ver auditoría 17/09/2026,
-- confirmado con Gonzalo) — ningún flujo los produce desde que createJob inserta
-- PENDIENTE/FALTA_INFORMACION directamente. Se sacaron de JobStatus (types/index.ts),
-- STATUS_LABELS y KANBAN_COLUMNS (catalog.ts). Si quedó algún trabajo viejo con
-- alguno de los dos, lo migramos a PENDIENTE (mismo tono/columna que ya tenían) para
-- que no quede huérfano: sin este UPDATE, STATUS_LABELS[status] devolvería `undefined`
-- (badge en blanco) para cualquier trabajo que siguiera en NUEVO/APROBADO.
update jobs set status = 'PENDIENTE' where status in ('NUEVO', 'APROBADO');

-- El default de la columna también apuntaba a 'NUEVO' (ver 001_schema.sql) aunque
-- en la práctica nunca se usaba (createJob siempre manda el status explícito).
alter table jobs alter column status set default 'PENDIENTE';
