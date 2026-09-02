# Estudio Bonta — Sistema de producción — Contexto para retomar en Claude Code

Este archivo es un handoff completo para que una sesión nueva de Claude Code, sin
memoria de las sesiones anteriores, pueda seguir trabajando en este proyecto sin que
Gonzalo tenga que reexplicar nada. Reemplaza la versión anterior de este archivo
(22/08/2026) — todo lo de acá está verificado contra el código real al 25/08/2026.

Fue escrito por la sesión de Claude Code que hizo casi todo el trabajo de UI/UX,
deploy y ajustes de esta Fase 1, en una serie larga de intercambios con Gonzalo
probando la app en vivo y pidiendo cambios ronda tras ronda. Si algo de acá contradice
lo que ves en el código, confiá en el código — este archivo puede quedar desactualizado
si se siguen haciendo cambios sin actualizarlo.

---

## 1. Objetivo del proyecto

**Qué es:** app interna de gestión de trabajos para Estudio Bonta, una imprenta de
gran formato en Buenos Aires (router CNC, impresión 3D, corte láser, vidrieras,
stands, cartelería, letras corpóreas, etc.). Reemplaza la coordinación por mail/
WhatsApp/pizarrón con un sistema centralizado.

**Para qué sirve:** cada trabajo que entra al estudio (desde que se presupuesta en
Copernico hasta que se entrega o instala) tiene una "ficha" en esta app con: cliente,
descripción, prioridad (automática por fecha de entrega, o forzada a mano), estado
dentro del flujo de producción, responsable interno, archivos, control de calidad,
instalación si aplica, historial de actividad y comentarios internos. El Dashboard
funciona como "briefing diario" — a quién le sirve más que nada es a Gonzalo, para
saber apenas entra a la app qué tiene que hacer ese día sin leer notas a mano.

**Quién lo va a usar:** hoy (25/08/2026) **solo Gonzalo** tiene cuenta real y está
usando la app en producción. El plan es sumar ~7 personas más, con roles distintos
(ver sección 7, punto 1, y la memoria `project_team_roles` de Claude):
- **Nancy, Richard, Alejandra** — pasan presupuestos y aceptan trabajos en Copernico;
  necesitan poder dar de alta trabajos acá (rol `coordinador`).
- **Gastón y Gonzalo** — diseñadores, procesan los trabajos ya cargados (responsables
  del trabajo día a día).
- **Pancho y Martín** — dueños del estudio; también arman trabajos y asignan
  responsables (Gastón o Gonzalo).

Gonzalo **no es programador** (es diseñador industrial, ~1 mes en el estudio al
22/08). No asumir conocimiento de terminal/git/SQL — cuando haga falta que él haga
algo (correr SQL en Supabase, crear un repo en GitHub), dar pasos explícitos, uno por
vez, y pedir confirmación o captura si algo no cierra.

---

## 2. Arquitectura y stack

- **Frontend:** React 19 + TypeScript + Vite 8, sin SSR (SPA pura).
- **Estilos:** Tailwind CSS v3.4 (utility classes inline, sin CSS modules ni
  styled-components). Todos los tokens de diseño (colores, sombras) están en
  `tailwind.config.js`, nunca hardcodear un hex nuevo en un componente — ver sección 6.
- **Estado global:** Zustand (`src/store/useStore.ts`) — es un solo store gigante que
  concentra TODAS las llamadas a Supabase además del estado en memoria. No hay otros
  stores.
- **Routing:** react-router-dom v7, rutas declaradas en `src/App.tsx`.
- **Drag & drop:** `@dnd-kit/core` (usado solo en el Kanban).
- **Backend:** Supabase (Postgres + Auth + Row Level Security + Realtime). No hay
  backend propio — todo el acceso a datos es directo desde el cliente vía
  `@supabase/supabase-js`, protegido por RLS. Proyecto de Supabase: ref
  `mazbtflmitelfjgdxfne` (se ve en la URL `https://mazbtflmitelfjgdxfne.supabase.co`).
- **Fechas:** `date-fns` (con locale `es`).
- **Iconos:** `lucide-react`.
- **Lint:** `oxlint` (`npm run lint`). No hay test suite configurado (no hay Jest/
  Vitest/Playwright corriendo pese a que `playwright` está en devDependencies — quedó
  instalado pero sin usar).

### Estructura de carpetas relevante

```
src/
  types/index.ts          Modelo de datos completo (interfaces TS = espejo del
                           esquema Postgres). Leer este archivo primero para entender
                           el dominio — Job, User, Client, JobStatus, Priority, etc.
  data/
    catalog.ts             Catálogos estáticos: ROLES, JOB_TYPES, MATERIALS,
                            STAGE_LABELS, STATUS_LABELS, KANBAN_COLUMNS (con su
                            `tone` de color), QC_TEMPLATE, BLOCK_REASON_LABELS.
    seed.ts                 Generador de datos de demo — YA NO SE USA EN RUNTIME
                            (nada lo importa; tsc igual lo compila porque no está
                            excluido del proyecto). Si hace falta tocar el tipo Job,
                            hay que actualizar seed.ts también o el build rompe.
  lib/                     Lógica de negocio pura (sin llamadas a Supabase, salvo
                            supabaseClient.ts / supabaseQueries.ts):
    priority.ts             calculateAutoPriority() — cascada de reglas, ver sección 4.
    risk.ts                  calculateRisk(), isSilent() (trabajo sin movimiento 48h).
    dates.ts                 fmtDate/fmtDateTime/fmtShort/countdown/dayLabel.
    permissions.ts           canX(role) — control de acceso a nivel UI (espejo de RLS).
    selectors.ts              computeCounts(), isOverdue/isDueToday/isBlocked/
                              isMissingInfo, sortByPriority(), missingFields().
    statusChange.ts            SELECTABLE_STATUSES + tryChangeJobStatus() — punto
                              único que sabe el gate de control de calidad antes de
                              "Listo para entrega/instalación". Ver sección 6.
    dbMappers.ts               mapProfile/mapClient/mapJob/etc. — snake_case Postgres
                              → camelCase app.
    supabaseClient.ts          Cliente de supabase-js + supabaseConfigured (true si
                              hay env vars).
    supabaseQueries.ts          fetchAllJobs/fetchJobById + JOB_SELECT (el string de
                              embeds que trae todas las relaciones de un job en una
                              sola query).
  store/useStore.ts        Zustand store — TODO el acceso a datos vive acá (auth,
                            CRUD de jobs, comentarios, notificaciones, actividad,
                            realtime). Patrón de cada mutación: ver sección 6.
  components/
    Layout/                  AppLayout (shell con sidebar+header), Sidebar, Header
                            (buscador global + notificaciones + menú de cuenta).
    Auth/LoginPage.tsx        Pantalla de login (rediseñada, ver sección 4).
    Dashboard/                DashboardPage (briefing diario), DashboardJobCard
                            (la "ficha" horizontal de cada trabajo), KpiCard.
    Jobs/                     JobsPage (listado con filtros), JobsTable (tabla densa,
                            reutilizada en JobsPage y ClientsPage), ClientsPage.
    Kanban/KanbanPage.tsx     Tablero drag&drop, columnas coloreadas por `tone`.
    JobDetail/                JobDetailPage (la "ficha" completa/tabs), BlockModal,
                            CommentsPanel.
    NewJob/NewJobWizard.tsx    Wizard de alta de trabajo, 5 pasos (ver sección 4).
    Common/Badges.tsx          Vocabulario compartido de UI: PriorityBadge,
                            StatusBadge, StatusSelect, CountdownBadge, Avatar,
                            statusTone(). SIEMPRE reusar esto, no crear badges nuevos.
    Users/UsersPage.tsx        Gestión de usuarios (solo admin).
    Herramientas/
      ChequeoArchivosPage.tsx   Wrapper de React que solo pone un <iframe> apuntando
                              a /herramientas/chequeo-archivos.html. Ver sección 6 —
                              ese HTML es una herramienta externa, no tocar su lógica.
    Manual/ManualPage.tsx      Página de manual de uso — hoy son secciones vacías
                            (accordion), ver sección 7.
    Common/ConfigPage.tsx       Config (solo admin) — poco desarrollada.
public/
  favicon.png, logo-mark.png, logo-mark-blanco.png   Logo real del estudio (bajado de
                            la web pública, ver sección 4). favicon.png y
                            logo-mark.png son el mismo archivo duplicado a propósito
                            (paths distintos, mismo contenido).
  herramientas/chequeo-archivos.html   Herramienta standalone de chequeo de archivos
                            de cliente (pdf.js + pdf-lib) — NO es código React, ver
                            sección 6 antes de tocarla.
supabase/
  001_schema.sql ... 007_job_contact_phone.sql   Migraciones SQL numeradas
                            secuencialmente. Ver sección 8 — no hay migration runner,
                            hay que correrlas a mano en el SQL Editor de Supabase.
  README.md                 Instrucciones de puesta en marcha del backend.
.claude/launch.json        Config para que el navegador integrado de Claude Code
                            pueda levantar `npm run dev` (puerto 5173) con
                            preview_start(name: "bonta-dev"). Agregado esta sesión.
```

