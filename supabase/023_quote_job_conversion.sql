-- Vínculo Presupuesto ↔ Trabajo — confirmar un presupuesto genera un trabajo
-- real y los deja vinculados en las dos direcciones (ver CLAUDE.md, conversión
-- Presupuesto → Trabajo). Idempotente.

alter table jobs add column if not exists source_quote_id uuid references quotes(id);
alter table quotes add column if not exists converted_job_id uuid references jobs(id);

create index if not exists idx_jobs_source_quote on jobs(source_quote_id);
create index if not exists idx_quotes_converted_job on quotes(converted_job_id);
