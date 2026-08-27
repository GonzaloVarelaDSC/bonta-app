-- Medidas estructuradas por renglón (cantidad/ancho/alto) para reemplazar el
-- campo libre `measurements` en la carga rápida y la ficha. Se guarda como
-- jsonb (array de {quantity, width, height}) en vez de una tabla aparte porque
-- siempre se lee/escribe entero junto con el resto del trabajo, sin filtros
-- ni joins propios.
alter table jobs add column if not exists size_items jsonb not null default '[]'::jsonb;
