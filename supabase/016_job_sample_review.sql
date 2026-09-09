-- Muchos clientes piden una muestra/prueba impresa (color, definición, textura)
-- antes de mandar a producir el trabajo entero. Se marca a nivel trabajo:
--   'none'     = no hay muestra en juego (default)
--   'awaiting' = muestra enviada, falta el OK del cliente
--   'approved' = el cliente la aprobó
-- `sample_review_at` guarda cuándo se cambió por última vez (para "aprobada el ...").
alter table jobs add column if not exists sample_review text not null default 'none'
  check (sample_review in ('none', 'awaiting', 'approved'));
alter table jobs add column if not exists sample_review_at timestamptz;
