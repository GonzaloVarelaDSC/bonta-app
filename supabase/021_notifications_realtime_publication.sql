-- Causa raíz encontrada (22/09): la app se suscribe a cambios en vivo de
-- `notifications` vía Supabase Realtime (canal "my-notifications" en
-- useStore.ts), pero Realtime solo transmite cambios de tablas agregadas
-- explícitamente a la publicación `supabase_realtime` — no es automático al
-- crear una tabla, y ninguna migración de este repo lo había hecho nunca. Sin
-- esto, la suscripción no tira ningún error (parece andar), simplemente nunca
-- recibe nada — la campana solo se actualiza si el usuario recarga la página
-- (que dispara `refreshMyNotifications` vía `get_loadAll`), nunca en vivo.
-- Ver CLAUDE.md §49 para el diagnóstico completo (2 casos reales reportados:
-- asignación de trabajo y mención @ sin aviso).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
