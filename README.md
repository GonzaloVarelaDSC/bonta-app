# Estudio Bonta — Sistema de gestión de producción (Fase 1 / MVP)

Sistema interno de gestión de trabajos para Estudio Bonta, conectado a Supabase (Postgres + Auth + Row Level Security). El análisis completo, la arquitectura y el modelo de datos están en el documento de especificación entregado junto con este código.

## Puesta en marcha (primera vez)

1. Seguir **`supabase/README.md`** paso a paso: crea el esquema, las políticas de seguridad, el bucket de archivos, los usuarios y los datos de prueba en tu proyecto de Supabase.
2. Copiar `.env.example` a `.env.local` y completar `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Project Settings → API en Supabase). **Nunca** la `service_role key` en este archivo — ver por qué en `supabase/README.md`.
3. `npm install && npm run dev` → `http://localhost:5173`.

Sin `.env.local` configurado, la app arranca igual y muestra una pantalla explicando qué falta, en vez de romperse.

## Cómo correrlo (ya configurado)

```bash
npm install
npm run dev
```

Para build de producción:

```bash
npm run build
npm run preview
```

## Qué incluye esta Fase 1

- Login real con Supabase Auth (email + contraseña, recuperación por mail) y roles (Admin, Coordinador/Producción, Diseño, Producción, Instalación) con permisos aplicados tanto en la interfaz como en la base de datos (Row Level Security + un trigger que protege los campos que solo Coordinador/Admin pueden tocar).
- CRUD de trabajos con el modelo de datos completo (cliente, especificaciones técnicas, etapas de producción, instalación, control de calidad), persistido en Postgres.
- Cálculo de prioridad automática (cascada de reglas por fecha/bloqueo/cliente) y riesgo, con posibilidad de forzar una prioridad manual.
- Tabla de trabajos con filtros y buscador global.
- Kanban con drag & drop que actualiza el estado en la base y registra el movimiento en el historial — con actualización optimista para que se sienta instantáneo.
- Ficha de trabajo completa: general, especificaciones, producción por etapas, archivos versionados con aprobación, instalación, historial y comentarios internos con menciones.
- Sistema de bloqueos con motivo obligatorio.
- Dashboard con KPIs clickeables que filtran la tabla, y detección de "trabajos silenciosos" (sin movimiento en 48h).
- Alta de trabajo en wizard de 5 pasos con detección de información faltante.
- Actualización en vivo: un cambio de estado que hace un compañero aparece solo, sin recargar (suscripción realtime de Supabase sobre la tabla de trabajos).
- Responsive: sidebar como menú lateral colapsable en mobile, pestaña de comentarios dedicada en pantallas chicas.

Lo que queda deliberadamente para Fase 2/3 (ver el documento de especificación, sección "Alcance"): calendario, reportes completos, ficha de cliente con historial extendido, checklist de calidad configurable desde administración, dependencias entre trabajos, plantillas, notificaciones por push/email, y subida de archivos real a Supabase Storage (por ahora `addFileVersion` registra el nombre y metadata del archivo pero no sube el binario — ver nota abajo).

## Estructura del código

```
src/
  types/        Modelo de datos (interfaces TypeScript — espejo del esquema Postgres real)
  data/         Catálogos (tipos de trabajo, materiales, estados). seed.ts ya no se usa en runtime.
  lib/          Lógica de negocio pura: prioridad, riesgo, fechas, permisos, selectores,
                cliente de Supabase, mapeo de filas de la base al modelo de la app
  store/        Estado de la aplicación (Zustand) — todas las llamadas a Supabase viven acá
  components/   UI, organizada por sección (Layout, Dashboard, Jobs, Kanban, JobDetail, NewJob, Users, Auth)
supabase/       Migraciones SQL (esquema, políticas RLS, catálogos, datos de prueba) — ver README ahí
```

## Pendiente para que la subida de archivos sea real

Hoy `addFileVersion` guarda nombre, tamaño simulado y quién lo subió, pero no el archivo en sí — quedó así para no bloquear el resto de la Fase 1 en una integración de Storage. Para completarlo: en `src/store/useStore.ts`, dentro de `addFileVersion`, subir el archivo a `supabase.storage.from('job-files').upload(...)` antes del insert en `file_versions`, guardando la ruta devuelta en la columna `storage_path` (ya existe en el esquema). En la UI, el botón "+ Subir nueva versión" de `JobDetail/JobDetailPage.tsx` hoy pide el nombre por `prompt()` — hay que cambiarlo por un `<input type="file">` real.

## Deploy

Frontend: Vercel o Netlify, apuntando a este repo, con las mismas dos variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) configuradas en el panel del hosting. Backend: ya es Supabase, no hay nada más que deployar ahí.