---

## 3. Estado actual

### Funcionando y verificado en producción real
- App deployada en Vercel: **https://bonta-app.vercel.app** — deploy automático en
  cada push a `main` de GitHub (repo conectado, ver sección 8). Gonzalo la está
  usando de verdad, con su cuenta real (`gonzaa.gd@gmail.com`) y datos reales (no hay
  seed de demo cargado — la base arrancó vacía).
- Login, logout, recuperación de contraseña (Supabase Auth).
- Alta de trabajo (wizard de 5 pasos), listado con filtros, Kanban con drag&drop,
  ficha completa con tabs, sistema de bloqueos, control de calidad, comentarios,
  historial de actividad, notificaciones, realtime (cambios de otros usuarios
  aparecen solos).
- Dashboard rediseñado como briefing diario (ver sección 4) — probado visualmente por
  Gonzalo en el sitio deployado en cada ronda de cambios.
- Herramienta "Chequeo de Archivos" embebida y funcionando (probé la navegación
  interna localmente antes del último push).

### A medias / con deuda conocida
- **Subida de archivos no sube el binario real** — `addFileVersion` en
  `useStore.ts` guarda nombre/tamaño simulado/quién lo subió, pero no el archivo.
  Nunca se tocó en esta sesión. Ver README.md sección dedicada para el plan exacto
  (subir a bucket `job-files` de Storage, columna `storage_path` ya existe en el
  schema).
