-- Patch — correr en Supabase → SQL Editor → New query → Run. Es seguro re-ejecutar.
--
-- 1) El número de trabajo (código TRB-/orden de Copernico) ya no se genera solo al
--    crear el trabajo — lo carga a mano un admin/coordinador cuando tiene el número
--    real de Copernico. Mientras tanto queda vacío, así que deja de ser obligatorio.
--    El unique constraint sigue funcionando igual: Postgres permite múltiples NULL
--    en una columna unique (no compite consigo mismo).
alter table jobs alter column code drop not null;

-- 2) Quién generó el trabajo — distinto del responsable interno, que puede cambiar
--    después. Nullable porque los trabajos ya cargados no tienen este dato.
alter table jobs add column if not exists created_by_user_id uuid references profiles(id);
