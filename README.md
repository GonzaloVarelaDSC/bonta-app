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

(Actualizado 22/09/2026 — para el detalle ronda a ronda de todo lo que cambió desde el diseño original, ver `CLAUDE.md`, que es la fuente de verdad viva de este proyecto.)

- Login real con Supabase Auth (email + contraseña, recuperación por mail) y roles (Admin, Coordinador, Diseño, Producción, Instalación) con permisos aplicados tanto en la interfaz como en la base de datos (Row Level Security + un trigger que protege los campos que solo Coordinador/Admin pueden tocar).
- Alta de trabajo con **Carga rápida** (una sola pantalla, no un wizard multi-paso — se sacó el wizard original) con detección de información faltante que avisa pero no bloquea.
- CRUD de trabajos con el modelo de datos completo (cliente, productos con material/medidas/notas, instalación, control de calidad), persistido en Postgres.
- Prioridad 100% manual (5 niveles), editable desde cualquier vista — no se calcula sola por fecha.
- Tabla de Trabajos con filtros (prioridad/estado/cliente/responsable/bloqueados/archivados) y buscador global.
- Kanban de 7 columnas con drag & drop, tacho para eliminar (borrado lógico, restaurable desde Histórico), auto-archivado de trabajos entregados hace 5+ días.
- Ficha de trabajo completa: general (con resumen de "minuta técnica"), detalle (productos/materiales/medidas), control de calidad (recordatorio, no bloqueo), archivos versionados con aprobación, instalación, historial y comentarios con `@menciones` (autocompletado por ID real + menciones por sector/rol).
- Sistema de bloqueos con motivo obligatorio, y "muestra al cliente" (sin muestra / en producción / enviada, falta OK / aprobada) para trabajos que necesitan aprobación de una prueba antes de producir todo.
- **Notificaciones in-app reales** (campana en el header): te avisa cuando te asignan un trabajo o te mencionan en un comentario, con actualización en vivo (Supabase Realtime, con un polling de respaldo cada 30s) y marcado de leído/no leído.
- Dashboard con KPIs clickeables (escopeados a A mí/Por mí/Todos), widget de carga de diseño por productor, y detección de "trabajos silenciosos" (sin movimiento en 48h).
- Sección Histórico (solo admin) para consultar/restaurar trabajos archivados o eliminados.
- Actualización en vivo de trabajos: un cambio que hace un compañero aparece solo, sin recargar (suscripción realtime de Supabase).
- Responsive: sidebar como menú lateral colapsable en mobile.

Lo que queda deliberadamente fuera de esta fase (ver el documento de especificación original, sección "Alcance", y `CLAUDE.md` para el detalle): calendario, reportes completos, ficha de cliente con historial extendido, checklist de calidad configurable por tipo de trabajo, dependencias entre trabajos, plantillas, notificaciones por email/push (las in-app sí existen), facturación electrónica (proyecto aparte, ver `CLAUDE.md` §28), y subida de archivos real a Supabase Storage (por ahora `addFileVersion` registra el nombre y metadata del archivo pero no sube el binario — ver nota abajo).

## Estructura del código

```
src/
  types/        Modelo de datos (interfaces TypeScript — espejo del esquema Postgres real)
  data/         Catálogos (tipos de trabajo, materiales, estados). seed.ts ya no se usa en runtime.
  lib/          Lógica de negocio pura: prioridad, riesgo, fechas, permisos, selectores,
                cliente de Supabase, mapeo de filas de la base al modelo de la app
  store/        Estado de la aplicación (Zustand) — todas las llamadas a Supabase viven acá
  components/   UI, organizada por sección (Layout, Dashboard, Jobs, Kanban, JobDetail, QuickJob, Users, Historico, Auth)
supabase/       Migraciones SQL (esquema, políticas RLS, catálogos, datos de prueba) — ver README ahí
```

## Pendiente para que la subida de archivos sea real

Hoy `addFileVersion` guarda nombre, tamaño simulado y quién lo subió, pero no el archivo en sí — quedó así para no bloquear el resto de la Fase 1 en una integración de Storage. Para completarlo: en `src/store/useStore.ts`, dentro de `addFileVersion`, subir el archivo a `supabase.storage.from('job-files').upload(...)` antes del insert en `file_versions`, guardando la ruta devuelta en la columna `storage_path` (ya existe en el esquema). En la UI, el botón "+ Subir nueva versión" de `JobDetail/JobDetailPage.tsx` hoy pide el nombre por `prompt()` — hay que cambiarlo por un `<input type="file">` real.

## Deploy

Frontend: Vercel o Netlify, apuntando a este repo, con las mismas dos variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) configuradas en el panel del hosting. Backend: ya es Supabase, no hay nada más que deployar ahí.
