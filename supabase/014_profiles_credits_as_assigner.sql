-- Separa "puede cargar un trabajo" (role) de "aparece como opción en 'Asignado
-- por'" (crédito de quién coordinó el trabajo con el cliente). Gastón, Pancho
-- y Martín pueden cargar trabajos pero no deben aparecer en ese selector.
alter table profiles add column if not exists credits_as_assigner boolean not null default true;
