-- Ajusta quién puede cargar/modificar el valor de un presupuesto: ahora
-- cualquier admin puede (sea o no productor — Gonzalo incluido), no solo los
-- admin/coordinador sin producción de antes. `coordinador` sigue necesitando
-- is_producer = false (Gastón sigue afuera). Ver CLAUDE.md §55.
create or replace function can_set_quote_price()
returns boolean as $$
  select coalesce(
    (select role = 'admin' or (role = 'coordinador' and is_producer = false) from profiles where id = auth.uid()),
    false
  );
$$ language sql stable security definer;
