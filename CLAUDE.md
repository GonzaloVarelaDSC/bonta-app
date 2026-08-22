# Estudio Bonta — Sistema de producción — Contexto para retomar en Claude Code

Este archivo existe para que una sesión nueva de Claude Code, corriendo local en esta
carpeta, tenga contexto completo sin que Gonzalo tenga que reexplicar todo de cero.
Fue armado por una sesión anterior de Claude (Cowork, en la nube) que ya no tiene
acceso directo a esta carpeta salvo que Gonzalo la vuelva a conectar.

## Quién es el usuario

Gonzalo Varela — diseñador industrial, ~1 mes en Estudio Bonta (imprenta de gran
formato en Buenos Aires: router CNC, impresión 3D, corte láser, vidrieras, stands,
cartelería). No es programador — necesita instrucciones paso a paso, sin asumir
conocimiento previo de terminal/git/etc. Su login real de la app: `gonzaa.gd@gmail.com`
(la contraseña la tiene él, no está guardada acá por seguridad).

## Qué es este proyecto

App interna de gestión de trabajos (reemplaza coordinación por mail). React 19 +
TypeScript + Vite + Tailwind v3 + Zustand + react-router-dom v7 + @dnd-kit + Supabase
(Postgres + Auth + RLS + Realtime). El análisis completo (arquitectura, modelo de
datos, roles, prioridad/riesgo) está en el documento de especificación entregado por
separado — pedirle a Gonzalo el archivo o buscarlo en su proyecto de Claude
("Estudio Bonta" → `claude/sistema-produccion-especificacion.md`).

## Estado actual (22/08/2026)

- App conectada a Supabase real y funcionando: Gonzalo se loguea con su cuenta real,
  ve el dashboard vacío (sin datos de prueba todavía).
- `.env.local` ya existe en esta carpeta con las credenciales reales (URL + anon key).
  **Nunca** pedir ni usar la `service_role key` — solo anon key.
- Cambios recientes ya aplicados en el código de esta carpeta:
  - El paso "Cliente" del wizard de alta de trabajo (`src/components/NewJob/NewJobWizard.tsx`)
    dejó de ser un dropdown que dependía de tener clientes precargados. Ahora es un
    input de texto con `<datalist>` (autocompletado nativo) + `findOrCreateClient` en
    `src/store/useStore.ts`, que busca por nombre (case-insensitive) y si no existe lo
    crea al vuelo. Decisión de Gonzalo: los clientes viven en Copernico (su otro
    sistema), acá no se administran — se sacó "Clientes" del menú lateral
    (`src/components/Layout/Sidebar.tsx`) pero la tabla/ruta siguen existiendo por
    abajo, no se borraron.
  - Paleta de colores y tipografías (`tailwind.config.js`, `src/index.css`) se
    cambiaron para matchear el sitio público del estudio:
    https://gonzalovareladsc.github.io/WEB-estudio-Bonta/ — tokens reales sacados de
    `assets/css/tokens.css` de ese repo (fondo crema `#f8f4f4`, texto `#2d2b2b`, acento
    bronce `#a06f24`, tipografías Cormorant Garamond (headings) + Lora (body)).
    **Ojo**: se le avisó a Gonzalo que un serif como Lora en toda la UI (tablas,
    badges, texto chico) puede perder legibilidad comparado con un sans — quedó
    pendiente que él confirme si lo deja así o pide volver a un sans para texto denso
    de UI, dejando el serif solo en títulos grandes.
- Se inicializó git local en esta carpeta (`git init`, ya con un commit). **No hay
  remoto configurado.** Gonzalo pidió "commit and push" automático a GitHub; se le
  explicó que la sesión de Cowork no puede manejar tokens/credenciales de GitHub por
  regla de seguridad dura, y que la vía correcta es que él conecte su propia cuenta acá
  mismo, en Claude Code, que corre local y puede usar su propio git/gh ya autenticado
  (si tiene GitHub Desktop instalado o ya se logueó antes, dado que ya tiene el repo
  `WEB-estudio-Bonta` en GitHub, probablemente tenga git configurado en esta máquina —
  confirmar con `git config --global user.name` / `gh auth status`).

## Pendiente (en orden probable de prioridad para Gonzalo)

1. Confirmar con Gonzalo si el cambio de tipografía a Lora se mantiene o se revierte
   el body a un sans (ver nota arriba).
2. Conectar un remoto de GitHub para este repo (`bonta-app`) usando la propia sesión
   de git/gh de Gonzalo en su máquina — Claude Code puede hacerlo directo, sin el
   problema de credenciales que tenía la sesión de Cowork.
3. Deploy a Vercel o Netlify (para que compañeros prueben la app sin depender de que
   Gonzalo tenga `npm run dev` corriendo) — variables de entorno `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` van en el panel del hosting, mismos valores que
   `.env.local`.
4. Crear las cuentas de los otros ~7 empleados en Supabase Auth (Gonzalo decidió
   usar emails de Gmail reales de cada uno, no placeholders `@estudiobonta.com`) y
   ajustar `supabase/004_seed_profiles.sql` / `005_seed_demo_data.sql` en consecuencia
   (esos archivos hoy tienen emails placeholder — no reflejan la corrección real que
   se hizo a mano en el dashboard de Supabase para la cuenta de Gonzalo).
5. Backportear al SQL local el patch que se aplicó en vivo en el dashboard de Supabase:
   la función `handle_new_user()` en `supabase/001_schema.sql` tenía un bug de
   `search_path` con SECURITY DEFINER que rompía la creación de usuarios ("Database
   error creating new user") — se parcheó en vivo en el SQL Editor de Supabase pero
   ese fix nunca se volvió a bajar a este archivo. Buscar en el dashboard de Supabase
   (SQL Editor → historial) o pedirle a Gonzalo que lo re-exporte.
6. Completar subida real de archivos a Supabase Storage — hoy `addFileVersion` en
   `src/store/useStore.ts` guarda metadata pero no el binario. Ver nota en el
   `README.md` de esta carpeta, sección "Pendiente para que la subida de archivos sea
   real".
7. Revisar la tabla de Trabajos (no solo el Kanban) con la tipografía/paleta nueva —
   es donde más se nota si el serif molesta para leer.

## Restricciones que hay que seguir respetando

- Nunca pedir ni loggear la `service_role key` de Supabase.
- No asumir conocimiento técnico de Gonzalo — pasos explícitos, un comando a la vez,
  pedirle captura si algo no cierra.
- No usar `git push --force` ni tocar configuración de git global sin que él lo pida.
