-- Un trabajo puede tener varios productos (Corpóreo 3D + Corpóreo en acrílico,
-- por ejemplo), cada uno con su propio material, sus propias medidas y un
-- check de "ya lo procesé". jsonb por el mismo motivo que `size_items`: se lee
-- y se escribe siempre entero junto con el trabajo, no necesita joins propios.
alter table jobs add column if not exists products jsonb not null default '[]'::jsonb;
