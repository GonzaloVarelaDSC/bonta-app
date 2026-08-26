-- Columna para trazabilidad de cuándo un trabajo quedó "Listo" por primera vez.
-- Se graba sola (ver store/useStore.ts, setStatus) la primera vez que el estado
-- pasa a Listo para entrega/instalación o Instalación — no se pisa después, para
-- que quede el registro de esa fecha aunque el trabajo siga avanzando.
alter table jobs add column if not exists ready_at timestamptz;
