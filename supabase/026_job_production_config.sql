-- 026: pestaña "Producción" de la ficha (12/10).
-- Configuración propia de la planilla de taller, separada de `products` (la carga
-- original de la OT): procesos por componente, indicaciones y componentes
-- agregados solo para producción. Ver ProductionConfig en src/types/index.ts.
alter table jobs add column if not exists production_config jsonb not null default '{"items": []}'::jsonb;
