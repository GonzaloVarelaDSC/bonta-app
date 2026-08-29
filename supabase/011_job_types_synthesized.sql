-- Catálogo de tipos de trabajo sintetizado — de 17 verticales abstractas a 10
-- agrupados por máquina/proceso real. Los tipos viejos (impresion_uv,
-- senaletica, stands, etc.) NO se borran de la tabla porque hay trabajos de
-- prueba que todavía los referencian (la columna tiene foreign key) — solo
-- dejan de ofrecerse en el selector (eso lo controla el código, no la base).
insert into job_types (id, label, default_stages) values
  ('impresion_v7000', 'Impresión V7000', array['diseno','impresion','corte','control_calidad']),
  ('impresion_s40', 'Impresión S40', array['diseno','impresion','corte','control_calidad']),
  ('impresion_p9000', 'Impresión P9000', array['diseno','impresion','corte','control_calidad']),
  ('corte_laser', 'Corte láser', array['diseno','corte','control_calidad']),
  ('corte_cnc', 'Corte CNC', array['diseno','corte','control_calidad']),
  ('corporeo', 'Corpóreo', array['diseno','corte','armado','terminacion','control_calidad','instalacion']),
  ('vidrieras_stands', 'Vidrieras y stands', array['diseno','impresion','armado','control_calidad','instalacion']),
  ('carpinteria', 'Carpintería', array['diseno','carpinteria','terminacion','control_calidad']),
  ('acrilico', 'Acrílico', array['diseno','corte','terminacion','control_calidad']),
  ('otro', 'Otro', array['diseno','control_calidad'])
on conflict (id) do update set label = excluded.label, default_stages = excluded.default_stages;
