-- 027: imagen de "contact sheet" por trabajo (18/10).
-- Una imagen por OT (la misma que se usa en Copérnico), achicada en el navegador
-- antes de subir. Se ve en la pestaña Producción y sale impresa en la planilla.
-- Bucket privado: las imágenes son de clientes; la app las muestra con links
-- firmados temporales. Ruta dentro del bucket: <job_id>/<archivo>.

alter table jobs add column if not exists contact_sheet_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-images', 'job-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Mismo criterio de visibilidad que el trabajo: quien puede ver la OT puede ver,
-- subir, reemplazar y quitar su imagen.
drop policy if exists job_images_select on storage.objects;
create policy job_images_select on storage.objects for select to authenticated
  using (bucket_id = 'job-images' and can_view_job(((storage.foldername(name))[1])::uuid));

drop policy if exists job_images_insert on storage.objects;
create policy job_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'job-images' and can_view_job(((storage.foldername(name))[1])::uuid));

drop policy if exists job_images_update on storage.objects;
create policy job_images_update on storage.objects for update to authenticated
  using (bucket_id = 'job-images' and can_view_job(((storage.foldername(name))[1])::uuid));

drop policy if exists job_images_delete on storage.objects;
create policy job_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'job-images' and can_view_job(((storage.foldername(name))[1])::uuid));
