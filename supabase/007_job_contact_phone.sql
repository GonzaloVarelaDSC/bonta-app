-- Patch — correr en Supabase → SQL Editor → New query → Run. Es seguro re-ejecutar.
--
-- Teléfono/WhatsApp del contacto del cliente para ESTE trabajo puntual — antes solo
-- se guardaba el nombre (contact_name). Sin esto, Gonzalo no tiene forma de comunicarse
-- con el cliente directo desde el dashboard, tiene que ir a buscarlo a otro lado.
alter table jobs add column if not exists contact_phone text not null default '';