- **`ManualPage.tsx`** tiene la estructura (accordion con una sección por área de la
  app) pero casi todo el contenido está vacío ("Todavía no hay contenido para esta
  sección"), a propósito — Gonzalo pidió la sección pero todavía no dictó qué
  escribir en cada una.
- **Solo Gonzalo tiene cuenta** — el resto del equipo (~7 personas) no está cargado
  todavía. Ver sección 7, punto 1 — esto bloquea que "Responsable interno"/"Asignar
  a" muestren más de un nombre.
- **No hay tests automatizados.** La única verificación es `npm run build` (tsc +
  vite build) y revisión manual/visual en el sitio deployado. Esta sesión en
  particular **no tuvo acceso a screenshots del navegador** (el panel de preview no
  compositeaba frames) — todo se verificó por build limpio + accessibility tree/texto
  extraído de la página, nunca pixel a pixel. Sugerirle a Gonzalo revisar visualmente
  cada cambio importante en el sitio real.
- **`handle_new_user()` con bug de `search_path`** — ver sección 5 y 8, no
  resuelto.

### Explícitamente fuera de alcance de esta fase (no hay que "completarlo", es a propósito)
Calendario, reportes completos, ficha de cliente con historial extendido, checklist
de calidad configurable desde administración, dependencias entre trabajos,
plantillas, notificaciones push/email. Ver README.md sección "Qué incluye esta
Fase 1" para el detalle completo.

---

## 4. Decisiones ya tomadas y CERRADAS (no volver a discutir)

Cada una de estas fue pedida explícitamente por Gonzalo o es consecuencia directa de
algo que pidió. No proponerle "volver" a la alternativa descartada salvo que él lo
pida de nuevo explícitamente.

1. **Tipografía funcional = Inter, no un serif.** La versión original (heredada de
   una sesión anterior) usaba Lora + Cormorant Garamond para matchear la web pública
   del estudio. Se cambió a Inter para toda la UI funcional (tablas, badges, kanban,
   formularios, títulos de página, números de KPI) porque es una herramienta de
   trabajo diario, no una pieza de marca — la legibilidad en tablas densas y a
   tamaños chicos importa más que matchear la identidad visual de la web. Gonzalo lo
   confirmó explícitamente ("me gusta, dejalo así"). **Cormorant Garamond
   (`font-brand` en Tailwind) queda reservado únicamente para**: el wordmark
   "Estudio Bonta" del Sidebar y del Login, y la frase del hero en el Login. Nunca
   usar `font-brand` para texto funcional/denso.
2. **Paleta de color SÍ matchea la web pública** (fondo crema `#f8f4f4`, texto
   `#2d2b2b`, acento bronce `#a06f24`) — esto no se tocó, sigue vigente. Ver
   `tailwind.config.js` para todos los tokens (`ink`, `brand`, `crit`, `urg`, `norm`,
   `plan`, `wait`, `info` — este último agregado esta sesión, ver punto 9).
3. **"Clientes" no se administra en esta app** — los clientes viven en Copernico
   (el otro sistema que usa el estudio). El paso "Cliente" del wizard es un input de
   texto libre con `<datalist>` de autocompletado + `findOrCreateClient()` en
   `useStore.ts` (busca por nombre case-insensitive, crea al vuelo si no existe).
   "Clientes" se sacó del menú lateral pero la tabla/ruta/`ClientsPage.tsx` siguen
   existiendo y funcionando (usadas internamente).
4. **El N° de trabajo (código `TRB-2026-XXXXX`, que en la práctica es el número de
   orden de Copernico) NO se autogenera más al crear el trabajo.** Nace vacío
   (`null`) y lo carga a mano un admin/coordinador cuando ya tiene el número real de
   Copernico — porque ese número solo existe DESPUÉS de procesar el pedido en
   Copernico, nunca antes. Es editable con un click directo en la tabla de Trabajos/
   Dashboard y en la ficha del Kanban (componente `EditableCode` duplicado en
   `JobsTable.tsx` y `DashboardJobCard.tsx` — si se toca uno, revisar si el otro
   necesita el mismo cambio). Requirió migrar la columna `code` de `jobs` a nullable
   (`006_job_code_optional_and_creator.sql`) — Postgres permite múltiples `NULL` en
   una columna `unique`, así que no hace falta ningún valor centinela.
5. **Los trabajos nuevos arrancan siempre en estado `PENDIENTE`**, sin importar si
   faltan medidas/material/técnica — esos campos ya no se piden en el alta (ver
   punto 6) y por lo tanto su ausencia no es una señal de "hay un problema", es el
   estado normal de un trabajo recién creado que nadie empezó a procesar todavía.
   `FALTA_INFORMACION` queda reservado para: (a) el trabajo requiere instalación y
   todavía no tiene dirección cargada (ese sí es un bloqueo real), o (b) alguien lo
   pone a mano después porque encontró un problema concreto. Ver el bug relacionado
   en sección 5, punto 4 — esto fue una corrección de un efecto colateral no
   intencional.
6. **El wizard de alta de trabajo NO pide medidas/material/técnica/terminación/
   color/observaciones/requisitos especiales al crear el trabajo** (eran el paso 3
   original, "Características técnicas" — se eliminó). Gonzalo explicó que esa
   información la maneja por mail/WhatsApp directo con el cliente, y que cargarla acá
   era trabajo duplicado sin beneficio real. Esos campos siguen existiendo en el
   modelo de datos (`Job.measurements`, etc.) y se pueden completar después desde la
   ficha (`JobDetailPage.tsx`, tab "Especificaciones") si en algún caso puntual hace
   falta — el wizard ya no los toca, por eso ahora es de **5 pasos** (Cliente y
   descripción → Entrega y prioridad → Producción/Etapas → Archivos → Confirmación),
   no 6.
7. **La fecha de entrega comprometida y la fecha de instalación son SOLO FECHA, sin
   horario.** El input del wizard es `type="date"` (no `datetime-local`/`time`), y
   toda la UI que las muestra usa `fmtDate()` (no `fmtDateTime()`). Internamente el
   `committedDate` sigue siendo un timestamp completo (se le agrega `T18:00` fijo al
   armar el ISO string) porque el cálculo de urgencia por hora
   (`calculateAutoPriority`) necesita una hora de referencia — 18:00 se eligió como
   "cierre del día de trabajo". Si se cambia esta lógica, revisar que el countdown y
   la prioridad automática sigan siendo coherentes.
8. **Todo cambio de estado de un trabajo (dropdown de estado en tabla/Kanban/
   Dashboard) tiene que pasar por `tryChangeJobStatus()`** en `lib/statusChange.ts`
   — es el único lugar que sabe el gate de "no se puede pasar a Listo para entrega/
   instalación si faltan ítems obligatorios de control de calidad". Nunca llamar
   `setStatus()` del store directamente desde un componente nuevo.
9. **El color de los estados es por macro-etapa, no por estado individual** —
   inspirado en Linear/GitHub/Trello: gris (`wait`) = no arrancado, azul (`info`,
   token nuevo agregado esta sesión) = en curso, verde (`plan`) = listo/terminado,
   naranja (`urg`) = necesita atención, rojo (`crit`) = bloqueado. Antes casi todos
   los estados compartían el mismo amarillo y era imposible distinguirlos de un
   vistazo — ver bug en sección 5, punto 5. El mapeo completo está en `statusTone()`
   (`Badges.tsx`) para el badge/select de estado, y en `KANBAN_COLUMNS[].tone`
   (`catalog.ts`) para el fondo/header de cada columna del Kanban.
10. **Los badges/selects de estado son fondo claro + texto de color + borde fino
    (con un puntito de color adelante), NO texto blanco sobre fondo sólido, y NO
    mayúsculas.** Se aplicó tanto a los badges propios de React (`Badges.tsx`) como
    al reskin de `chequeo-archivos.html` (sus badges originales eran mayúsculas +
    texto blanco sobre color sólido — se cambió a este mismo lenguaje).
11. **El Dashboard es una lista de "fichas" horizontales de ancho completo**, no una
    tabla densa ni una grilla de tarjetas en columnas. Cada fila (`DashboardJobCard`)
    tiene: prioridad, estado (editable ahí mismo), N° de Copernico (editable ahí
    mismo), cliente, nombre y descripción del trabajo, fecha de asignación y de
    entrega, contacto del cliente (nombre + teléfono/WhatsApp), responsable, quién lo
    generó, y un botón explícito "Ver ficha →" — la navegación a la ficha completa
    SOLO pasa por ese botón, nunca por click en cualquier parte de la fila (ver bug
    de overflow en sección 5, punto 3, y el patrón de navegación en sección 6).
    Tiene un toggle "Solo asignados a mí" (activado por default) para que Gonzalo
    vea su propio trabajo del día, no todo el estudio.
12. **Las tarjetas de KPI del Dashboard y las columnas del Kanban se reordenaron**:
    "Listos para entregar" y "En producción" van primero (izquierda), porque son las
    que más se consultan de un vistazo — el resto sigue el orden del flujo. La
    tarjeta de KPI "Bloqueados" se eliminó del Dashboard (Gonzalo no entendía para
    qué servía y pidió sacarla directamente).
13. **Las tarjetas de KPI tienen un borde de color a la izquierda según prioridad**
    (las 5 prioridades, no solo Crítico/Urgente) — mismo lenguaje en las fichas del
    Dashboard. Los íconos de las tarjetas de KPI son de `lucide-react` con un chip de
    fondo de color por categoría, no emoji.
14. **"Chequeo de Archivos" es una herramienta HTML/JS externa, embebida por
    iframe, nunca reescrita en React.** Ver sección 6 para el proceso exacto de
    mantenimiento — es una decisión deliberada para no arriesgar romper una
    herramienta ya construida y probada por fuera de esta sesión.
15. **El logo real del estudio** (`logo-mark.png`/`logo-mark-blanco.png`, bajados de
    `https://gonzalovareladsc.github.io/WEB-estudio-Bonta/assets/img/`) reemplaza
    cualquier ícono genérico — está en el favicon, el Login (panel izquierdo grande
    con resplandor de marca + header mobile) y se sacó del `chequeo-archivos.html`
    (ya está en el sidebar de la app, sobraba repetirlo ahí).
16. **La frase del hero del Login es texto real de la web pública**, no inventado:
    *"Del concepto a la pieza."* + *"Soluciones especiales para marcas, espacios y
    proyectos que necesitan algo más que una impresión."* — confirmado explícitamente
    por Gonzalo que se deje "donde está y como está", no tocar ni contenido ni
    posición sin que lo pida de nuevo.
17. **Git: nunca usar `git config --global`** para nada (identidad, ni ninguna otra
    config) sin que Gonzalo lo pida explícitamente — ver sección 8 para cómo se
    resuelve la identidad de los commits sin tocar la config global.
18. **Nunca pedir, loggear ni usar la `service_role key` de Supabase** — solo la
    `anon key`. Esta regla viene de la sesión original y sigue vigente sin excepción.

---

## 5. Bugs ya encontrados y corregidos (para no repetirlos)

1. **Redirect al tocar el estado/N° dentro de una fila clickeable.** El `<tr
   onClick={...}>` de `JobsTable` y el `<div onClick={...}>` de cada tarjeta del
   Kanban navegaban a la ficha del trabajo con CUALQUIER click dentro de la fila,
   incluyendo clicks sobre el `<select>` de estado o el botón de editar N°. Poner
   `stopPropagation()` en el control hijo no alcanzó de forma consistente. Se
   resolvió con dos capas: (a) `stopPropagation()` en `onClick`/`onPointerDown` del
   control interactivo, y (b) además, como defensa extra, el handler del contenedor
   ahora chequea `(e.target as HTMLElement).closest('select, button, input')` antes
   de navegar. **Patrón a repetir** en cualquier fila/tarjeta nueva que combine
   "click en cualquier lado navega" con controles interactivos anidados. El Dashboard
   directamente evita el problema de raíz: no tiene click-to-navigate ambiental, solo
   un botón explícito "Ver ficha →".
2. **`Could not find the 'contact_phone' column of 'jobs' in the schema cache.`**
   Error real de Postgres al crear un trabajo. Causa: se agregó el campo
   `contactPhone` al modelo y al insert de `createJob` en el código, pero la
   migración SQL correspondiente (`007_job_contact_phone.sql`) todavía no se había
   corrido contra la base de Supabase real — el código y la base de datos viven
   desincronizados porque no hay migration runner automático (ver sección 8).
   **Lección: cada vez que se cambia algo del schema de `jobs` (columna nueva,
   constraint distinto) hay que (1) escribir el archivo `supabase/0XX_*.sql`
   correspondiente, (2) actualizar también `001_schema.sql` para que una instalación
   nueva nazca ya con el schema correcto, y (3) decirle a Gonzalo explícitamente,
   con el SQL literal, que lo corra en el SQL Editor de Supabase — nunca asumir que
   ya está aplicado.**
3. **Overflow de la ficha horizontal del Dashboard** — el nombre del responsable/
   "Generado por" y el botón "Ver ficha" se salían del recuadro visible en pantallas
   no tan anchas. Causa: `flex-wrap lg:flex-nowrap` forzaba una sola línea a partir
   de 1024px de ancho, y si la suma de todos los elementos (prioridad + estado + N° +
   cliente + nombre + fechas + contacto + responsable + botón) superaba el ancho
   disponible, el excedente se salía del borde en vez de acomodarse. Se resolvió
   separando la ficha en dos filas internas (una fila de metadata arriba, nombre+
   descripción abajo), ambas con `flex-wrap` sin forzar nunca `nowrap` — así el
   contenido envuelve dentro de la tarjeta en vez de escaparse.
4. **Prioridad automática siempre "En espera" para trabajos nuevos.** Efecto
   colateral no intencional de la decisión 6 (sección 4): al sacar el paso de
   medidas/material/técnica del wizard, esos tres campos quedaban SIEMPRE vacíos en
   un trabajo recién creado. `calculateAutoPriority()` tenía una regla
   `missingInfo = !measurements || materialIds.length === 0 || !technique || ...` que
   forzaba `EN_ESPERA` apenas alguno faltaba — como ahora faltan siempre, TODO
   trabajo nuevo quedaba en "En espera" sin importar la fecha de entrega, tapando
   justo la urgencia que Gonzalo necesita ver de un vistazo en el Dashboard. Se
   corrigió angostando `missingInfo` a solo `requiresInstallation &&
   !installation.address` (un bloqueo real), dejando que la prioridad se calcule
   siempre por fecha salvo un bloqueo de verdad o un `FALTA_INFORMACION` puesto a
   mano.
5. **Todos los estados casi del mismo color en Kanban/tabla.** `statusTone()`
   originalmente solo distinguía `BLOQUEADO`/`CANCELADO`/`TERMINADO` — todo lo demás
   (`PENDIENTE`, `EN_DISENO`, `DISENO_LISTO`, `EN_PRODUCCION`,
   `EN_CONTROL_CALIDAD`, etc.) caía en el mismo tono `norm` (amarillo), haciendo
   imposible distinguir en qué etapa estaba un trabajo con solo mirar el color. Se
   resolvió agregando un tono `info` (azul) nuevo y mapeando cada estado a su
   macro-etapa real (ver decisión 9, sección 4).

---

## 6. Convenciones del proyecto

- **Idioma:** todo el texto de cara al usuario, los comentarios de código y los
  mensajes de commit están en español rioplatense (voseo: "vos", no "tú"). Los
  identificadores de código (variables, funciones, tipos) están en inglés.
- **Comentarios en el código:** solo cuando explican un motivo no obvio (por qué,
  no qué) — el código de este proyecto tiende a comentar las decisiones de negocio
  raras (ver `priority.ts`, `statusChange.ts`) pero no describe lo obvio. Seguir ese
  mismo criterio.
- **Componentes:** un archivo por componente, PascalCase, organizados por carpeta de
  feature bajo `src/components/<Feature>/<Componente>.tsx`. Componentes de UI
  puramente visuales y reutilizables (badges, avatar) viven en `Common/`.
- **Estilos:** Tailwind inline, siempre reusando los tokens de `tailwind.config.js`
  (`ink-*`, `brand-*`, `crit`/`urg`/`norm`/`plan`/`wait`/`info` con sus variantes
  `DEFAULT`/`bg`/`text`). Nunca un hex nuevo suelto en un `className` o `style` — si
  hace falta un color que no existe, agregarlo como token nuevo en
  `tailwind.config.js` (con un comentario explicando el porqué, como se hizo con
  `info`) en vez de hardcodearlo.
- **`lib/` vs `store/`:** `lib/` es lógica pura sin efectos secundarios (ni Supabase,
  salvo los dos archivos dedicados a eso). Todo lo que lea o escriba en Supabase vive
  en `store/useStore.ts`, sin excepción — si hace falta una acción nueva, agregarla
  ahí.
- **Patrón de cada mutación en `useStore.ts`:** update en Supabase → si aplica,
  `insertActivity()` (log de auditoría) → `insertNotifications()` a los usuarios
  afectados → `refreshJob()` / `refreshMyNotifications()` para traer el estado
  fresco. Nuevas acciones del store deberían seguir esta misma forma. El helper
  `jobLabel(job)` (definido arriba de `useStore`) arma un texto legible para logs/
  notificaciones aunque `job.code` sea `null` — usarlo en vez de interpolar
  `job.code` directo en cualquier string nuevo.
- **Migraciones SQL:** `supabase/0XX_descripcion.sql`, numeradas secuencialmente.
  **Nunca editar un archivo de migración ya numerado y potencialmente ya corrido**
  — si hace falta cambiar el schema, crear un archivo nuevo con el número siguiente.
  Además, actualizar `001_schema.sql` (la definición "instalación limpia") para que
  coincida con el estado real, aunque ese archivo nunca se vuelva a correr contra la
  base existente — sirve como documentación viva del schema y para instalaciones
  nuevas de cero.
- **Después de cualquier migración nueva:** avisarle a Gonzalo explícitamente, con
  el SQL literal en un bloque de código, que lo tiene que correr en el SQL Editor de
  Supabase (Dashboard → SQL Editor → New query → pegar → Run). No dar por hecho que
  ya está aplicado — ver bug 2 de la sección 5.
- **Navegación desde filas/tarjetas clickeables:** si una fila/tarjeta tiene
  `onClick` para navegar Y controles interactivos anidados (select, botón, input),
  aplicar el patrón de la sección 5, bug 1 (stopPropagation en el hijo +
  `closest('select, button, input')` en el padre), o directamente evitar el problema
  usando un botón explícito de navegación (como hace `DashboardJobCard`).
- **Cambios de estado de un trabajo:** siempre a través de `tryChangeJobStatus()` +
  `SELECTABLE_STATUSES` de `lib/statusChange.ts` (ver decisión 8, sección 4).
- **`public/herramientas/chequeo-archivos.html` — proceso de mantenimiento.** Este
  archivo NO es código de este proyecto en el sentido normal: es una herramienta
  HTML+JS standalone (usa `pdf.js`/`pdf-lib` por CDN) que Gonzalo construye por fuera
  con otra herramienta y entrega como archivo completo cada vez que tiene una versión
  nueva. Reglas estrictas:
  - **Nunca reescribir su lógica en React.** Es deliberado — evita el riesgo de
    romper una herramienta ya construida y probada, para un beneficio marginal.
  - **Nunca renombrar ni borrar un `id` o clase HTML que el `<script>` del archivo
    referencie** (ids como `configDiagram`, `targetW`, `dropzone`, `fileInput`,
    `cards`, clases como `.badge.verde/.amarillo/.rojo`, `.subscreen.active`, etc.)
    — antes de cualquier cambio estructural, buscar el nombre en la sección
    `<script>` del archivo para confirmar si está en uso.
  - **Cuando Gonzalo entrega una versión nueva del archivo** (ya pasó una vez, ver
    commit `8da028e`), el proceso es: (1) diffear la nueva contra la última
    commiteada para entender qué cambió de verdad (funcionalidad nueva, no solo
    estética) — ojo que el archivo tiene líneas gigantes (~50KB) de una imagen en
    base64 embebida, truncarlas antes de diffear/leer con algo como
    `awk '{ if (length($0)>300) print substr($0,1,120)" ...[TRUNCATED]"; else print
    }'`; (2) buscar y borrar la imagen del logo embebida en base64 (buscar
    `img class="logo"` — va a ser UNA sola línea enorme) y el `<div class="kicker">
    Estudio Bonta</div>` que la sigue; (3) agregar el `<link>` de Google Fonts Inter
    y el bloque `<style>` adicional que oculta "Manual"/"Bajo Acrílico"/"Placeholder"
    (dejando expuesto solo "Chequeo de Archivos") justo antes de `</head>` — buscar
    el comentario HTML `<!-- Agregado por Estudio Bonta app: ... -->` en la última
    versión commiteada y copiar ese bloque tal cual; (4) contar los colores hex
    distintos del bloque `<style>` (`grep -oE "#[0-9a-fA-F]{3,6}"`) y mapear cada uno
    al token de Tailwind más parecido con `sed` (rojo→`crit`, verde→`plan`,
    amarillo→`norm`, azul de acento→`brand`, grises→escala `ink`) — los commits
    `e4cd083` y `8da028e` tienen las tablas de mapeo exactas usadas la primera y
    segunda vez, sirven de referencia directa; (5) alinear `border-radius` a los
    valores de la app (12px tarjetas grandes, 8px controles/botones, `999px` pills de
    badge) y las sombras a `0 1px 2px rgba(15,23,32,.06), 0 1px 1px rgba(15,23,32,.04)`
    (equivalente al token `shadow-card`); (6) `npm run build` y una pasada de
    `preview_start` + `read_page`/`get_page_text` para confirmar que la navegación
    interna (`showScreen()`) sigue funcionando — ver sección 8 sobre cómo levantar el
    preview local.
- **Componentes de vocabulario compartido:** `PriorityBadge`, `StatusBadge`,
  `StatusSelect`, `CountdownBadge`, `Avatar` (todos en `Common/Badges.tsx`) —
  siempre reusar, nunca crear una versión nueva de un badge de prioridad/estado en
  otro componente.

---

## 7. Próximos pasos concretos (en orden de prioridad)

1. **Backportear el fix de `handle_new_user()`.** La función en
   `supabase/001_schema.sql` tiene un bug de `search_path` con `SECURITY DEFINER`
   que rompía la creación de usuarios nuevos en Auth ("Database error creating new
   user"). Se parcheó en vivo en el SQL Editor de Supabase en algún momento de la
   configuración inicial (antes de esta sesión) pero ese fix nunca se bajó al
   archivo local. Buscar en el Dashboard de Supabase (SQL Editor → historial de
   queries) o pedirle a Gonzalo que reexporte el schema actual de la función. Esto
   es un **prerequisito** del punto siguiente.
2. **Crear las cuentas de Supabase Auth de los ~7 empleados**, usando sus Gmail
   reales (decisión ya tomada, no placeholders `@estudiobonta.com`). Hay una memoria
   de Claude guardada (`project_team_roles`, en
   `~/.claude/projects/.../memory/project_team_roles.md`) con roles sugeridos por
   persona — confirmar con Gonzalo antes de asumir el rol exacto de cada uno. Una vez
   creadas, ajustar `supabase/004_seed_profiles.sql`/`005_seed_demo_data.sql` si hace
   falta (hoy tienen placeholders). Gastón en particular es urgente — Gonzalo lo
   quiere como responsable/asignado en trabajos y hoy no puede porque no tiene
   cuenta.
3. **Subida real de archivos a Supabase Storage** — nunca implementado. Ver
   README.md, sección "Pendiente para que la subida de archivos sea real", tiene el
   plan exacto (bucket `job-files`, columna `storage_path`, reemplazar el
   `prompt()` de nombre de archivo en `JobDetailPage.tsx` por un `<input
   type="file">` real).
4. **Confirmar con Gonzalo si "sobran" estados en `JobStatus`.** En una ronda de
   feedback dijo "me falta un estado pero también sobran otros" — se agregó el que
   faltaba (`PENDIENTE`) pero nunca confirmó cuáles le sobran. Candidatos
   sospechados: `NUEVO` y `APROBADO` — ya no los produce ningún flujo real desde que
   `createJob` inserta `PENDIENTE` directamente, pero no se borraron del enum/type
   por las dudas de que haya jobs viejos con ese estado o que Gonzalo los quiera
   igual. Si confirma que sobran, hay que sacarlos de `JobStatus` (types/index.ts),
   `STATUS_LABELS` y `KANBAN_COLUMNS` (catalog.ts), y de `SELECTABLE_STATUSES`
   (statusChange.ts) si es que seguían ahí.
5. **Confirmar si la Etapa 3 del wizard ("Producción"/checklist de etapas) se
   mantiene.** Gonzalo preguntó para qué servía — se le explicó que permite trackear
   el avance por etapa individual (diseño/impresión/corte/etc.) más fino que el
   estado general del trabajo, visible en la ficha (tab "Producción"). Quedó
   pendiente que confirme si le sirve así o si prefiere simplificarlo/sacarlo.
6. **Completar el contenido de "Manual de uso"** (`ManualPage.tsx`) — la estructura
   ya está (una sección por área: Dashboard, Trabajos, Nuevo trabajo, Kanban,
   Chequeo de archivos, Usuarios), pero el contenido de cada una está vacío a
   propósito. Esperar a que Gonzalo dicte qué poner en cada sección — no inventar
   contenido.
7. **Revisar visualmente en un navegador real** los últimos cambios (Dashboard,
   Kanban, Login, Chequeo de archivos reskineado) — esta sesión no tuvo acceso a
   screenshots reales del navegador integrado (ver sección 3), todo se verificó por
   build + accessibility tree. Vale la pena una pasada visual completa apenas se
   pueda, comparando contra lo que Gonzalo ve en `bonta-app.vercel.app`.
8. Todo lo demás que surja de nuevas rondas de feedback de Gonzalo probando la app
   en vivo — el patrón de trabajo de esta sesión fue: Gonzalo prueba en el sitio
   deployado, vuelve con una lista numerada de pedidos/bugs, se implementan todos
   los que se puedan sin ambigüedad, se hace `npm run build` para verificar, y se
   comitea+pushea (Gonzalo lo pide en casi todas las rondas — dar por hecho que
   después de cambios que él pueda probar, conviene pushear salvo que diga lo
   contrario).

---

## 8. Configuración, credenciales y dependencias externas

### Variables de entorno
- `.env.local` (en la raíz, gitignored, **ya existe localmente con valores reales**,
  no hay que pedírselo a Gonzalo de nuevo salvo que falte): dos variables,
  `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Sacadas de Supabase Dashboard →
  Project Settings → API. **Nunca pedir, loggear ni usar la `service_role key`.**
- `.env.example` tiene el formato esperado (con placeholders) por si hay que
  recrear `.env.local` desde cero.
- Sin `.env.local`, la app arranca igual y muestra una pantalla explicando qué falta
  (`supabaseConfigured` en `lib/supabaseClient.ts`), en vez de romperse.

### Supabase
- Proyecto ref `mazbtflmitelfjgdxfne`. **No hay migration runner ni CLI de Supabase
  configurado** — todas las migraciones de `supabase/*.sql` se corren a mano,
  pegándolas en el SQL Editor del Dashboard de Supabase.
- Migraciones que se cree que están aplicadas en la base real (001 a 005 fueron
  parte de la configuración inicial antes de esta sesión; 006 y 007 se confirmaron
  corridas por Gonzalo el 23/08/2026, en un solo bloque con las tres sentencias
  `ALTER TABLE`): **001, 002, 003, 004, 005, 006, 007 — todas.** Si en algún momento
  aparece un error de "column does not exist" o similar al crear/editar un trabajo,
  lo primero a revisar es si falta correr alguna migración.
- El bug de `handle_new_user()` (sección 5/7) significa que el `001_schema.sql`
  local **no refleja exactamente** lo que hay corriendo en la base real para esa
  función puntual — todo lo demás del schema sí debería estar sincronizado.
- No se verificaron las políticas de RLS (`002_policies.sql`) contra los cambios de
  columnas de esta sesión (`code` nullable, `created_by_user_id`, `contact_phone`)
  — son políticas a nivel de fila, no de columna, así que en principio no deberían
  necesitar cambios, pero no se confirmó explícitamente.

### GitHub
- Repo: **https://github.com/GonzaloVarelaDSC/bonta-app** (público, decisión de
  Gonzalo). Conectado como remoto `origin` de este repo local.
- **No hay `gh` CLI instalado** en esta máquina. `git push` funciona autenticando
  vía el Windows Credential Manager (credenciales cacheadas de cuando Gonzalo
  conectó su otro repo, `WEB-estudio-Bonta`) — nunca pidió login interactivo en
  ninguna sesión de esta serie. Si en algún momento `git push` pide autenticación,
  puede abrir una ventana de navegador para loguearse — eso lo tiene que hacer
  Gonzalo, no la sesión de Claude.
- **No hay identidad de git configurada, ni local ni global**
  (`git config user.name`/`user.email` devuelven vacío, y `git config --global
  user.name` también). Todos los commits de esta sesión se hicieron con un override
  por-commit: `git -c user.name="Gonzalo Varela" -c user.email="gonzaa.gd@gmail.com"
  commit -m "..."`. **Nunca usar `git config --global`** para setear esto (ni nada
  más) sin que Gonzalo lo pida explícitamente — seguir usando el override `-c` en
  cada commit.

### Vercel
- Proyecto conectado al repo de GitHub de arriba, bajo la cuenta de Vercel de
  Gonzalo (workspace "gonzaagd-2653's projects", plan Hobby). Deploy automático en
  cada push a `main`.
- URL de producción: **https://bonta-app.vercel.app**
- Variables de entorno configuradas en el Dashboard de Vercel (Project → Settings →
  Environment Variables): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, mismos
  valores que `.env.local`. **Si cambian las credenciales de Supabase, hay que
  actualizar en los dos lugares por separado** — no están sincronizados
  automáticamente.

### Preview local dentro de Claude Code
- `.claude/launch.json` (agregado esta sesión) define una config `bonta-dev` que
  corre `npm run dev` en el puerto 5173. Para levantarlo desde el navegador
  integrado de Claude Code: `preview_start` con `name: "bonta-dev"`, después
  navegar a `http://localhost:5173/<ruta>`.
- **Ojo:** en esta sesión el panel de preview no compositeaba frames (`screenshot`
  tiraba timeout siempre) — la verificación visual se hizo con `get_page_text` y
  `read_page` (accessibility tree) en vez de capturas. Puede que en una sesión nueva
  sí funcione `computer{action:"screenshot"}`; probarlo temprano si hace falta
  revisar algo visualmente.

### Dependencias externas / servicios de terceros
- **Google Fonts** (Inter, Cormorant Garamond) — cargadas por `<link>` en
  `src/index.css`/`index.html` para la app React, y por separado dentro de
  `chequeo-archivos.html` (es un documento HTML aparte, necesita su propio
  `<link>`).
- **cdnjs.cloudflare.com** — `pdf.js` y `pdf-lib`, cargados por `<script src>` dentro
  de `chequeo-archivos.html` únicamente (no son dependencias de npm de este
  proyecto).
- **gonzalovareladsc.github.io/WEB-estudio-Bonta** — sitio público del estudio, de
  donde se sacaron el logo (`assets/img/logo-mark(-blanco).png`) y la frase del hero
  ("Del concepto a la pieza." + la bajada). Si hace falta más contenido/assets de
  marca en el futuro, ese es el lugar para buscarlos.

---

## 9. Actualización 25/08 (segunda sesión del mismo día — Kanban v2 y prioridad manual)

Dos rondas de cambios sobre el Kanban en la misma tarde, más un cambio que Gonzalo
aclaró que "no es del Kanban" pero pidió en el mismo intercambio. Reemplaza/actualiza
lo que decían las secciones 2 y 4 sobre estos temas puntuales.

1. **Columnas del Kanban — 7, no 6, en orden de cadena real**: Pendiente → Diseño →
   Producción → Control de calidad → Listo → Instalación → Terminado
   (`data/catalog.ts`, `KANBAN_COLUMNS`). Diseño y Producción se unieron en la
   primera ronda y se volvieron a separar en la segunda a pedido de Gonzalo — son
   tramos bien distintos del trabajo. Cada columna tiene su propio color (`ColumnTone`
   ahora tiene 7 valores, no 3) — se agregaron los tokens `review` (violeta, control
   de calidad) y `site` (verde azulado, instalación) en `tailwind.config.js`;
   Terminado usa grises `ink-*` en vez de un token nuevo.
2. **El board ya no scrollea horizontal con ancho fijo por columna** — es una grilla
   (`grid-cols-7`) que reparte el ancho disponible, con scroll vertical por columna
   (no por el board entero) para que todo entre en una sola vista en una pantalla de
   escritorio normal. El drag&drop usa `DragOverlay` de `@dnd-kit` (la tarjeta
   arrastrada se renderiza en un portal aparte) — sin esto, la tarjeta quedaba
   recortada por el `overflow-y-auto` de su columna de origen en vez de pasar por
   encima del resto del board.
3. **Ficha del Kanban, mucho más chica que la ficha completa**: código de Copernico +
   countdown arriba (dos chips en los extremos), cliente y nombre del trabajo en una
   sola línea horizontal (cliente en negrita y oscuro, nombre en gris de apoyo), y
   fecha en su propia línea abajo, sola, para que nunca desborde el ancho de la
   tarjeta. No muestra estado/prioridad/avatares — el estado ya lo dice la columna.
4. **Trazabilidad de fechas por columna** (`Job.readyAt` / columna `jobs.ready_at`,
   migración `008_job_ready_at.sql`): se graba sola, una única vez, la primera vez
   que un trabajo llega a Listo o Instalación (`store/useStore.ts`, `setStatus` —
   no se pisa después). La ficha del Kanban muestra esa fecha ("Listo dd/mm") en
   las columnas Listo/Instalación, y la fecha de asignación (`createdAt`, "Asignado
   dd/mm") en el resto. **Si en algún momento cambiar el estado de un trabajo tira un
   error de columna inexistente, lo primero a chequear es si la migración 008 ya se
   corrió** (mismo patrón que el bug de `contact_phone`, sección 5).
5. **El gate de control de calidad para pasar a Listo (decisión 8, sección 4) sigue
   vigente y es intencional, no un bug** — `createJob` siembra los ítems de
   `QC_TEMPLATE` sin tildar para todo trabajo nuevo, así que CUALQUIER trabajo recién
   creado va a rechazar el pase a Listo hasta que se tilden los ítems obligatorios
   desde la ficha completa (tab Control de calidad). Si Gonzalo reporta "no me deja
   pasar una ficha a Listo", esto es lo primero a explicar/revisar antes de asumir
   que es un bug.
6. **`supabase/seed_test_job.sql`** — script opcional (no numerado, no es parte de
   la cadena de migraciones) que crea un trabajo de prueba (`PRUEBA-001`) con todos
   los ítems de control de calidad ya tildados, para poder arrastrarlo libremente
   por las 7 columnas sin que el gate del punto 5 lo frene. Tiene el DELETE
   comentado al final para borrarlo cuando ya no haga falta.
7. **La prioridad de un trabajo ya NO se calcula automáticamente por fecha** —
   Gonzalo pidió que sea *siempre* una decisión manual suya. `calculateAutoPriority()`
   se borró de `lib/priority.ts` (en los hechos ya era código muerto: nunca se
   llamaba desde `createJob`, que solo mandaba `priority_manual`; `priority_auto`
   vivía siempre en el default `'NORMAL'` de la columna). El wizard ahora pide la
   prioridad como campo obligatorio (sin opción "calcular sola"), y la ficha completa
   ya no tiene la opción "volver a prioridad automática" — siempre hay que elegir una
   de las 5. El badge de prioridad ya no muestra la etiqueta "manual" (todas lo son).
   `priorityAuto`/`priority_auto` se dejaron en el esquema como respaldo silencioso
   para trabajos viejos sin `priorityManual` cargado, nada más.

---

## 10. Actualización 26/08 — auditoría de diseño/accesibilidad, Carga rápida y ajustes de flujo

1. **Auditoría propia**: se corrió design-critique + accessibility-review (skills en
   `.claude/skills/`) sobre las 10 pantallas y se corrigieron los hallazgos en el
   código (no quedó como informe aparte): contraste de texto secundario
   (`ink-400/500/300/600` → `ink-700`, 6.5:1), anillo de foco (`brand-400/40` →
   `brand-500`, 4.4:1), operabilidad por teclado del Kanban y de la tabla de
   Trabajos, `aria-label`/`aria-pressed`/`htmlFor` en toda la app, patrón ARIA de
   tabs en la ficha. Se dejó sin tocar lo que ya pasaba (Sidebar, panel de marca
   del Login, badges de prioridad/estado).
2. **Bug de `readyAt` corregido**: antes se grababa una sola vez y nunca se volvía
   a pisar, así que un trabajo de prueba arrastrado a Listo varias veces (en
   distintos días) seguía mostrando la fecha de la primera vez. Ahora se vuelve a
   grabar cada vez que el trabajo ENTRA a Listo/Instalación viniendo de un estado
   que no era parte de ese grupo — no se pisa al pasar de Listo a Instalación
   (sigue siendo la fecha real de "cuándo quedó lista la producción").
3. **Prioridad con plazo de referencia**: `PRIORITY_META` (`lib/priority.ts`) suma
   un campo `sla` por prioridad — es una propuesta de Gonzalo/Claude, no una regla
   cerrada, a confirmar con el uso real: Crítico = para mañana sí o sí, Urgente =
   2-3 días hábiles, Normal = dentro de la semana, Planificado = más de una
   semana, En espera = no corre plazo. Se ve como tooltip del `PriorityBadge`
   (aparece en toda la app automáticamente) y como texto de cada opción en los
   selects de prioridad del wizard/Carga rápida/ficha.
4. **Selector de estado reducido a 4 opciones manuales** (`lib/statusChange.ts`,
   `SELECTABLE_STATUSES`): Falta información, En diseño, En producción, Listo
   para entrega — el resto de los estados (Pendiente, Diseño listo, Control de
   calidad, Instalación, Terminado, Bloqueado, Cancelado) se alcanzan por su
   propio flujo (alta, drag en el Kanban, motivo de bloqueo, instalación
   completada) y no compiten más en el select de Dashboard/Trabajos/ficha. Nueva
   función `statusOptionsFor(job)` agrega el estado actual a la lista si no es
   una de esas 4, para que el select nunca quede en blanco. De paso se encontró
   que el select de la ficha completa llamaba a `setStatus` directo, salteando el
   gate de control de calidad — ahora pasa por `tryChangeJobStatus` como el resto.
   **El Kanban (7 columnas) no se tocó** — es una vista distinta (tablero, no
   dropdown) que Gonzalo ya iteró tres veces; si en algún momento pide simplificar
   también las columnas, sería un cambio deliberado aparte.
5. **`DashboardJobCard` ahora navega al clickear cualquier zona no interactiva**
   de la tarjeta (mismo resguardo `closest('select, button, input')` que ya usan
   JobsTable y el Kanban) — el botón "Ver ficha" se mantiene como antes, esto solo
   agrega un camino más.
6. **Carga rápida simplificada** (`QuickJob/QuickJobPage.tsx`): el campo Cliente
   ya no pide "tal cual figura en Copernico" (un cliente nuevo lógicamente todavía
   no está ahí); Cantidad y Medidas se unificaron en un solo textarea libre
   ("Cantidad y medidas") para poder anotar variantes mixtas de un mismo pedido
   (ej. "2 de 20x20, 3 de 10x10, 1 a medida de la imagen") sin forzar una grilla
   rígida — se investigaron plataformas reales de gestión de imprentas (shopVOX,
   Printavo) antes de decidir esto: ese tipo de software solo estructura campos
   fijos (alto/ancho/color/etc.) para productos de catálogo configurables, no
   para pedidos a medida como los de Bonta, donde el texto libre es lo que de
   verdad se usa en la práctica. Se sacaron Técnica/Color/Terminación del
   formulario (Gonzalo: "no existe" en la carga rápida) — siguen existiendo en el
   modelo de datos y se pueden cargar después desde la ficha si hace falta.

---

## 11. Actualización 26/08 (segunda ronda) — medidas estructuradas, ficha ver/editar, exportar a cliente

1. **Medidas estructuradas (`Job.sizeItems`)**: reemplaza el campo libre
   `measurements` en los formularios (Gonzalo pidió volver a esto después de
   ver la versión de texto libre: "boxes cantidad-ancho-alto" con botón de
   agregar). Nuevo tipo `SizeItem { quantity, width, height }` (todo texto
   libre a propósito, así "a medida de la imagen" entra en el campo ancho/
   alto), columna `jobs.size_items jsonb` (migración `009_job_size_items.sql`
   — **hay que correrla en Supabase**), componente compartido
   `Common/SizeItemsEditor.tsx` (`SizeItemsEditor` para cargar/editar,
   `SizeItemsView` de solo lectura) usado en Carga rápida, la ficha y el
   export a cliente. `measurements`/`quantity`/`technique`/`finish`/`color`
   quedan en el esquema marcados `@deprecated` en `types/index.ts` — no se
   borran (datos viejos), pero ningún formulario los toca más.
2. **Especificaciones de la ficha: ver vs. editar**: antes quedaba siempre en
   modo formulario; ahora arranca en modo lectura (como el resto de las
   pestañas) y un botón "Editar especificaciones" pasa a edición; "Guardar"
   vuelve a lectura con los valores nuevos, "Cancelar" descarta los cambios.
   Se le aplicó el mismo recorte que a Carga rápida (sin Técnica/Color/
   Terminación).
3. **Exportar a cliente** (`JobDetail/JobExportPage.tsx`, ruta
   `/trabajos/:id/exportar`, fuera del `AppLayout` — sin sidebar, pensada para
   imprimir): hoja de referencia con logo + nombre del estudio, cliente,
   descripción, medidas, material, instalación y fecha de entrega — **sin**
   prioridad ni estado interno (a propósito, es lo que no debe ver el
   cliente). Se "exporta" con el diálogo nativo de impresión del navegador
   (botón "Imprimir / Guardar como PDF" → `window.print()`), no con una
   librería de generación de PDF — evita sumar una dependencia nueva y el
   usuario elige tamaño de papel/destino con la interfaz que ya conoce.
   Accesible desde un botón "Exportar para cliente" en la cabecera de la
   ficha (abre en pestaña nueva).
4. **Bug del contador del Kanban corregido**: "N trabajos activos" contaba
   también los Terminados (por eso no cambiaba al mover una ficha a esa
   columna) — ahora los excluye.

---

## 12. Actualización 26/08 (tercera ronda) — se retira el wizard, alta única en Carga rápida

1. **Se elimina `NewJobWizard`** (`src/components/NewJob/`, borrado) — Gonzalo notó que
   coexistían dos formularios de alta con distinto nivel de detalle (el wizard no
   pedía especificaciones, Carga rápida sí) y eso generaba confusión real de cara al
   equipo. Decisión: un solo camino de alta, **Carga rápida**, para no repetir
   trabajo ni tener dos UX distintas para lo mismo. La ruta `/trabajos/nuevo` ahora
   redirige a `/trabajos/rapido`; el botón "Nuevo trabajo" de Trabajos apunta ahí.
2. **Validación relajada** (`QuickJobPage.tsx`): la única condición dura para poder
   crear el trabajo es tener al menos una medida cargada (`sizeItems`). Cliente,
   nombre, descripción, fecha de entrega y dirección de instalación avisan con un
   `confirm()` si faltan pero NO bloquean — se completan con un valor de referencia
   ("Cliente sin especificar", fecha +7 días, etc.) y se pueden terminar de cargar
   después desde la ficha.
3. **Prioridad sugerida automáticamente según la fecha, pero 100% editable**: al
   elegir/cambiar la fecha de entrega (a mano o con los chips rápidos), la
   prioridad se precarga sola (mañana o antes → Crítico, 2-3 días → Urgente, hasta
   la semana → Normal, más → Planificado) — el campo sigue siendo un select normal,
   se puede cambiar en cualquier momento y esa elección manual no se vuelve a pisar
   sola. No es el viejo `calculateAutoPriority()` que se borró en la sección 9 —
   es solo un default inteligente en el momento de elegir la fecha.
4. **Catálogo de "Tipo de trabajo" sintetizado**: de 17 verticales abstractas
   (Señalética, Ambientación, Stands, Eventos, etc.) a 10 agrupadas por máquina/
   proceso real: Impresión V7000, Impresión S40, Impresión P9000 (máquinas
   distintas, a propósito separadas), Corte láser, Corte CNC, Corpóreo,
   Carpintería, Acrílico, Vidrieras y stands, Otro. Los ids viejos siguen
   existiendo en la base y en el tipo `JobTypeId` (por los trabajos de prueba que
   ya los tienen) pero ya no se ofrecen en ningún selector — ver migración 011.
5. **Eliminar un trabajo**: botón en la tabla de Trabajos (ícono de tacho, solo
   admin/coordinador) con confirmación nativa antes de borrar. Hacía falta agregar
   la policy de DELETE en `jobs` (no existía ninguna — con RLS activado y sin
   policy, quedaba denegado por default) — ver migración 010. Todos los hijos ya
   tenían `on delete cascade`, así que un solo `delete` alcanza.
6. **`vercel.json` nuevo**: sin esto, F5 en cualquier ruta que no sea `/` tiraba
   404 (Vercel no sabía que las rutas las resuelve React Router del lado del
   cliente). Rewrite estándar de SPA: todo lo que no matchee un archivo real cae a
   `index.html`.
7. **Sidebar**: el wordmark "Estudio Bonta" ahora es un link al Dashboard.
8. **Bug de RLS en notificaciones** (`new row violates row-level security policy
   for table "notifications"`, aparecía al asignar a alguien que no es quien
   crea el trabajo): el archivo `002_policies.sql` ya tiene la policy correcta
   (`with check (true)`) pero evidentemente nunca se volvió a aplicar contra la
   base real después de haber quedado más restrictiva en algún momento — mismo
   patrón que los bugs de `contact_phone`/`ready_at` de antes. Hay que volver a
   correr ese bloque puntual en el SQL Editor (ver el chat de esa fecha para el
   SQL exacto, o repetir el bloque "notificaciones" completo de `002_policies.sql`).

---

## 13. Actualización 26/08 (cuarta ronda) — `isProducer`, prolijidad de Especificaciones

1. **`User.isProducer`** (columna `profiles.is_producer`, migración 012):
   separa el rol de permisos (`role` — admin ve Usuarios/Configuración) de si a
   la persona le asignan trabajos de verdad. Pancho es `admin` pero dueño, así
   que `is_producer = false` — no aparece más en "Responsable interno"/
   "Asignar a". Gonzalo es `admin` Y productor a la vez (`is_producer = true`,
   el default de la columna). Si se suma gente nueva que sea solo dueño/
   coordinador sin procesar trabajos, hay que acordarse de poner
   `is_producer = false` a mano — no hay UI para esto todavía, es directo en
   `profiles`.
2. **`SizeItemsEditor`/`SizeItemsView`** (`Common/SizeItemsEditor.tsx`)
   rediseñados con una tarjeta con líneas divisorias (mismo lenguaje que el
   checklist de control de calidad) — antes eran inputs sueltos sin ningún
   contorno que los agrupara, Gonzalo lo vio como "no hay renglones ni nada".
3. **Carga rápida**: el campo "Contacto" quedó solo con el nombre — se sacó
   "Tel. / WhatsApp" del contacto puntual (dato de más para la carga rápida,
   Gonzalo lo pidió explícitamente). `contactPhone` se sigue mandando vacío al
   crear el trabajo; se puede cargar después si hace falta.
4. **Botón de eliminar en Trabajos**: pasa de gris-que-se-pone-rojo-al-hover a
   rojo siempre (`text-crit`) — Gonzalo lo veía poco visible.
