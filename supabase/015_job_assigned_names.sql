-- "Asignar también a" pasó a ser una lista fija de gente del taller / instaladores
-- que NO tienen cuenta en la app (Ares, Ariel, Hector, Jose, Jose Garra, Rolli —
-- ver ASSIGN_ALSO_NAMES en src/data/catalog.ts). Como no son perfiles, no van a
-- job_assigned_users (que referencia profiles); se guardan como texto plano acá.
alter table jobs add column if not exists assigned_names text[] not null default '{}';
