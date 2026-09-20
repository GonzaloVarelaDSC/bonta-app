# Estudio Bonta — Sistema de producción — Contexto para retomar en Claude Code

Este archivo es un handoff completo para que una sesión nueva de Claude Code, sin
memoria de las sesiones anteriores, pueda seguir trabajando en este proyecto sin que
Gonzalo tenga que reexplicar nada. Se escribió originalmente el 25/08/2026 y se fue
actualizando ronda a ronda desde entonces — la sección 1 a 8 son la base original
(puede tener frases con fecha vieja, ignorarlas) y las secciones numeradas al final
(9 en adelante, cada una fechada) son el historial de cambios en orden cronológico;
**la última —hoy, la de fecha más reciente— es la que manda sobre cualquier cosa que
la contradiga más arriba**. Última actualización: 20/09/2026 (sección 48).

Fue escrito por la sesión de Claude Code que hizo casi todo el trabajo de UI/UX,
deploy y ajustes de esta Fase 1, en una serie larga de intercambios con Gonzalo
probando la app en vivo y pidiendo cambios ronda tras ronda. Si algo de acá contradice
lo que ves en el código, confiá en el código — este archivo puede quedar desactualizado
si se siguen haciendo cambios sin actualizarlo. **Al terminar una ronda de cambios,
actualizar este archivo (agregar o editar la sección "Actualización" correspondiente)
antes de dar la ronda por cerrada — así ninguna sesión nueva pierde contexto.**

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

**Quién lo va a usar:** el plan original era ~7 personas con roles distintos (ver
memoria `project_team_roles` de Claude); al 03/09/2026 **5 de 7 ya tienen cuenta
real y están usando la app** — Gonzalo, Gastón, Pancho, Martín y Alejandra (ver
sección 3 para el detalle de rol/permiso de cada uno, y sección 17 para un ajuste
pendiente de confirmar sobre Gastón). Faltan Nancy y Richard.
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
- **Cuentas del equipo — 5 de 7 creadas.** Gonzalo, Gastón, Pancho, Martín y
  Alejandra ya tienen cuenta real en Supabase Auth, confirmado con un SELECT el
  03/09 (ver sección 16, punto 2 — nombre y rol correctos para los 5). Nancy y
  Richard: todavía sin arrancar, ver sección 7 punto 1. **Pendiente de
  confirmar si Gonzalo ya corrió el SQL de la sección 17, punto 3** (sube a
  Gastón a rol `coordinador` + pone `credits_as_assigner = false` en Gastón/
  Pancho/Martín) — se le dio el SQL con los emails reales el 03/09 pero no
  confirmó haberlo corrido. Verificar con
  `select name, email, role, credits_as_assigner from profiles order by name;`
  antes de asumir que ya está aplicado (emails reales, confirmados por
  screenshot el 03/09: Gastón `gastonebenitez@outlook.com`, Pancho
  `panchobonta@gmail.com`, Martín `martin@estudiobonta.com.ar`, Alejandra
  `alejandra@estudiobonta.com.ar`, Gonzalo `gonzaa.gd@gmail.com`).
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
2. **Crear las cuentas de Supabase Auth de los ~7 empleados** — 5 de 7 ya
   creadas y confirmadas (Gonzalo, Gastón, Pancho, Martín, Alejandra; ver
   sección 3). Faltan **Nancy y Richard** (coordinadores, mismo perfil que
   Alejandra: `role='coordinador'`, `is_producer=false`,
   `credits_as_assigner=true`) — falta juntar sus emails reales. Antes de
   avanzar acá, confirmar si el SQL pendiente de la sección 17 punto 3 (rol de
   Gastón + `credits_as_assigner`) ya se corrió.
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
- Migraciones que se cree que están aplicadas en la base real: **001 a 014,
  todas.** 001-005 fueron parte de la configuración inicial; 006 y 007 se
  confirmaron corridas por Gonzalo el 23/08/2026; 008-012 se infieren aplicadas
  porque las features que dependen de ellas (fecha "Listo" del Kanban, medidas
  estructuradas ya migradas a Productos, borrar trabajo, `isProducer`) funcionan
  en producción sin errores de RLS/columna reportados; **013 confirmada
  corrida por Gonzalo explícitamente**; **014 confirmada con un SELECT**
  (screenshot del 03/09 mostrando la columna `credits_as_assigner`). Si en
  algún momento aparece un error de "column does not exist" o similar al
  crear/editar un trabajo, lo primero a revisar es si falta correr alguna
  migración — no hay migration runner, así que esto puede pasar en cualquier
  momento si Gonzalo se salteó una.
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
- **Ojo:** en la sesión del 25/08 el panel de preview no compositeaba frames
  (`screenshot` tiraba timeout siempre) y la verificación visual se hizo con
  `get_page_text`/`read_page` en vez de capturas. En sesiones posteriores
  (02/09 en adelante) `preview_start` + `read_console_messages` funcionaron
  normal para smoke-tests (sin login real, porque no puedo autenticarme como
  Gonzalo — ver regla de contraseñas). Si hace falta revisar algo visualmente
  con capturas reales, probar `computer{action:"screenshot"}` temprano; si
  vuelve a fallar, caer al método de texto.

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

---

## 14. Actualización 02/09 — `Job.products`: un trabajo puede tener varios productos

Gonzalo explicó que un trabajo real casi nunca es "un material, una medida": son
pedidos combinados de un mismo cliente (ej. "Corpóreo 3D" + "Corpóreo en acrílico"
en el mismo trabajo), cada material tiene variables propias (espesor, PAI, color de
acrílico lechoso/cristal, con o sin base, mate/brillo/satín, montado o no y su
demasía de 7mm por lado salvo montaje en PVC — valor confirmado por Gonzalo el
07/09, reemplaza el "5mm" que se mencionó en alguna ronda anterior), y pidió poder chequear qué producto ya está
procesado sin que eso bloquee cambiar el estado del trabajo. También pidió poder
editar la fecha de entrega después de creada la ficha, y sacar el aviso de "falta
archivo" que saltaba siempre.

1. **`Job.sizeItems`/`Job.materialIds` reemplazados por `Job.products: Product[]`**
   (`types/index.ts`). Cada `Product` es
   `{ id, label, materialIds: MaterialId[], sizeItems: SizeItem[], notes: string,
   checked: boolean }`. **Decisión deliberada: espesor/color/mate-brillo-satín/con-
   o-sin-base/montado-o-no/demasía NO se modelaron como campos rígidos** — son
   demasiadas combinaciones específicas del oficio (por máquina, por material) para
   codificarlas bien sin arriesgarse a errar la regla real; en vez de eso, cada
   producto tiene un campo `notes` de texto libre con placeholder de ejemplo
   ("Acrílico 5mm cristal", "Vinilo con base, montado en PVC (sin demasía)"). Si en
   algún momento se ve que hace falta estructurarlo, es un cambio a proponer
   explícitamente, no algo para inventar de nuevo. `sizeItems`/`materialIds` sueltos
   quedan `@deprecated` en el tipo `Job` (no se borran, datos viejos).
2. **Corpóreo → sugiere agregar plantilla de vinilo de corte**: en
   `Common/ProductsEditor.tsx`, si `jobTypeId === 'corporeo'` y ningún producto
   cargado tiene "plantilla" en el nombre, aparece un banner descartable
   (`Lightbulb`, tokens `review-bg`/`review-text`) con un botón "+ Agregar" que
   precarga `{ label: 'Plantilla de vinilo de corte', materialIds: ['vinilo'] }` —
   nunca se agrega solo, es un click. Refleja la regla de Gonzalo ("95% de las
   veces lleva su plantilla") sin forzarla para el 5% restante.
3. **Pestaña "Especificaciones" de la ficha renombrada a "Productos"**
   (`JobDetailPage.tsx`, `ProductsTab`) — mismo patrón ver/editar que ya tenía
   (arranca en lectura, "Editar productos" pasa a edición, Guardar/Cancelar).
   En modo lectura usa `ProductsView`, que muestra un contador "N de M productos
   procesados" y, dentro de cada tarjeta de producto, un **checkbox "procesado"
   siempre clickeable** (no hace falta entrar a modo edición) que llama a la nueva
   acción del store `toggleProductChecked` — completamente desacoplado de
   `tryChangeJobStatus`/`SELECTABLE_STATUSES`: tildarlo o no **nunca** bloquea ni
   condiciona el cambio de estado del trabajo, es puramente informativo para que
   quien está procesando sepa qué le falta (punto 8 del pedido de Gonzalo, cumplido
   literal: "que no sea obligatorio... que no prohiba cambiar el estado").
4. **`missingFields()`/`isMissingInfo` (`lib/selectors.ts`, `lib/risk.ts`) ya no
   miran archivos** — el único campo que puede marcar "falta información" ahora es
   no tener ningún producto cargado, o requerir instalación sin dirección. El
   viejo aviso "Faltan datos para producción: Archivo" (Gonzalo: "es raro que se
   vaya a usar, no advertir nada") desapareció; subir archivos sigue existiendo,
   simplemente dejó de ser una condición de "trabajo incompleto".
5. **Fecha de entrega comprometida editable en la ficha** — antes de esta ronda
   solo se cargaba al crear el trabajo. Ahora, en la pestaña General de
   `JobDetailPage.tsx`, si `canChangePriority(user.role)` (admin/coordinador) el
   campo es un `<input type="date">` editable in place que llama a la nueva acción
   `updateCommittedDate` del store; para el resto de los roles sigue siendo de
   solo lectura. Coincide con el trigger `jobs_update_guard` de `002_policies.sql`,
   que ya restringía `committed_date` a esos roles a nivel de base — la UI ahora
   respeta esa misma regla en vez de no ofrecer edición para nadie.
6. **`JobExportPage.tsx`** (hoja para el cliente) actualizada para iterar
   `job.products` en vez de los campos planos viejos — cada producto se exporta
   como su propia sección con nombre, material (vía el helper `materialLabels()`),
   medidas y notas. Sin esto, cualquier trabajo cargado después de este cambio
   exportaría una hoja de cliente vacía de especificaciones.
7. **Migración `013_job_products.sql`** — agrega la columna:
   ```sql
   alter table jobs add column if not exists products jsonb not null default '[]'::jsonb;
   ```
   También sumada a `001_schema.sql` para instalaciones nuevas.

---

## 15. Actualización 02/09 (segunda ronda) — bug de RLS al asignar, QC deja de bloquear, KPIs consistentes, Pendiente vuelve al selector

Ronda de correcciones sobre lo recién probado en producción con la migración 013 ya
corrida.

1. **Bug de RLS `activity_log` al crear un trabajo con "Asignado por" distinto de
   quien lo carga de verdad.** `createJob` logueaba el evento "crear" con
   `input.createdByUserId` (el valor del dropdown "Asignado por", editable a
   propósito para acreditar el trabajo a otra persona — ver sección 13), pero la
   policy `activity_log_insert` exige `user_id = auth.uid()`. Si alguien cargaba un
   trabajo y elegía como "Asignado por" a otra persona (ej. Gonzalo tipea el pedido
   pero acredita a Pancho), el insert del historial violaba RLS y toda la creación
   fallaba. Se corrigió logueando con `get().currentUser?.id` (quien está
   realmente autenticado) en vez del valor del dropdown — "Asignado por" se sigue
   guardando tal cual en `jobs.created_by_user_id`, sin cambios ahí.
2. **Control de calidad deja de bloquear el pase a "Listo"** — mismo criterio que
   ya se había aplicado al checklist de Productos (sección 14, punto 3): Gonzalo
   pidió extender "que no sea obligatorio, que no prohíba cambiar el estado" a
   control de calidad también. `tryChangeJobStatus` (`lib/statusChange.ts`) ya NO
   devuelve `false` ni frena el cambio — si quedan ítems obligatorios sin marcar,
   muestra un `alert()` de recordatorio (mismo tono que la sugerencia de plantilla
   de vinilo) pero el estado cambia igual. El banner de la pestaña Control de
   calidad en la ficha se reescribió para no sonar a bloqueo ("Quedan N ítems...
   es solo un recordatorio"). El checklist en sí sigue existiendo y tildándose
   igual que siempre — lo que cambió es únicamente que no frena nada.
3. **Nuevo ítem de control de calidad: "Imagen espejada (si es impresión bajo
   acrílico)"** (`QC_TEMPLATE`, `data/catalog.ts`) — Gonzalo: paso crítico del
   oficio (bajo acrílico se ve desde el frente pero se imprime del lado de atrás;
   si no se espeja la imagen antes de imprimir, la pieza sale al revés y hay que
   rehacerla). Se agregó como ítem `required: true` en la plantilla uniforme que
   se siembra en TODOS los trabajos nuevos (mismo patrón que el resto de
   `QC_TEMPLATE`, que ya tenía ítems no aplicables a todos los tipos de trabajo,
   como "Corte correcto") — no hay mecanismo hoy para sembrar ítems de control de
   calidad condicionados por tipo de trabajo/material (sería "checklist
   configurable", explícitamente fuera de alcance de esta fase). Como el gate ya
   no bloquea (punto 2), no hay costo real en que aparezca en trabajos donde no
   aplica: se ignora sin efecto. **Ojo:** al sembrarse solo en `createJob`, este
   ítem nuevo aparece únicamente en trabajos creados después de este cambio, no
   en los ya existentes (no hace falta migración SQL — `quality_checks` es tabla
   normal, no jsonb).
4. **KPIs del Dashboard ahora escopeados a "Solo asignados a mí"** — antes los
   cubos de arriba (`computeCounts`) se calculaban sobre TODOS los trabajos
   visibles para el usuario, pero al hacer click el listado de abajo sí aplicaba
   el toggle "Solo asignados a mí" — así un cubo podía mostrar, por ej., "1" en
   "En producción" y al tocarlo aparecer vacío porque ese trabajo puntual era de
   otra persona. Gonzalo lo reportó como "no tengo para ver los trabajos en
   producción". Se corrigió escopeando el conjunto de trabajos ANTES de calcular
   `counts` (`DashboardPage.tsx`, variable `scoped`), así el número del cubo y lo
   que aparece al clickearlo siempre coinciden.
5. **"Pendiente" vuelve a `SELECTABLE_STATUSES`** (`lib/statusChange.ts`) —
   la ronda del 26/08 (sección 10, punto 4) lo había sacado del selector manual a
   propósito (se alcanzaba solo al crear el trabajo), pero Gonzalo pidió poder
   volver un trabajo a Pendiente a mano (por ej. si se lo pasó de estado por
   error). Ahora el select de Dashboard/Trabajos/ficha tiene 5 opciones:
   Pendiente, Falta información, En diseño, En producción, Listo para entrega.

---

## 16. Actualización 03/09 — cubo "En diseño", cuentas de Martín/Alejandra, próximo paso: base de conocimiento de materiales

1. **Nueva tarjeta de KPI "En diseño"** en el Dashboard (`lib/selectors.ts`,
   `computeCounts` — campo `inDesign`, cuenta `EN_DISENO` + `DISENO_LISTO`;
   `DashboardPage.tsx`, filtro `inDesign`). Se agregó el tono `info` a `KpiCard`
   (`Common`/`Dashboard/KpiCard.tsx` — antes solo tenía `crit/urg/norm/plan/wait/
   neutral`), usando el token `info` ya existente en `tailwind.config.js` (el
   mismo azul que usa `statusTone()` para "En diseño" en badges/Kanban), para que
   el cubo nuevo matchee el color con el resto de la UI en vez de quedar gris
   genérico.
2. **Cuentas de Martín (dueño) y Alejandra (administración) — creadas y
   confirmadas.** Instrucciones paso a paso dadas a Gonzalo en el chat del
   03/09 para crearlas en Supabase Dashboard → Authentication → Users, más el
   UPDATE de `profiles` para dejarlas con nombre/rol correctos (mismo patrón
   ya usado con Gastón y Pancho). Martín: mismo perfil que Pancho
   (`role='admin'`, `is_producer=false` — dueño, no procesa trabajos).
   Alejandra: `role='coordinador'`, `is_producer=false` (solo carga trabajos,
   no es responsable de producción, igual que Nancy/Richard cuando se sumen).
   **Confirmado con un SELECT** (screenshot de Gonzalo, mismo día): las 5
   cuentas existentes (Gonzalo, Gastón, Pancho, Martín, Alejandra) tienen
   nombre y rol correctos — `role` de cada una: Gonzalo `admin`, Gastón
   `diseno` (**ver sección 17, punto 2 y 3 — pendiente de subir a
   `coordinador`, no confirmado si ya se corrió**), Pancho `admin`, Martín
   `admin`, Alejandra `coordinador`. Emails reales confirmados: Gastón
   `gastonebenitez@outlook.com`, Pancho `panchobonta@gmail.com`, Martín
   `martin@estudiobonta.com.ar`, Alejandra `alejandra@estudiobonta.com.ar`,
   Gonzalo `gonzaa.gd@gmail.com`.
3. **Pendiente para la próxima sesión — base de conocimiento de materiales**:
   Gonzalo quiere transmitir TODA su información técnica de materiales (ej.
   vinilo montado = demasía de 7mm por lado, distinto según esté montado o no,
   distinto en PVC — nota: esto ajusta/reemplaza el dato de "5mm" mencionado en
   la sección 14 punto 1, confirmar el valor correcto con él antes de usarlo en
   cualquier lado) para que quede plasmada (a) como ayuda contextual al cargar
   un trabajo y (b) como ítems de su checklist de Productos a medida que
   procesa. Se le propuso arrancar una conversación nueva para dictar esto (por
   volumen de contexto, ver punto 4) y, del lado técnico, evaluar extender el
   patrón ya construido de sugerencia dismissible (`ProductsEditor.tsx`, banner
   de "Plantilla de vinilo de corte" para Corpóreo) a más reglas material→
   recordatorio, en vez de volver a campos rígidos — coherente con la decisión
   de la sección 14 punto 1 de mantener el detalle técnico en texto libre.
   Todavía no se implementó nada de esto, es un pedido a desarrollar.
4. Esta sesión larga ya pasó por una compactación de contexto — se sugirió
   arrancar una conversación nueva específicamente para el dictado de
   materiales del punto 3, dado que va a ser información extensa y conviene
   tener presupuesto de contexto completo disponible. Este archivo (`CLAUDE.md`)
   sigue siendo el punto de continuidad entre sesiones — cualquier sesión nueva
   debe leerlo primero.

---

## 17. Actualización 03/09 (segunda ronda) — `User.creditsAsAssigner`: cargar un trabajo ≠ aparecer como quien lo asignó

Gonzalo: "a Gastón, Pancho y Martín permití cargar trabajos, pero que no aparezcan
como quien asignó". Dos cosas separadas que hasta ahora dependían las dos de
`role` nada más:

1. **`User.creditsAsAssigner`** (columna `profiles.credits_as_assigner`,
   migración `014_profiles_credits_as_assigner.sql`, default `true`) — nueva
   columna, independiente de `role` e `isProducer`. El selector "Asignado por"
   de Carga rápida (`QuickJobPage.tsx`, `assigners`) ahora filtra por
   `canCreateJobs(role) && creditsAsAssigner`, no solo por rol. Es un crédito de
   "quién de verdad coordinó el trabajo con el cliente" (Nancy, Richard,
   Alejandra, Gonzalo) — Gastón/Pancho/Martín pueden tener acceso al formulario
   igual (para cargar en un apuro) sin ensuciar ese selector con su nombre.
2. **Gastón pasa a rol `coordinador`** (antes `diseno`) — es el cambio mínimo
   para darle acceso real a Carga rápida: `canCreateJobs`/`jobs_insert` (RLS) y
   varias policies más que se disparan al crear un trabajo (`job_stages_write`,
   `quality_checks_write`, `installations_write`, `job_assigned_write`) están
   gateadas a `is_admin_or_coordinador()` a nivel de base — no hay forma de
   darle *solo* el permiso de crear sin subirlo a un rol que ya lo tenga, sin
   escribir una función SQL nueva y tocar cinco policies distintas. Efecto
   secundario aceptado: Gastón gana también `canEditAnyJob`/`canChangePriority`/
   `canAssign`/`canApproveFiles`/`canSeeStats`/`canDeleteJob` — más permiso del
   estrictamente pedido, pero consistente con cómo ya funciona el resto del
   equipo (Gonzalo es admin Y productor a la vez) y evita una migración de RLS
   mucho más grande para un beneficio marginal. Si en algún momento se ve que
   esto le da a Gastón acceso a algo que no debería tocar, avisar y ahí sí vale
   la pena separar el permiso de verdad.
3. **Migración 014 confirmada corrida** (Gonzalo pegó un screenshot del SELECT
   mostrando la columna `credits_as_assigner` ya presente, en `true` para los 5
   usuarios). **El SQL de abajo (rol de Gastón + `credits_as_assigner=false`)
   se le dio con los emails reales ya completados, pero Gonzalo NO confirmó
   haberlo corrido** — no asumir que ya está aplicado, verificar con
   `select name, email, role, credits_as_assigner from profiles order by name;`
   antes de dar por hecho el estado de Gastón/Pancho/Martín:
   ```sql
   update profiles set role = 'coordinador', credits_as_assigner = false
   where email = 'gastonebenitez@outlook.com';

   update profiles set credits_as_assigner = false
   where email in ('panchobonta@gmail.com', 'martin@estudiobonta.com.ar');
   ```
4. **Aclaración que surgió en el chat**: Gonzalo preguntó "¿pero ahora todos
   podemos crear trabajos entonces?" al ver que los 5 usuarios actuales quedan
   con `canCreateJobs` en `true` (los 5 son `admin` o `coordinador`). Se le
   aclaró que es coincidencia de que el equipo actual entero cae en esos dos
   roles, no un cambio de la regla — alguien con rol `produccion`/`instalacion`
   (ej. un instalador que se sume a futuro) seguiría sin poder cargar trabajos.
   No hace falta volver a explicar esto si no lo vuelve a preguntar.

---

## 18. Actualización 07/09 — acceso total dueños, filtro A mí / Por mí, tercerizadas, "Asignado por" = login, aviso de ficha nueva

Ronda grande, 13 puntos que trajo Gonzalo. Lo que sigue **manda sobre todo lo de
arriba que lo contradiga** — sobre todo la sección 17 (el desplegable editable de
"Asignado por" y `credits_as_assigner` quedan sin uso, ver punto 1).

### Cambios de código aplicados (build limpio; sin verificación visual con login — ver §3)

1. **"Asignado por" = siempre quien está logueado.** Se eliminó el desplegable
   editable de "Asignado por" de Carga rápida (`QuickJobPage.tsx`). Ahora
   `createdByUserId = user.id` fijo — si entrás con la cuenta de Martín, la ficha
   dice "Asignado por Martín", sin excepción. El que sí se elige es el
   **Responsable** (desplegable de productores) y opcionalmente "Asignar también
   a" (chips). **Consecuencia:** `User.creditsAsAssigner` /
   `profiles.credits_as_assigner` quedan en el esquema pero **la app ya no los
   lee** — ningún filtro los usa. No se borró la columna (no ameritaba otra
   migración). El SQL pendiente de §17.3 sobre `credits_as_assigner=false` **ya
   no hace falta**; lo único que queda de ese bloque es subir a Gastón a
   `coordinador` (ver "SQL a correr").

2. **Sección "Asignación" de Carga rápida rediseñada, con más peso visual**
   (punto 8): tarjeta destacada con borde bronce que muestra "Asigna: [vos] →
   Responsable: [select]" en una línea, con avatares. Copy nuevo aclara que el
   responsable lo ve en el filtro «A mí» del Dashboard y quien asigna en «Por mí».
   Los chips "Asignar a" pasaron a "Asignar también a".

3. **Cartel de asignación reforzado en las fichas** (punto 8):
   - `DashboardJobCard`: el pill de "Asignado por X" ahora muestra
     **`[asigna] → [responsable]`** con los dos avatares y `title` con la frase
     completa ("X asignó este trabajo a Y").
   - `JobDetailPage` (cabecera): mismo pill `asigna → responsable` con avatares
     20px y una micro-etiqueta "Asigna → Responsable" debajo.

4. **Filtro del Dashboard: `A mí` / `Por mí` / `Todos`** (punto 9). Reemplaza el
   checkbox "Solo asignados a mí" por un segmentado de 3 opciones
   (`DashboardPage.tsx`, tipo `ScopeMode`):
   - **A mí** = soy responsable o estoy en asignados.
   - **Por mí** = `job.createdByUserId === user.id` (yo lo asigné/cargué).
   - **Todos** = todo lo visible.
   Default por perfil: `user.isProducer ? 'mine' : 'byMe'` — Gastón/Gonzalo
   arrancan en "A mí" (su cola), Pancho/Martín/Alejandra/Richard/Nancy en "Por mí"
   (lo que metieron a producción). La elección se guarda en `localStorage`
   (`bonta-dash-scope`). Los cubos de KPI se escopean al mismo conjunto (igual que
   antes con `scoped`), así el número del cubo y lo que aparece al clickearlo
   siempre coinciden.

5. **Acceso total para dueños / "deshacer todo lo posible"** (puntos 1 y 10).
   Pancho, Martín y Gonzalo ya son `role='admin'` (confirmado §16.2), así que a
   nivel base ya pueden tocar cualquier campo (el trigger `jobs_update_guard`
   deja pasar a admin/coordinador). Lo que faltaba era en la UI: el **selector de
   estado** ahora, para admin/coordinador, ofrece la **lista completa**
   (`ADMIN_STATUSES` en `lib/statusChange.ts`) — incluye Procesado, Control de
   calidad, Instalación, **Terminado y Cancelado** — para poder corregir o
   **revertir** un estado puesto por error. `BLOQUEADO` no está en esa lista (se
   llega por el botón "Bloquear trabajo" para que quede el motivo); `NUEVO`/
   `APROBADO` tampoco (estados viejos, §7.4). Para roles no admin/coordinador el
   selector sigue con las 5 de siempre. `statusOptionsFor(job, role?)` recibe
   ahora el rol. `setStatus` además marca/limpia `finished_at` al entrar/salir de
   TERMINADO.

6. **Prioridad editable desde cualquier lado, sin que la fecha la trabe**
   (punto 10). La prioridad ya era 100% manual (§9.7) — el problema era que en
   Carga rápida, cambiar la fecha **pisaba** la prioridad elegida a mano. Ahora
   `priorityTouched`: una vez que la tocás, la fecha no la cambia más. Además:
   - `PrioritySelect` nuevo en `Common/Badges.tsx` (espejo de `StatusSelect`,
     con los colores del `PriorityBadge`).
   - `DashboardJobCard` usa `PrioritySelect` (para admin/coordinador) en vez del
     badge estático — se puede subir un trabajo a Crítico desde la lista aunque
     falten 10 días, si es un trabajo grande.
   - La ficha ya tenía el select de prioridad con las 5 opciones sin gate de
     fecha; sigue igual.

7. **El contador de días se congela cuando el trabajo ya salió** (punto 4).
   `CountdownBadge` recibe `status?` y, si el estado está en `CLOSED_STATUSES`
   (`LISTO_PARA_ENTREGA`, `LISTO_PARA_INSTALACION`, `EN_INSTALACION`, `TERMINADO`,
   `CANCELADO`), muestra un chip gris neutro ("✓ Listo" / "En obra" / "✓
   Entregado" / "Cancelado") en vez de seguir sumando "Atrasado Nd". Actualizado
   en `DashboardJobCard`, `JobsTable` y `JobDetailPage`.

8. **Piezas tercerizadas** (punto 5). `Product.outsourced?: boolean` nuevo
   (jsonb, sin migración). En `ProductsEditor` cada producto tiene un toggle
   "Tercerizada" (ícono camión); cuando está activo, la tarjeta del producto se
   marca con el color **`site`** (verde azulado — el mismo token de la columna
   Instalación del Kanban, sin carga de alarma). En `ProductsView` aparece un
   pill "Tercerizada" con ese color. Se ve en Carga rápida y en la pestaña
   Productos de la ficha. Decisión de color: `site` estaba libre fuera del Kanban
   y lee bien como "esto lo hace otro / está afuera".

9. **Aviso de "cayó una ficha nueva"** (punto 13). Dos partes:
   - `createJob` ahora notifica a: responsable + asignados + **todos los `admin`**
     (dueños), menos quien la está cargando. Texto: `Nueva ficha: "<nombre>".`
   - Suscripción realtime nueva a `notifications` (canal `my-notifications`) en
     `useStore.init()` — cuando cae una notificación para el usuario logueado, se
     prepende a la lista (la campana del Header se actualiza sola, sin recargar) y
     dispara un **toast** liviano abajo a la derecha (`Toast` en `AppLayout.tsx`,
     estado `toast` + `clearToast` en el store, se cierra solo a los 7s).
   - De paso: `init()` ahora tiene un guardo de módulo `realtimeStarted` para no
     registrar los canales de realtime dos veces (pasaba con StrictMode en dev y
     tiraba "cannot add postgres_changes callbacks after subscribe()"). Esto
     **arregla** un error que ya existía en `main`, no lo introduce.

10. **Skills** (punto 6): se corrió `frontend-design` (guía para el rediseño del
    cartel de asignación y el copy) y `accessibility-review` sobre lo nuevo. Se
    corrigieron: contraste del toggle "Tercerizada" activo (era blanco 11px sobre
    `site` `#0f9488` ≈ 3.3:1 — pasó a `site-text` `#0b6d63`, ~4.6:1), anillos de
    foco visibles en el segmentado del Dashboard / toggle Tercerizada / botón de
    cerrar el toast, y `aria-hidden` en íconos decorativos. El segmentado y los
    chips chicos siguen bajo 44px de alto (igual que el resto de la app — 2.5.5
    es AAA, no AA).

11. **Mobile: pendiente a propósito** (punto 11). No se tocó nada de responsive
    en esta ronda.

### SQL a correr en Supabase (SQL Editor → New query → Run)

**(a) Subir a Gastón a `coordinador`** — necesario para que pueda crear fichas
(RLS `jobs_insert` y varias policies más piden `is_admin_or_coordinador()`):

```sql
update profiles set role = 'coordinador'
where email = 'gastonebenitez@outlook.com';
```

**(b) Alta de Richard.** Primero crear el usuario en Supabase Dashboard →
Authentication → Users → Add user → `richard@estudiobonta.com.ar` /
contraseña `richard` (⚠️ débil — si Richard maneja datos reales conviene una más
larga; queda a criterio de Gonzalo). El trigger `handle_new_user` crea la fila
en `profiles` con rol `produccion`; después:

```sql
update profiles
set name = 'Richard', role = 'coordinador', sector = 'Coordinación', is_producer = false
where email = 'richard@estudiobonta.com.ar';
```

(Ajustar `name` al nombre completo real de Richard.)

**(c) Verificación:**

```sql
select name, email, role, is_producer, credits_as_assigner from profiles order by role, name;
```

Esperado: Pancho/Martín/Gonzalo en `admin`; Gastón/Alejandra/Richard en
`coordinador`; `is_producer=false` en Pancho/Martín/Alejandra/Richard.
`credits_as_assigner` ya no lo usa la app — ignorar esa columna.

### Lo que NO se pudo hacer en esta sesión (lo tiene que hacer Gonzalo)

- **Contraseña de Alejandra (punto 2):** no la tengo ni la puedo sacar — Supabase
  guarda solo el hash y la cuenta la creó Gonzalo a mano (§16.2). Email:
  `alejandra@estudiobonta.com.ar`. Si se perdió la contraseña: Supabase Dashboard
  → Authentication → Users → (Alejandra) → tres puntitos → "Reset password" o
  editar y poner una nueva.
- **Crear el usuario Auth de Richard (punto 3):** Claude no puede crear cuentas ni
  escribir contraseñas. Pasos arriba, "SQL a correr" (b).

### Tintero — cosas para definir/hacer más adelante (punto 12)

De "se cierra rápido" a "proyecto aparte":

1. **Base de conocimiento de materiales** — lo que íbamos a arrancar hoy (vinilo
   montado = demasía 7mm/lado, distinto en PVC, etc.). Plan: extender el patrón
   de banner sugerido dismissible que ya existe (Corpóreo → plantilla de vinilo)
   a más reglas material→recordatorio + ayuda contextual al cargar. Conviene
   conversación nueva por volumen de contexto. **Próximo gran tema.**
2. **Estados que "sobran"** (`NUEVO`, `APROBADO`) — ningún flujo los produce. Si
   Gonzalo confirma, sacarlos de `JobStatus` (types), `STATUS_LABELS`,
   `KANBAN_COLUMNS` (catalog) y listas de `statusChange.ts`.
3. **Manual de uso** (`ManualPage.tsx`) — estructura lista, contenido vacío a
   propósito, esperando que Gonzalo dicte qué va en cada sección.
4. **`credits_as_assigner`** — columna muerta desde esta ronda. Decidir si se
   dropea en una migración futura o se deja.
5. **Cuenta de Nancy** — falta su email real. Mismo perfil que Alejandra/Richard.
6. **Backport del fix de `handle_new_user()`** (bug de `search_path` con
   `SECURITY DEFINER`) — se parcheó en vivo hace tiempo pero `001_schema.sql`
   local no lo refleja. Bajarlo del historial de queries de Supabase.
7. **Subida real de archivos a Storage** — nunca implementado (`addFileVersion`
   guarda nombre/tamaño, no el binario). Plan en `supabase/README.md` (bucket
   `job-files`, columna `storage_path` ya existe).
8. **Etapa 3 del wizard / checklist de etapas** — Gonzalo preguntó para qué
   sirve; pendiente confirmar si se mantiene, simplifica o saca (vive en
   `job_stages` + pestaña Producción de la ficha).
9. **Revisión visual con login real** — esta sesión no pudo autenticarse (regla
   de contraseñas), solo verificó build limpio + carga del login sin errores de
   consola. Gonzalo tiene que mirar en `bonta-app.vercel.app`: Dashboard
   (segmentado A mí/Por mí/Todos + prioridad editable en la lista), Carga rápida
   (sección Asignación nueva), ficha (cartel asigna→responsable, selector de
   estado completo), Productos (toggle Tercerizada).
10. **Mobile** — responsive de verdad, diferido explícitamente (punto 11).
11. **Fuera de alcance Fase 1** (no es deuda, es a propósito): calendario,
    reportes completos, ficha de cliente extendida, checklist de calidad
    configurable desde admin, dependencias entre trabajos, plantillas,
    notificaciones push/email (el aviso de ficha nueva es in-app, no mail).

---

## 19. Actualización 08/09 — volver a Trabajos, Kanban con "asigna → responsable", tercerizadas ya en marcha, columnas renombradas, sin countdown en cerrados

Ronda corta sobre lo del 07/09 ya deployado. Gonzalo confirmó que **ya corrió en
Supabase** todo lo de la sección 18 (Gastón a `coordinador`, alta de Richard).

### Migración a correr en Supabase

`supabase/015_job_assigned_names.sql` (SQL Editor → New query → Run):

```sql
alter table jobs add column if not exists assigned_names text[] not null default '{}';
```

Sin esto, crear un trabajo con alguien en "Asignar también a" falla con
"column assigned_names does not exist". Sumada también a `001_schema.sql`.

### Cambios de código

1. **Botón "← Volver a Trabajos"** arriba de la cabecera de la ficha
   (`JobDetailPage.tsx`) — link fijo a `/trabajos` (siempre ahí, aunque hayas
   entrado desde el Dashboard o el Kanban; Gonzalo lo pidió apuntando a Trabajos).

2. **"Asignar también a" = lista fija de gente del taller** (punto 4). Ya no son
   los productores (perfiles de la app) sino 6 nombres sueltos:
   **Ares, Ariel, Hector, Jose, Jose Garra, Rolli** (constante `ASSIGN_ALSO_NAMES`
   en `data/catalog.ts`, orden alfabético). Como no tienen cuenta, no van a
   `job_assigned_users` (que referencia `profiles`) — se guardan como texto en
   `jobs.assigned_names` (`Job.assignedNames: string[]`, migración 015). En Carga
   rápida son chips toggle; en la ficha aparecen en el campo "Asignados" de la
   pestaña General (junto con los asignados-usuario si hubiera, que hoy no hay
   porque Carga rápida ya no setea `assignedUserIds` — lo manda vacío). Para
   agregar/sacar gente de esa lista **es cambio de código** (la constante), no hay
   UI.

3. **Responsable: solo Gonzalo y Gastón** (punto 3). No es cambio de código —
   `producers` filtra por `is_producer`. Gonzalo ya corrió el UPDATE en Supabase
   para dejar `is_producer = true` solo en ellos dos.

4. **Kanban — tarjeta rediseñada** (puntos 5 y 7). `CardBody` en `KanbanPage.tsx`
   ahora muestra: N° de Copernico + contador de días arriba, cliente (negrita),
   **`[asigna] → [responsable]`** (avatares 14px + nombres de pila), y la línea de
   fecha abajo ("Asignado dd/mm" / "Listo dd/mm" en columnas Listo/Instalación).
   Se sacó **solo** el nombre/descripción del trabajo. Mismo patrón visual
   `asigna → resp` que ya tienen `DashboardJobCard` y la cabecera de la ficha.
   - **Nota (corrección del mismo día):** primero se habían sacado también las
     fechas y el contador; Gonzalo aclaró "las fechas son importantísimas, me
     expresé mal" → se repusieron. El contador de días sigue sin aparecer en
     estados cerrados (lo maneja `CountdownBadge` con `status`).
   - El **botón "Filtros"** del Kanban (prioridad + responsable) **ya existía**
     desde antes — cubre el punto 6, no se agregó nada. El filtro de responsable
     ahora lista solo a Gonzalo/Gastón (por `is_producer`).

5. **El countdown desaparece del todo en trabajos cerrados** (punto 7). Antes
   (sección 18) mostraba un chip gris "✓ Entregado"; Gonzalo: "está pésimo eso".
   Ahora `CountdownBadge` devuelve `null` si el estado está en `CLOSED_STATUSES`
   (Listo para entregar / Listo para instalación / En instalación / Entregado /
   Cancelado). En `JobsTable`, la columna "Entrega" de un trabajo cerrado muestra
   la fecha en texto gris plano en vez de quedar vacía.

6. **Columnas del Kanban renombradas** (puntos 8 y 9), en `data/catalog.ts`
   `KANBAN_COLUMNS`:
   - "Listo" → **"Listo para entregar"**
   - "Terminado" → **"Entregado"**
   Además `STATUS_LABELS.TERMINADO` pasó de "Terminado" a **"Entregado"** en toda
   la app (badges, selectores, ficha). La key del enum sigue siendo `TERMINADO`,
   solo cambió la etiqueta visible. (Para trabajos con instalación "Entregado"
   se lee un poco raro pero el flujo termina igual.)

7. **Skills** (punto 10): `frontend-design`, `design-critique` y
   `accessibility-review` sobre lo nuevo. Correcciones: contraste de la fecha de
   trabajos cerrados en `JobsTable` (`text-ink-600` ≈ 4.3:1 → `text-ink-700`
   ≈ 5.6:1), `aria-hidden` en íconos decorativos nuevos (flecha del back, flecha
   del Kanban), foco visible en el link "Volver a Trabajos".

### Tintero — se suma a la lista de la sección 18

- **Texto automático para enviar al cliente** (punto 8): cuando un trabajo llega
  a "Listo para entregar", generar un texto listo para copiar/mandar al cliente
  ("Tu pedido N° X está listo para retirar en…"). Todavía no se diseñó nada —
  es una idea a desarrollar (¿dónde vive? ¿plantilla editable? ¿en la ficha, en
  el Kanban?). Queda anotado.
- **Gente de "Asignar también a"** es una constante en código (`ASSIGN_ALSO_NAMES`).
  Si el equipo de taller cambia seguido, evaluar moverlo a una tabla/catálogo
  editable. Por ahora lista fija.
- Sigue todo lo demás del tintero de la sección 18 (base de materiales, estados
  que sobran, manual, Nancy, fix `handle_new_user`, subida de archivos, etapas
  del wizard, mobile, revisión visual con login).

---

## 20. Actualización 08/09 (cont.) — puesto visible (`sector`) separado del permiso (`role`)

Gonzalo quiso que en la app cada uno figure con su **puesto en la jerga de la
empresa** (Pancho/Martín "Dueños/Dirección", Gastón "Diseñador", Richard/Alejandra
"Coordinadores", él "Diseño/Producción") **sin tocar los permisos** — dueños y él
tienen que seguir con acceso total.

**Decisión:** no se agregó un rol nuevo (`role` sigue siendo el motor de permisos:
`admin` = acceso total, `coordinador` = crea/asigna, etc. — meter un rol "dueño"
obligaba a tocar el enum, el check constraint, `my_role()`, `is_admin_or_coordinador()`
y varias policies de RLS para un cambio puramente cosmético). En su lugar se usa la
columna que ya existía, **`profiles.sector`**, como "puesto" visible:

- **Header** (`components/Layout/Header.tsx`): debajo del nombre ahora muestra
  `user.sector` (y si estuviera vacío, cae al label del `role`). Antes mostraba
  siempre el label del `role` ("Administrador", "Coordinador / Producción").
- **UsersPage** ya mostraba `role · sector` — sin cambios ahí (en la pantalla de
  admin sí conviene ver el permiso real).

**Estado de roles/puestos objetivo** (Gonzalo corre el SQL de abajo; verificar con
`select name, email, role, is_producer, sector from profiles order by role, name;`):

| Persona | `role` (permiso) | `is_producer` | `sector` (puesto visible) |
|---|---|---|---|
| Gonzalo | `admin` (acceso total) | true | Diseño / Producción |
| Pancho | `admin` (acceso total) | false | Dirección |
| Martín | `admin` (acceso total) | false | Dirección |
| Gastón | `coordinador` | true | Diseño |
| Alejandra | `coordinador` | false | Coordinación |
| Richard | `coordinador` | false | Coordinación |

**Ojo con Gastón:** su *puesto* dice "Diseño" pero su *permiso* sigue siendo
`coordinador` — lo necesita para poder crear fichas (RLS `jobs_insert` pide
admin/coordinador). Si en algún momento se quiere que Gastón tenga permisos
realmente de diseñador (no borrar trabajos, no cambiar prioridad de cualquiera,
etc.) es un laburo aparte de RLS, no alcanza con cambiarle el `sector`.

### SQL a correr en Supabase

```sql
update profiles set sector = 'Dirección'
where email in ('panchobonta@gmail.com', 'martin@estudiobonta.com.ar');

update profiles set sector = 'Diseño / Producción'
where email = 'gonzaa.gd@gmail.com';

update profiles set sector = 'Diseño'
where email = 'gastonebenitez@outlook.com';

update profiles set sector = 'Coordinación'
where email in ('richard@estudiobonta.com.ar', 'alejandra@estudiobonta.com.ar');
```

---

## 21. Actualización 08/09 (cierre) — todo verificado; próximo tema: pantalla de Configuración

### Estado

Gonzalo **probó en producción todo lo de las secciones 18, 19 y 20 y funciona**.
Los SQL de esas rondas están **corridos y confirmados**:

- **18:** Gastón a `role='coordinador'`; alta de Richard (`richard@estudiobonta.com.ar`,
  `role='coordinador'`, `is_producer=false`).
- **19:** migración `015_job_assigned_names.sql` (`jobs.assigned_names text[]`).
- **`is_producer`:** solo Gonzalo y Gastón en `true` (el resto `false`) — "Responsable"
  y el filtro de responsable del Kanban muestran solo a esos dos.
- **20:** `sector` seteado como puesto visible (Pancho/Martín "Dirección", Gonzalo
  "Diseño / Producción", Gastón "Diseño", Richard/Alejandra "Coordinación").

Migraciones aplicadas en la base real: **001–015**.

Equipo con cuenta y usando la app: Gonzalo, Gastón, Pancho, Martín, Alejandra,
Richard (6). Falta **Nancy** (coordinadora, falta su email).

### Próximo tema (arranca 09/09): pantalla de Configuración

`src/components/Common/ConfigPage.tsx` (ruta `/configuracion`, solo admin). Hoy es
**solo lectura**: lista como chips los catálogos que viven como constantes en
`src/data/catalog.ts` — `JOB_TYPES`, `MATERIALS`, `BLOCK_REASON_LABELS`. El texto
de la pantalla dice "cuando se conecte el backend real" — **está desactualizado**:
el backend real (Supabase) ya está. Lo que falta es mover esos catálogos de
constantes en código a datos editables.

Contexto para no arrancar de cero mañana:

- **Ya existen las tablas** `job_types` (id, label, default_stages) y `materials`
  (id, label) en `001_schema.sql`, con policies de escritura solo-admin en
  `002_policies.sql`, y están sembradas por `003_seed_catalogs.sql`. **Pero la app
  no las lee** — lee las constantes de `catalog.ts`. O sea: la mitad del trabajo
  (esquema + RLS) ya está hecha para tipos de trabajo y materiales.
- **`BLOCK_REASON_LABELS`** no tiene tabla — habría que crearla (migración nueva) o
  dejarla como constante si Gonzalo no la quiere editable.
- Ojo con los `id` de catálogo: hoy son strings semánticos (`'impresion_v7000'`,
  `'acrilico'`) referenciados en `JobTypeId`/`MaterialId` (tipos TS) y guardados en
  `jobs.job_type_id` / `products[].materialIds`. Si se vuelven editables, los ids
  de registros existentes no se pueden romper — agregar sí, renombrar label sí,
  borrar/cambiar id es delicado.
- Decidir con Gonzalo el alcance: ¿solo agregar/renombrar? ¿activar/desactivar sin
  borrar? ¿también las etapas (`STAGE_LABELS`) y la plantilla de control de calidad
  (`QC_TEMPLATE`)? Esto último es "checklist configurable", hasta ahora marcado
  fuera de alcance de Fase 1 (§3) — puede que Gonzalo lo quiera reincorporar.

También quedó pendiente de rondas anteriores (tintero, §18/19): base de
conocimiento de materiales, estados que sobran (`NUEVO`/`APROBADO`), Manual de uso,
`credits_as_assigner` (columna muerta), fix `handle_new_user()`, subida real de
archivos a Storage, etapas del wizard, mobile, y el "texto automático para el
cliente" cuando un trabajo llega a Listo para entregar.

---

## 22. Actualización 08/09 — fix: bug de RLS de `notifications` bloqueaba crear fichas

**Síntoma:** al crear una ficha de trabajo saltaba `new row violates row-level
security policy for table "notifications"` y el alta fallaba entera.

**Por qué apareció ahora:** es el mismo problema de §12.8 (la policy de INSERT de
`notifications` en la base real quedó, en algún momento, más restrictiva que el
`with check (true)` que tiene `002_policies.sql`). Antes no se notaba al crear una
ficha porque la lista de destinatarios de la notificación "nueva ficha" solía
quedar vacía (`insertNotifications([])` corta antes del insert). La sección 18
amplió esa lista a responsable + asignados + **todos los admins** — desde entonces
siempre hay al menos una fila para insertar, y ahí la policy drift-eada la rechaza.

**Arreglo aplicado en código (commit `5f1426f`, ya deployado):**
`insertNotifications` (`store/useStore.ts`) ya **no hace `throw`** si el insert
falla — loguea `console.warn` y devuelve `[]`. Las notificaciones son un efecto
secundario best-effort: que fallen no tiene que tumbar la acción que las dispara
(crear ficha, cambiar estado, comentar, asignar, subir archivo, etc.). Con esto
crear fichas funciona aunque la policy siga mal — solo que no se genera el aviso.

**Arreglo de fondo (lo tiene que correr Gonzalo en Supabase → SQL Editor):**
reaplica las tres policies de `notifications` tal como están en `002_policies.sql`:

```sql
alter table notifications enable row level security;

drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications
  for update to authenticated using (user_id = auth.uid());

drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications
  for insert to authenticated with check (true);
```

Para ver cómo quedó la policy actual (diagnóstico, opcional):
```sql
select policyname, cmd, qual, with_check from pg_policies where tablename = 'notifications';
```

**Pendiente de confirmar:** que Gonzalo corrió el SQL de arriba. Hasta que lo
haga, la app anda pero nadie recibe el aviso de "cayó una ficha nueva" (§18.9) ni
ninguna otra notificación in-app. Verificar con el `select` de diagnóstico o
creando una ficha y mirando la campana de otro usuario.

---

## 23. Actualización 08/09 — cubo "Pendientes" en el Dashboard + marca de "muestra/prueba al cliente"

### 1. Cubo "Pendientes" (pedido 2 de la ronda)

Se había quedado sin tarjeta de KPI para el estado `PENDIENTE` (estaban todos los
demás). Vuelto a agregar: `computeCounts` (`lib/selectors.ts`) suma `pending`
(cuenta `status === 'PENDIENTE'`), y `DashboardPage.tsx` tiene la tarjeta
**"Pendientes"** (ícono `Inbox`, tono `wait`, entre "En diseño" y "Críticos") con
su `case 'pending'` en el filtro. Clic → filtra la lista a los pendientes, igual
que el resto de los cubos. No se tocó nada más del Dashboard.

### 2. Muestra / prueba al cliente (pedido 1 de la ronda)

**Problema que resuelve:** muchos clientes piden una muestra impresa (una parte del
trabajo, una imagen) para chequear color/definición/textura *antes* de mandar a
producir todo. Hasta ahora no había dónde marcar "este trabajo está esperando el
OK de la muestra". Gonzalo pidió algo **poco protagónico**.

**Cómo se modeló** (mirando cómo lo hacen Printavo/shopVOX — "proof approval" — y
el patrón de "label / waiting on customer" de Trello/Linear, no una columna de
Kanban ni un estado nuevo del flujo):

- **Campo a nivel trabajo** `Job.sampleReview: 'none' | 'awaiting' | 'approved'`
  (+ `sampleReviewAt` timestamp del último cambio). Columnas
  `jobs.sample_review` (text, check, default `'none'`) y `jobs.sample_review_at`
  (timestamptz) — **migración `016_job_sample_review.sql`, hay que correrla**.
  Sumadas también a `001_schema.sql`. `dbMappers.mapJob` + `seed.ts` actualizados.
- **`SAMPLE_REVIEW_META`** en `data/catalog.ts`: `option` (texto del selector) y
  `chip` (texto corto del pill; vacío en `none` = no se muestra nada).
- **Acción del store** `setSampleReview(jobId, state, byUserId)` — optimista, con
  rollback, `insertActivity` (`action: 'muestra'`) y notificación best-effort al
  responsable/asignados. **No** pasa por `jobs_update_guard` (no es campo
  estructural) → cualquier rol con acceso al trabajo lo puede marcar (quien
  produce suele ser el que se entera del OK).
- **`SampleReviewBadge`** nuevo en `Common/Badges.tsx`: pill chico, **no renderiza
  nada si `state === 'none'`**. Ámbar (`norm`) = "Muestra: falta OK";
  verde (`plan`) = "Muestra OK". `title` con la fecha si hay `at`.

**Dónde aparece (deliberadamente discreto — invisible en la mayoría de los
trabajos, que no tienen muestra en juego):**
- **Ficha** (`JobDetailPage`): un `<select>` "Muestra al cliente" en la fila de
  acciones de la cabecera (al lado de prioridad/estado), + el `SampleReviewBadge`
  en la tira de badges de arriba. Es el único lugar donde se *cambia*.
- **Dashboard** (`DashboardJobCard`): el badge en la fila de metadata, después del
  cliente. Se ve `awaiting` y `approved`.
- **Kanban** (`KanbanPage`, `CardBody`): un tag mínimo "muestra" en ámbar al lado
  del cliente, **solo cuando `awaiting`** (es el estado accionable: "no arranques
  la producción completa"). `approved` no muestra nada en el Kanban.
- **NO** se agregó a Carga rápida (la muestra suele surgir con el trabajo ya
  empezado, no al darlo de alta) ni a la hoja de exportación al cliente (es
  workflow interno). Si Gonzalo quiere en Carga rápida, se suma.

**Skills usadas** (pedido 3): `frontend-design` (referentes + criterio de
restraint), `design-critique` y `accessibility-review`. Ajuste post-crítica:
el tag del Kanban pasó de 9px mayúsculas bold a 10px normal para no "gritar"
siendo el elemento más chico. Contrastes verificados (norm 7.5:1, plan 6.4:1,
ambos AA para texto chico); todos los estados llevan texto además del color.

### SQL a correr en Supabase

```sql
alter table jobs add column if not exists sample_review text not null default 'none'
  check (sample_review in ('none', 'awaiting', 'approved'));
alter table jobs add column if not exists sample_review_at timestamptz;
```

Migraciones aplicadas en la base real ahora: **001–016** (015 y 016 pendientes de
confirmar que Gonzalo las corrió).

---

## 24. Actualización 08/09 — pestaña "Productos" → "Detalle", y su edición arranca como Carga rápida

Gonzalo, mirando la ficha: la pestaña **"Productos"** no comunica bien que ahí se
ve/carga de qué se trata el trabajo (cantidades, materiales, medidas), y al
editar con el trabajo vacío mostraba un cartel de "nada cargado" en vez de un
formulario listo para completar.

1. **Tab renombrado `'Productos'` → `'Detalle'`** (`JobDetailPage.tsx`, `TABS` y el
   `tab === 'Detalle'`). El editor de adentro **ya era** el mismo componente que
   Carga rápida (`ProductsEditor`) — no cambió eso.
2. **El modo edición arranca con un producto vacío** si el trabajo todavía no
   tiene ninguno (`ProductsTab.startEdit`: `job.products.length ? job.products :
   [emptyProduct()]`) — igual que Carga rápida, que siempre precarga uno. Antes
   había que apretar "+ Agregar producto" desde un estado vacío.
3. **Textos de la pestaña** para que se entienda qué es: línea de intro en modo
   vista ("De qué se trata el trabajo: cada producto con su material, cantidades y
   medidas.") y en modo edición ("Cargá cada producto... igual que en Carga
   rápida."). El botón dice **"Cargar detalle del trabajo"** si está vacío,
   **"Editar detalle del trabajo"** si ya hay algo (antes "Editar productos").
4. **Consistencia de wording:** el aviso "Faltan datos para producción" ahora dice
   "Detalle del trabajo (productos, materiales, medidas)" en vez de "Productos"
   (`lib/selectors.ts`, `missingFields`); el log de actividad dice "Actualizó el
   detalle del trabajo" (`useStore`, `updateJobSpecs`).

**No se tocó** la palabra "producto" para los ítems individuales adentro del
editor ("Agregar producto", "Producto 1", "N de M productos procesados") — un
trabajo genuinamente tiene varios productos/renglones (ver §14), y mantenerlo
igual que Carga rápida es justo el paralelo que pidió Gonzalo. Si quiere cambiar
también ese wording interno, avisar.

---

## 25. Actualización 13/09 — auditoría UX en vivo de "crear ficha" (Carga rápida → ficha), técnica de testeo local sin login

Gonzalo pidió recorrer el camino completo de crear un trabajo nuevo, "ponerlo en
jaque" y sacar mejoras. Esta sesión **no puede loguearse con una cuenta real**
(nunca se tipean contraseñas, ni las del propio Gonzalo — regla dura, ver reglas
de seguridad del sistema), así que para poder ver la UI de verdad renderizada
(no solo leer código) se usó una técnica nueva, documentada acá para reusar:

### Técnica: bypass de auth 100% local, revertido antes de terminar
Se editó `src/App.tsx` **temporalmente** (nunca commiteado) para que, con
`?devpreview=1` en la URL y `import.meta.env.DEV`, la app llene el store de
Zustand (`useStore.setState(...)`) con un usuario/clientes/trabajo **inventados**
(nombres tipo "Gonzalo Varela"/"Bensimon" a propósito ficticios, sin ninguna
credencial ni dato real de por medio) en vez de llamar a Supabase Auth. Con eso
se pudo navegar Carga rápida, la ficha, el Dashboard y el Kanban con datos reales
en pantalla (no solo texto extraído) usando `preview_start(name:"bonta-dev")` +
`computer{screenshot}`. **Al terminar se revirtió con `git checkout -- src/App.tsx`
y se confirmó `git status` limpio antes de seguir** — no quedó rastro en el repo
ni se tocó Supabase. Nota para la próxima vez que haga falta un vistazo visual
real sin pedirle login a Gonzalo: repetir este patrón (no usar `data/seed.ts`
como fuente — su export `JOBS` rompe al importarlo, ver nota en el propio
`App.tsx` de esa ronda / sección 7 de este archivo).

### Hallazgos del recorrido (Carga rápida → ficha → Dashboard → Kanban)

1. **Errores técnicos crudos llegan al usuario tal cual.** Se reprodujo dos
   veces forzando ids inválidos: el pie de Carga rápida mostró literalmente
   `invalid input syntax for type uuid: "..."` — el mismo patrón que ya causó el
   bug de notificaciones (sección 22): cualquier error de Supabase/RLS se
   muestra sin traducir (`err.message ?? 'No se pudo crear el trabajo.'`).
   Pendiente: mapear errores conocidos a mensajes en criollo.
2. **`confirm()`/`alert()`/`prompt()` nativos del navegador** rompen el
   lenguaje visual en 3 lugares: confirmar campos faltantes en Carga rápida,
   el recordatorio de control de calidad al pasar a Listo, y las notas de
   instalación completada. Además, en el testeo el `confirm()` bloqueó el
   submit sin dar ninguna señal visual clara de qué pasó. Reemplazar por un
   modal propio (ya existe el patrón en `BlockModal.tsx`).
3. **Truncamiento real en el Kanban**, no solo en pantallas chicas: probado a
   1440px de ancho, "Bensimon" ya se corta a "Bens…" porque la grilla de 7
   columnas fijas deja ~150px por columna sin importar el ancho de pantalla; el
   renglón asigna→responsable también se corta a 2-3 letras por nombre.
4. **La sugerencia de "plantilla de vinilo" (Corpóreo) agrega un producto sin
   medida propia** — como el gate de creación solo exige que ALGÚN producto
   tenga medida, es fácil terminar creando el trabajo con la plantilla sin sus
   propias medidas. Podría heredar automáticamente la medida del primer
   producto al aceptarla.
5. **"Cliente" es texto libre sin aviso de duplicado** — `findOrCreateClient`
   crea uno nuevo silencioso si el nombre no calza exacto (mayúsculas, tilde,
   espacio de más), sin sugerir "¿quisiste decir X?". Con el tiempo puede
   ensuciar la lista de clientes con casi-duplicados.
6. **Confirmado en vivo, no es bug:** el botón "Crear trabajo" queda
   deshabilitado hasta cargar al menos una medida (única condición dura,
   documentado en §12.2) — se comporta como se espera.

**No se pudo mirar trabajos reales de Gonzalo** (viven en Supabase con RLS —
entrar a su cuenta real está fuera de lo permitido). Si en algún momento quiere
un análisis calibrado con casos reales, la vía es que él pase ejemplos
(capturas o descripción de 2-3 pedidos típicos), no que la sesión inicie sesión
por él.

### Tintero completo (recordatorio ≤10 palabras pedido por Gonzalo el 13/09)

*"Materiales, estados sobrantes, Manual, Nancy, archivos reales, mobile,
Configuración editable."* — versión larga con todo el detalle: secciones 18
(tintero original), 19, 21, más los 5 hallazgos de arriba. Nada se descartó,
solo se resumió para la pregunta puntual.

---

## 26. Actualización 13/09 (cont.) — los 5 hallazgos de Carga rápida resueltos + Configuración: Tipos de trabajo y Materiales editables

Ronda que ataca de punta a punta lo que dejó la auditoría de la sección 25, más el
primer alcance real de "Configuración" (hasta ahora de solo lectura, ver §21).
**No hace falta correr ningún SQL nuevo en Supabase para esta ronda** — las tablas
`job_types`/`materials` y sus policies admin-only ya existían (001/002/003_seed_catalogs,
ver §21) sin usarse; esta ronda las conecta.

### 1. Los 5 hallazgos de §25, resueltos

1. **Errores técnicos crudos → mensajes en criollo.** Nuevo [`lib/errors.ts`](src/lib/errors.ts),
   función `friendlyError()`: reconoce los códigos/patrones de Postgres que ya
   causaron incidentes reales en este proyecto (`23505` duplicado, `42501`/RLS,
   `22P02` invalid input syntax — el bug exacto que se reprodujo en la auditoría,
   `column ... does not exist` → probablemente falta una migración) y los traduce;
   si el error ya es un `Error` en criollo armado por la propia app (ej. "Falta el
   nombre del cliente."), lo deja pasar tal cual. Aplicado en: `QuickJobPage` (crear
   trabajo), `JobsTable` (eliminar trabajo), `EditableCode` en `JobsTable`/
   `DashboardJobCard` (antes el error al guardar un N° de Copernico duplicado
   fallaba en silencio total, sin ningún aviso — ahora se atrapa y se muestra),
   `ConfigPage` (agregar/renombrar catálogo), y `get_loadAll` en el store (la carga
   inicial de datos). Verificado en vivo contra un rechazo real de RLS (ver
   técnica de testeo en la sección 3 de más abajo): mostró "No tenés permiso para
   hacer esto, o falta una configuración de acceso en la base — avisale a Gonzalo."
   en vez del `new row violates row-level security policy...` crudo.
2. **`confirm()`/`prompt()` nativos → modal propio.** Nuevo
   [`components/Common/Modal.tsx`](src/components/Common/Modal.tsx) con
   `ConfirmDialog` y `PromptDialog` (mismo lenguaje visual que `BlockModal.tsx`).
   Reemplazados los 3 casos que señaló la auditoría: el `confirm()` de campos
   faltantes en `QuickJobPage` (ahora separa `handleSubmitClick` de `submit()` y
   muestra `ConfirmDialog` antes de crear si hay `softWarnings`), el `alert()` del
   recordatorio de control de calidad al pasar a Listo (`lib/statusChange.ts` —
   ver punto de arquitectura abajo), y el `prompt()` de notas de instalación
   completada (`InstallationTab` en `JobDetailPage.tsx`, ahora con su propio
   `showComplete` + `PromptDialog`). El `confirm()` de "¿Eliminar trabajo?" y el de
   "¿Eliminar archivo?" quedaron sin tocar a propósito — no estaban entre los 3
   que señaló la auditoría, se puede sumar en otra ronda si Gonzalo lo pide.
   - **Nota de arquitectura:** `lib/statusChange.ts` ahora importa `useStore` para
     poder empujar el recordatorio al toast global (`useStore.setState({ toast })`)
     en vez de un callback — es la única excepción a "`lib/` no toca el store"
     documentada en el propio archivo; no genera ciclo de imports porque
     `useStore.ts` no importa `statusChange.ts`. Beneficio: como los 4 lugares que
     llaman a `tryChangeJobStatus` (Kanban, JobsTable, DashboardJobCard, ficha) usan
     la misma función, el fix aplica a los 4 con un solo cambio.
3. **Truncamiento real del Kanban a 1440px.** `KanbanPage.tsx`: el nombre de
   cliente en `CardBody` pasó de `truncate` a `line-clamp-2 break-words` (envuelve
   en 2 líneas en vez de cortar texto), y el mínimo de ancho de la grilla subió de
   `min-w-[1120px]` a `min-w-[1400px]` (~200px por columna en vez de ~155px) —
   antes el mínimo viejo coincidía casi exacto con el ancho real disponible en un
   monitor normal, así que nunca llegaba a scrollear y las columnas quedaban
   apretadas siempre. Ahora scrollea antes pero cada columna respira. Verificado
   visualmente a 1440px: "Constructora del Plata SA" ahora envuelve en 2 líneas
   completas en vez de cortarse a "Constructora d…".
4. **Plantilla de vinilo de corte hereda la medida.** `ProductsEditor.tsx`, el
   botón "+ Agregar" de la sugerencia de Corpóreo ahora busca el primer producto
   que ya tenga alguna medida cargada y clona su `sizeItems` en el producto nuevo
   (antes nacía con una medida vacía, y como el gate de creación solo exige que
   ALGÚN producto tenga medida, era fácil terminar creando el trabajo con la
   plantilla sin la suya). Verificado en vivo: CANT=5/ANCHO=40x60 cargados en el
   producto 1 aparecieron ya completos en "Plantilla de vinilo de corte" al
   aceptar la sugerencia.
5. **Aviso de cliente casi-duplicado.** `QuickJobPage.tsx`: si lo tipeado en
   "Cliente" matchea a un cliente existente salvo mayúsculas/tildes/espacios
   (`normalizeClientName()`, sin librería de fuzzy-matching — alcanza para el caso
   que señaló la auditoría), aparece un banner discreto "¿Quisiste decir X? Ya
   existe un cliente con ese nombre." con un botón para usar el nombre existente
   tal cual. No bloquea, solo avisa. Verificado en vivo tipeando "bensimón" con
   "Bensimon" ya cargado.

### 2. Configuración: Tipos de trabajo y Materiales editables (alcance acotado)

Gonzalo eligió explícitamente el alcance más chico entre tres opciones: **solo
agregar/renombrar** Tipos de trabajo y Materiales, sin activar/desactivar ni tocar
Etapas/Control de calidad (eso sigue "checklist configurable", fuera de alcance).

1. **`JobTypeId`/`MaterialId` pasan de union cerrado a `string`** (`types/index.ts`)
   — un admin puede agregar tipos/materiales nuevos en cualquier momento, así que
   ya no hay una lista fija conocida en tiempo de compilación. No había ningún
   switch/`Record<JobTypeId,...>` exhaustivo en el código que dependiera del union
   cerrado, así que el cambio es de bajo riesgo (verificado con build limpio).
2. **`JOB_TYPES`/`MATERIALS` de `data/catalog.ts` renombrados a
   `DEFAULT_JOB_TYPES`/`DEFAULT_MATERIALS`** — ahora son solo el valor semilla
   (estado inicial del store antes de que responda el fetch a Supabase, y fuente
   de `seed.ts`/instalación nueva). La fuente real en producción es el store:
   `useStore((s) => s.jobTypes)` / `s.materials`, poblado en `get_loadAll()` desde
   las tablas `job_types`/`materials` (ya existían con RLS admin-only, ver §21 —
   **no hizo falta ninguna migración nueva**). Si el fetch de catálogos falla, no
   tumba la carga de datos: se loguea un `console.warn` y se sigue con el valor
   semilla en memoria (mismo criterio best-effort que `insertNotifications`, §22).
3. **`LEGACY_JOB_TYPE_IDS`** (`data/catalog.ts`) — los 14 ids del catálogo
   original de 17 verticales (`impresion_uv`, `senaletica`, `stands`, etc., ver
   `011_job_types_synthesized.sql`) siguen en la tabla real por trabajos de prueba
   que los referencian, pero **nunca se ofrecen** en ningún selector — antes esto
   pasaba solo porque `catalog.ts` los omitía a mano; ahora que el catálogo viene
   de la base (con esas 14 filas también), hace falta este filtro explícito para
   no resucitarlos. `visibleJobTypes(all)` aplica el filtro; un tipo agregado desde
   Configuración nunca cae en esta lista, así que aparece solo. Los materiales no
   tienen este problema (no hay materiales "legacy" en la tabla).
4. **Store**: `jobTypes`/`materials` en el estado, y 4 acciones nuevas —
   `addJobType`, `renameJobType`, `addMaterial`, `renameMaterial` (`store/useStore.ts`).
   El `id` de un ítem nuevo se genera con un slug del label (`slugifyId()`, sin
   tildes/espacios, con sufijo numérico si choca) — la tabla no tiene autonumérico,
   `id` es `text primary key`. Un tipo de trabajo nuevo nace con etapas por defecto
   genéricas (`['diseno', 'control_calidad']`) porque este alcance no incluye
   elegir etapas al crearlo. **No hay acción de borrar** — `jobs.job_type_id`
   referencia `job_types(id)` con FK, así que borrar un tipo en uso rompería
   trabajos existentes; coherente con la decisión de Gonzalo de no incluir esto.
5. **`ConfigPage.tsx`** reescrita: cada catálogo es una lista de chips con
   click-to-rename (mismo patrón que `EditableCode` de `JobsTable`/
   `DashboardJobCard` — lápiz al lado del label, un click abre un input inline) +
   un chip "+ Agregar" al final. Gateado por `canManageCatalog(role)` (nueva en
   `lib/permissions.ts`, espejo de las policies `job_types_write`/`materials_write`:
   solo admin) — sin ese permiso se ve de solo lectura, igual que antes. "Motivos
   de bloqueo" sigue de solo lectura (no estaba en el alcance elegido).
6. Los 4 consumidores que importaban `JOB_TYPES`/`MATERIALS` directo de
   `data/catalog.ts` (`QuickJobPage`, `ProductsEditor`, `JobDetailPage`,
   `JobExportPage`) pasan a leerlos del store; `seed.ts` (código muerto, §2) se
   actualizó para seguir compilando contra `DEFAULT_JOB_TYPES`.

### 3. Nota de proceso: técnica de testeo visual reusada de la sección 25

Se repitió el bypass de auth 100% local (`?devpreview=1` + `useStore.setState` con
datos inventados, nunca contraseñas reales) para poder ver los 5 fixes y
Configuración renderizados de verdad en el navegador — Kanban a 1440px con nombres
largos, el `ConfirmDialog`/`PromptDialog` en pantalla, la sugerencia de cliente, la
herencia de medida en la plantilla, y el error de RLS real traducido a criollo. El
cambio en `App.tsx` se revirtió con `git checkout -- src/App.tsx` antes de cerrar la
ronda (confirmado con `git status` limpio en ese archivo) — no quedó rastro en el
repo. Mismo patrón documentado en §25, para la próxima vez que haga falta.

### 4. Tintero — sin cambios más allá de lo resuelto arriba

Los 5 hallazgos de §25 y el ítem "Configuración editable" del tintero de §21/25
quedan resueltos por esta ronda. Todo lo demás del tintero sigue en pie tal cual
las secciones 18/19/21 lo dejaron: base de conocimiento de materiales, estados que
sobran (`NUEVO`/`APROBADO`), Manual de uso, cuenta de Nancy, fix de
`handle_new_user()`, subida real de archivos a Storage, confirmar la Etapa 3 del
wizard, mobile, `credits_as_assigner` (columna muerta), y el texto automático para
el cliente al llegar a "Listo para entregar". Dentro de Configuración específicamente,
sigue pendiente si en algún momento Gonzalo quiere sumar activar/desactivar sin
borrar, o extender lo editable a Etapas/Control de calidad — se dejó afuera a
propósito esta vez, no es un olvido.

---

## 27. Actualización 13/09 (cont.) — SQL de 015/016 pendiente, mensaje automático al cliente, primer paso de mobile

### 1. Migraciones 015/016 — Gonzalo confirmó que nunca las corrió

Pese a que §21 decía "confirmado", Gonzalo aclaró en esta ronda que ese SQL nunca
le llegó para correrlo de verdad — **tratar como NO aplicado hasta que lo
confirme**. Si en algún momento aparece un error de "column does not exist" al
tocar `assigned_names`/`sample_review` en un trabajo, es por esto. SQL a correr
en Supabase (SQL Editor → New query → pegar → Run), en este orden:

```sql
-- 015: "Asignar también a" (gente del taller sin cuenta)
alter table jobs add column if not exists assigned_names text[] not null default '{}';

-- 016: muestra/prueba al cliente
alter table jobs add column if not exists sample_review text not null default 'none'
  check (sample_review in ('none', 'awaiting', 'approved'));
alter table jobs add column if not exists sample_review_at timestamptz;
```

Verificación después de correrlo:
```sql
select column_name from information_schema.columns
where table_name = 'jobs' and column_name in ('assigned_names', 'sample_review', 'sample_review_at');
```
Debería devolver las 3 columnas. **Mientras no se corra**, crear un trabajo con
"Asignar también a" o tocar "Muestra al cliente" va a tirar un error de columna
inexistente — desde esta ronda ese error ya se traduce en criollo (`lib/errors.ts`,
§26) en vez de mostrarse crudo, pero la causa de fondo sigue siendo esta.

### 2. Texto automático para el cliente al llegar a "Listo para entregar" (tintero de §19, hecho)

1. **`lib/clientMessage.ts`** (nuevo) — `buildClientReadyMessage(job, client)` arma
   un texto en criollo ("¡Hola {contacto}! Te escribimos de Estudio Bonta para
   avisarte que tu pedido "{nombre}" (N° {code}) ya está listo — nos comunicamos
   para {coordinar el retiro | coordinar la instalación, según
   `requiresInstallation`}. ¡Gracias por tu confianza!"), y `whatsappLink(phone,
   text)` arma un link `wa.me/<dígitos>?text=...` si hay teléfono de contacto
   cargado.
2. **`ClientMessageModal.tsx`** (nuevo, `components/JobDetail/`) — mismo lenguaje
   visual que `BlockModal`/`Modal.tsx`: el texto sale en un `<textarea>` editable
   (nunca se manda solo), con botón "Copiar mensaje" (`navigator.clipboard`, con
   confirmación visual "Copiado") y, si hay teléfono, "Abrir en WhatsApp" (abre
   `wa.me` en pestaña nueva — el envío final lo hace la persona a mano dentro de
   WhatsApp, esto solo prellena el texto). Si no hay teléfono cargado, avisa dónde
   cargarlo en vez de ocultar el botón sin explicar por qué.
3. **Botón "Mensaje para el cliente"** en la cabecera de la ficha
   (`JobDetailPage.tsx`), visible solo cuando `job.status` es
   `LISTO_PARA_ENTREGA` o `LISTO_PARA_INSTALACION` (`CLIENT_MSG_STATUSES`).
4. **Recordatorio en el toast global** al pasar a cualquiera de esos dos estados
   (`lib/statusChange.ts`, `tryChangeJobStatus` — mismo mecanismo que ya usaba el
   recordatorio de control de calidad, ver §26): "No te olvides de avisarle al
   cliente — desde la ficha podés generar el mensaje...". Si además quedan ítems
   de control de calidad sin marcar, los dos avisos se combinan en un solo toast
   en vez de pisarse (el toast global es un único string a la vez). Dispara desde
   los 4 lugares que cambian el estado (Kanban, JobsTable, DashboardJobCard,
   ficha) porque todos pasan por `tryChangeJobStatus`.
5. **No se tocó** Carga rápida ni la hoja de exportación al cliente — el mensaje
   es de cuando el trabajo YA está listo, no al cargarlo (mismo criterio que
   "muestra al cliente", §23).

### 3. Mobile — primer paso: 2 bugs de overflow reales corregidos, resto ya andaba mejor de lo esperado

Antes de tocar nada se relevó el estado real en 375px de ancho (Dashboard, Kanban,
Carga rápida, ficha) con la técnica de bypass de auth local (§25/§26) — **la base
ya venía razonablemente responsive** (el shell con `Sidebar`/`Header` ya tiene
menú hamburguesa, las tarjetas/badges ya usan `flex-wrap`) pese a que el tintero
decía "no se tocó nada de responsive". Se encontraron y corrigieron 2 overflows
horizontales reales (contenido cortado + scroll horizontal indebido, no solo
"apretado"):

1. **`DashboardJobCard.tsx`** — el grupo "Asignado X · Entrega Y + countdown" tenía
   `whitespace-nowrap` sin `flex-wrap` propio dentro de una fila que sí wrappeaba:
   en 375px ese grupo no entraba en su renglón y se salía del borde de la tarjeta
   en vez de bajar de línea. Se le sacó `whitespace-nowrap` al contenedor (queda
   solo en los `<span>` individuales) y se agregó `flex-wrap` — ahora el chip de
   countdown baja a su propia línea en vez de cortarse.
2. **`ProductsEditor.tsx`** — la cabecera de cada producto (input de nombre +
   toggle "Tercerizada" + botón de borrar) no tenía `flex-wrap`, y el input no
   tenía `min-width` explícito — en 375px se salía del contorno de la tarjeta.
   Se agregó `flex-wrap` a la fila y `min-w-[140px]` al input: ahora el toggle/
   botón de borrar bajan a una segunda línea cuando no entran, en vez de
   desbordar. Mismo componente se usa en Carga rápida y en la pestaña Detalle de
   la ficha, así que el fix vale para las dos.
3. **Kanban**: el scroll horizontal de 7 columnas ya funciona razonablemente en
   mobile (patrón esperable tipo Trello, swipe entre columnas) — no se tocó.
4. **Ficha (`JobDetailPage`)**: badges, selects y tabs ya wrappean/scrollean bien
   en 375px — no se tocó.
5. **No revisado todavía** (queda para la próxima pasada de mobile): `JobsTable`/
   `ClientsPage` (tabla ancha — probablemente necesite scroll horizontal
   deliberado, no está mal per se pero no se confirmó), `UsersPage`/`ConfigPage`,
   el dropdown de notificaciones y el buscador del `Header`, el grid CANT/ANCHO/
   ALTO de `SizeItemsEditor` (funciona pero el placeholder "cm o «a medida»" se
   corta visualmente en columnas muy angostas — cosmético, no bloquea cargar
   datos), la apertura/cierre del menú hamburguesa en sí, y `CommentsPanel` en la
   pestaña "Comentarios" de la ficha en mobile. Ninguno de estos se relevó a
   fondo todavía — es la lista para continuar la próxima vez que se retome mobile.

### 4. Tintero — actualizado

Resuelto por esta ronda: texto automático para el cliente (ítem de §19). En curso,
no cerrado: mobile (ver punto 3 de arriba, sigue en la lista general). El resto
sin cambios: base de conocimiento de materiales, estados que sobran
(`NUEVO`/`APROBADO`), Manual de uso, cuenta de Nancy, fix de `handle_new_user()`,
subida real de archivos a Storage, confirmar la Etapa 3 del wizard,
`credits_as_assigner` (columna muerta), y **confirmar que Gonzalo corrió el SQL
del punto 1 de esta sección** (015/016) — no asumir que ya está aplicado la
próxima vez, verificar con el `select` de arriba.

---

## 28. Actualización 15/09 — se agrega al tintero: facturación electrónica AFIP (proyecto grande, aparte)

Gonzalo pidió sumar "poder facturar los trabajos". Se conversó el alcance antes
de tocar nada (nunca se llegó a escribir código esta ronda) — resultado: **es un
proyecto propio, no una funcionalidad más de esta app**, y arranca en una
conversación nueva y dedicada cuando Gonzalo junte los datos que faltan (mismo
criterio que se usó para la base de materiales, §16 punto 4).

**Decidido en la conversación:**
- Gonzalo quiere una **factura real con validez fiscal** (CAE de AFIP), no un
  comprobante interno ni un PDF de referencia — Copernico no la emite hoy, la
  idea es que la emita esta app.
- El estudio **ya tiene el certificado digital de AFIP** dado de alta para
  facturación electrónica (WSFE) — el bloqueo más grande (trámite en AFIP) ya
  no existe.
- Condición frente al IVA: **Responsable Inscripto** → va a necesitar poder
  emitir **Factura A** (a otros responsables inscriptos) y **Factura B** (a
  consumidor final / monotributistas), según la condición fiscal de cada
  cliente.

**Restricción de seguridad no negociable, ya acordada con Gonzalo:** el
certificado y la clave privada de AFIP **nunca** pueden ir al repo de GitHub
(es público) ni a una variable de entorno con prefijo `VITE_` (esas quedan
embebidas en el bundle que baja al navegador de cualquiera). Van a vivir en un
secreto server-side (candidato: Supabase Edge Function secrets) — la app hoy no
tiene ningún componente server-side propio, así que esto es sumar una pieza de
arquitectura nueva, no reusar algo existente. Cuando se llegue a esa parte,
Gonzalo tiene que cargar el certificado él mismo directo en el dashboard de
Supabase/Vercel — **nunca pegarlo en el chat**.

**Datos que todavía faltan (Gonzalo los tiene que conseguir antes de arrancar
la conversación nueva):**
1. CUIT del estudio.
2. Punto de venta habilitado específicamente para webservice de facturación
   electrónica (no un talonario manual/preimpreso).
3. Confirmar dónde está guardado hoy el certificado/clave (para saber cómo
   migrarlo al lugar seguro sin que pase por el chat ni por git).

**Implicancias de diseño para cuando se arranque (anotado para no perderlo):**
- El modelo `Client` de esta app hoy es liviano (solo autocompletado, ver
  CLAUDE.md sección 4 punto 3 — los clientes "de verdad" viven en Copernico).
  Para elegir automáticamente Factura A vs. B hace falta CUIT + condición
  frente al IVA por cliente, que hoy no existen en `Client` — hay que decidir
  si se agregan campos nuevos acá o se resuelve de otra forma al momento de
  facturar.
- Conviene probar primero en el ambiente de **Homologación** de AFIP (necesita
  su propio certificado de prueba, distinto al de producción) antes de emitir
  algo real.
- AFIP devuelve el número de comprobante y el CAE al emitir (WSFE maneja la
  numeración), así que no hace falta que esta app lleve un contador propio.

No se tocó código en esta ronda para este ítem — es puramente de alcance/
planificación, a la espera de que Gonzalo junte los 3 datos de arriba.

---

## 29. Actualización 15/09 (cont.) — auditoría UX/UI + accesibilidad + código, y primeros 4 fixes críticos/altos

Ronda dedicada a auditar la app (no a pedidos de feature nuevos) y arrancar a
resolver lo más grave de lo que salió. Todo documentado en detalle en un archivo
nuevo, **[`AUDITORIA_UXUI_2026-09-15.md`](AUDITORIA_UXUI_2026-09-15.md)** en la
raíz del proyecto — este resumen es solo el punteo, el detalle completo (por qué
importa cada cosa para el uso real del estudio, fix concreto, línea exacta) vive
ahí.

### 1. Se corrieron 3 auditorías, consolidadas en un solo informe

- **`design-critique`** sobre 7 capturas reales tomadas con Playwright (Dashboard,
  Tabla de trabajos, Kanban, ficha con comentarios, Carga rápida, y Dashboard/Tabla
  en mobile 375px) — con foco puntual en si el Kanban entra sin scroll en
  resoluciones de notebook reales (no solo si la captura ajustada se ve bien).
- **`accessibility-review`** sobre las mismas 7 capturas + una 8va tomada aparte
  (Carga rápida en mobile, con scroll real hasta el final, para confirmar que la
  barra fija no tapa el último campo).
- **Revisión de código** (agente de exploración) sobre `src/components` y
  `src/store/useStore.ts` buscando específicamente: estados de carga/error
  faltantes, spacing/tipografía hardcodeados fuera de los tokens de Tailwind, y
  componentes duplicados.
- Los tres informes se consolidaron en un único Markdown, **reordenado por
  severidad real de uso** (no por el orden en que salió cada hallazgo) — un fallo
  silencioso en una acción que cambia datos (estado, prioridad, usuarios) se
  clasificó por encima de una inconsistencia visual, aunque los informes de origen
  los hubieran marcado igual.
- Técnica de testeo reusada de §25/§26/§27 (bypass de auth 100% local vía
  `?devpreview=1`, revertido con `git checkout` antes de cada commit — nunca quedó
  rastro en el repo).

### 2. Resuelto en esta ronda (4 ítems, cada uno en su propio commit)

1. **Crítico — manejo de error en 16 ubicaciones de cambio de estado/prioridad/
   usuario** (`98b2a6e`). `tryChangeJobStatus` (`lib/statusChange.ts`) ahora atrapa
   con `.catch(err => alert(friendlyError(err)))` — arregla de una sola vez los 4
   lugares que lo llaman (Kanban, Tabla, Dashboard, ficha). `setPriority`,
   `setSampleReview`, `updateCommittedDate` (ficha/Dashboard) y `setUserActive`
   (Usuarios) se envolvieron uno por uno en try/catch. Extensión necesaria fuera de
   las 16 ubicaciones originales: `setUserActive` en `useStore.ts` no revisaba el
   `error` de Supabase y aplicaba el cambio local igual aunque fallara — sin ese
   fix de 2 líneas, el try/catch del componente nunca se hubiera disparado (riesgo
   real de control de acceso: desactivar a alguien podía "verse" aplicado sin
   estarlo).
   - **Deuda documentada #1:** el `alert()` nativo es un patrón temporal — sigue
     pendiente reemplazarlo por algo consistente con el resto de la UI (mismo
     tema que el `confirm()` nativo ya señalado como corte de alcance, ver tintero).
   - **Deuda documentada #2:** se confirmó que `setSampleReview` y
     `updateCommittedDate` ya tenían rollback optimista idéntico al de `setStatus`
     (no hacía falta tocarlas para eso). `setPriority` es distinto: no es
     optimista (no toca el store hasta que Supabase confirma éxito), así que no
     hay nada que revertir, pero tampoco hay feedback visual inmediato ni
     protección contra doble-click mientras la llamada está en curso — queda
     anotado como deuda conocida, no arreglado en esta ronda.
2. **Alto — `SizeItemsEditor` sin nombre accesible** (`30807bd`). Los 3 inputs de
   Cantidad/Ancho/Alto (`Common/SizeItemsEditor.tsx:33-35`) no tenían
   `aria-label`, y Ancho/Alto compartían el mismo placeholder literal —
   indistinguibles para un lector de pantalla. Se agregaron
   `aria-label="Cantidad"/"Ancho"/"Alto"`, sin tocar el layout visual. Cubre las 2
   pantallas que usan el componente (Carga rápida y la pestaña Detalle de la
   ficha, ambas vía `ProductsEditor.tsx`).
3. **Alto — Kanban no entraba en notebooks comunes** (`27ed425`). `min-w-[1400px]`
   bajó a `min-w-[1150px]` (`Kanban/KanbanPage.tsx`) — recupera las 7 columnas sin
   scroll en 1440-1536px (antes solo entraban ~5-6) y mejora 1366px, sin
   reintroducir el truncamiento de texto (el fix de `line-clamp-2` en `CardBody`
   es independiente del ancho de la grilla). Se evaluó agregar en cambio una señal
   visual de scroll (sombra/degradé) en vez de tocar el ancho — se descartó porque
   no resuelve el problema real (columnas que no entran *sin* scrollear, no falta
   de aviso de que hay que scrollear — eso es un problema distinto, sigue abierto).
4. **Alto — carga inicial silenciosa** (`004182b`). `loadError`/`dataLoading`
   existían en el store pero ningún componente los leía. Se agregó `refreshAll()`
   al store (solo expone la función privada `get_loadAll` ya existente, para poder
   reintentar desde la UI) y un banner nuevo en `AppLayout.tsx`
   (`DataLoadBanner`, entre el Header y el contenido): si hay error, mensaje +
   botón "Reintentar"; si está cargando sin error, una franja liviana
   "Actualizando datos...". Antes de aplicar se confirmó que `jobs`/`users`/
   `clients` NO se resetean a `[]` en el catch de `get_loadAll` — quedan en lo que
   tenían antes, que en el boot inicial o justo después de loguearse **es** `[]`
   — por eso el copy del banner es explícito ("lo que ves en esta pantalla puede
   estar vacío o desactualizado, no que no haya nada cargado hoy") para que no se
   confunda con "sin trabajos activos".

### 3. Pendiente, documentado en el informe (no resuelto esta ronda)

- **Alto → bajado de prioridad:** falta de alternativa de teclado para mover
  tarjetas en el Kanban (`useSensors` solo tiene `PointerSensor`, sin
  `KeyboardSensor`). Se confirmó con Gonzalo que nadie del equipo opera la app sin
  mouse hoy — sigue siendo una barrera de accesibilidad real (WCAG 2.1.1), pero se
  baja de prioridad de implementación hasta que haga falta de verdad.
- **Medio:** inconsistencia de color de estado entre el Kanban (7 tonos en
  `KANBAN_COLUMNS`) y el resto de las pantallas (5 tonos en `StatusTone` de
  `Badges.tsx` — `EN_DISENO`/`EN_PRODUCCION`/`EN_CONTROL_CALIDAD`/
  `EN_INSTALACION` se ven todos del mismo azul fuera del Kanban).
- **Medio:** falta de affordance de scroll horizontal en Kanban y Tabla de
  trabajos en mobile (ningún degradé/sombra que avise que hay más columnas/
  columnas a la derecha).
- **Medio:** `aria-label` faltante/inconsistente (`StatusSelect` vs
  `PrioritySelect` en el mismo archivo, filtros de `JobsPage`, buscador del
  Header).
- **Bajo:** hardcodes de spacing/tipografía sueltos (`text-[11px]`/`[10px]`/
  `[13px]` repetidos sin token, `font-brand` en `JobExportPage.tsx` fuera de su
  alcance documentado, colores/sombras hardcodeados como `'#999'` y
  `shadow-[...]`).
- **Bajo:** componentes duplicados — `EditableCode` (Tabla/Dashboard, ya con una
  diferencia real entre copias), 3 versiones separadas de un wrapper `Section`,
  el Kanban con su propio pill de "muestra" en vez de `SampleReviewBadge`, y
  `confirm()` nativo todavía en 2 lugares (borrar trabajo, borrar archivo) en vez
  del `ConfirmDialog` ya construido — este último ya venía señalado como corte de
  alcance deliberado de una ronda anterior.

Ver `AUDITORIA_UXUI_2026-09-15.md` para el detalle completo de cada ítem pendiente
(archivo + línea exacta + por qué importa + fix concreto propuesto) cuando se
retome.

### 4. Estado de git (al cierre de la ronda de los 4 primeros fixes)

Todos los commits de esa ronda quedaron pusheados a `origin/main`, hasta
**`004182b`** inclusive (`f881f94` → `98b2a6e` → `464fff3` → `30807bd` →
`27ed425` → `004182b`).

### 5. Actualización (sesión siguiente) — 🟠 Alto #3 resuelto: manejo de error en el resto de la ficha

Se cerró el ítem 🟠 Alto #3 del informe (`AUDITORIA_UXUI_2026-09-15.md`) que había
quedado pendiente al final de la sección anterior: las 7 acciones restantes de
`JobDetailPage.tsx` sin manejo de error (bloquear/desbloquear, control de calidad,
tildar producto, subir/aprobar/eliminar archivo, instalación completada).

**Hallazgo antes de aplicar el fix:** al revisar las funciones del store detrás de
esas 7 acciones, **6 de las 7 no chequeaban el `error` de Supabase en su escritura
principal** (`blockJob`, `unblockJob`, `toggleQualityCheck`, `addFileVersion`,
`approveFileVersion`, `completeInstallation`) — no era solo falta de `try/catch`
en el componente, la propia función del store nunca se enteraba del fallo
(`supabase-js` no lanza excepción sola; si no se lee `error` explícitamente, el
fallo queda invisible). Solo `toggleProductChecked` ya estaba bien. Envolver el
call site en `try/catch` sin tocar el store no hubiera alcanzado: el `alert()`
casi nunca se hubiera disparado, porque `insertActivity()` (que sí lanza) suele
tener éxito igual aunque la escritura anterior haya fallado.

**Fix aplicado (commit `513cb44`), dos capas:**
1. **Store** (`useStore.ts`) — se agregó `if (error) throw error` a cada
   escritura que lo omitía en las 6 funciones de arriba. Los `jobs.update({
   last_activity_at })` que son solo un "touch" de timestamp (no el cambio de
   estado real) se dejaron sin chequear a propósito, mismo criterio que ya usa el
   resto del store (`assignJob`, `setStageStatus`, `addComment`).
2. **Componente** (`JobDetailPage.tsx`) — mismo patrón que el Crítico ya resuelto:
   `try { await accion(...) } catch (err) { alert(friendlyError(err)) }` en los 8
   call sites, más el `catch` que faltaba en `ProductsTab.save()` (tenía
   `try/finally` sin `catch`).

**Deuda documentada, igual que ya se había anotado para `setPriority` (§29.2):**
ninguna de estas 7 tiene rollback optimista como `setStatus`/`toggleProductChecked`
— no tocan el store hasta que `refreshJob()` trae el valor real al final, así que
un fallo a mitad de camino (ej. `block_records` insertado pero `jobs.status` sin
actualizar) no se revierte visualmente porque nunca se había aplicado nada
visualmente para revertir — solo avisa con el `alert()`. Sigue pendiente
reemplazar el `alert()` nativo por un patrón consistente con el resto de la UI
(mismo tema que los `confirm()` nativos ya señalados como corte de alcance).

Verificado con `npm run build` (tsc + vite) y `npm run lint` limpios antes de
commitear. **Pusheado a `origin/main`: `004182b..513cb44`.** Nada pendiente de
subir de este ítem.

Quedan del informe: 🟡 Medio #8 (color inconsistente Kanban vs. resto), #9
(affordance de scroll mobile), #10 (`aria-label` sueltos), #11 (`EditableCode`
duplicado), y todo lo 🟢 Bajo. 🟠 Alto #6 (teclado en Kanban) sigue bajado de
prioridad, sin cambios.

Este mismo registro (este punto 5) se actualizó en un commit aparte, `c1a308f`,
también pusheado a `origin/main`.

---

## 30. Actualización 15/09 (cont.) — consolidar campos de texto libre, "minuta técnica" en la ficha, Kanban compacto

Ronda de feedback de uso real (no de la auditoría) — Gonzalo probó la app y volvió
con 6 pedidos concretos. **Nota importante:** el resto de los ítems de
`AUDITORIA_UXUI_2026-09-15.md` (🟡 Medio #8/#9/#10/#11 y los 🟢 Bajo) ya estaban
resueltos al momento de esta ronda, pese a que el punto 5 de arriba (§29) todavía
los liste como pendientes — ese punto quedó congelado en el momento en que se
escribió; ver los commits `588990a` → `a2b622a` → `01390b8` → `3a657b7` para el
detalle de esas rondas intermedias, todas ya pusheadas antes de esta.

### 1-2. Campos de texto libre repetidos + "se pierden" en la ficha — resueltos

**Diagnóstico:** existían 4 campos de texto libre superpuestos y mal repartidos:
`Job.description` ("qué hay que producir"), `Job.observations` (en Carga rápida,
debajo de Productos — literalmente lo mismo que `description` sin ninguna
distinción de uso real), `Job.specialRequirements` ("Requisitos especiales" —
**nunca tuvo campo en Carga rápida**, solo se podía cargar después desde la
ficha) y `Product.notes` (por producto, con su propia razón de ser documentada en
`types/index.ts`). El dato **no se perdía realmente** — `description`/
`observations` se mostraban en la pestaña General y `products[].notes`/
`specialRequirements` en la pestaña Detalle — pero estaba repartido entre 2 tabs
sin ningún resumen visible al entrar a la ficha (que abre en General por
default), y `observations` no aportaba nada que `description` no dijera ya.

**Fix 1 — se sacó `observations` como campo separado** (Gonzalo lo propuso como
la opción simple, y se tomó esa por sobre fusionar todo en un campo único): marcado
`@deprecated` en `types/index.ts` (mismo criterio que `technique`/`finish`/
`color`/etc. — no se dropea la columna de Supabase, por si hay datos viejos,
simplemente ya no se lee ni se escribe desde ningún formulario). Se sacó el
textarea "Observaciones" de Carga rápida (`QuickJobPage.tsx`), el `Field`
correspondiente en la pestaña General de la ficha (`JobDetailPage.tsx`), la
sección "Observaciones" de la hoja de exportación al cliente
(`JobExportPage.tsx`), y el campo del payload de `createJob`
(`NewJobInput`/`useStore.ts`). `specialRequirements` **no se tocó** — sigue
siendo un campo distinto (a diferencia de `observations`, si Gonzalo confirma que
también es redundante con `description`, es un cambio aparte a pedir
explícitamente, no algo que se haya decidido acá).

**Fix 2 — "minuta técnica" en la pestaña General** (soluciona la sensación de
"se pierde"): debajo de "Descripción", si el trabajo tiene productos o requisitos
especiales cargados, aparece un bloque nuevo "Detalle técnico" con
`<ProductsView products={job.products} />` (mismo componente de solo lectura que
ya usa la pestaña Detalle — no es un campo nuevo ni una copia editable, es un
preview de la misma fuente de datos) + el texto de `specialRequirements` si lo
hay, y un link "Editar en la pestaña Detalle →" que cambia de tab. Efecto: al
entrar a cualquier ficha (General es la tab por default) ya se ve todo — cliente,
fechas, descripción, y ahora también qué productos/materiales/medidas/notas
tiene cargados y cualquier requisito especial — sin tener que ir a buscarlo a
otra pestaña. Editar sigue siendo solo desde Detalle (no se duplicó la
superficie de edición, solo la de lectura).

**Hallazgo de las skills corridas sobre este cambio** (`design-critique` +
`accessibility-review`, ver punto 4 de abajo): el preview de solo lectura
reusaba `ProductsView` tal cual, que renderiza un checkbox real
`disabled` para "procesado" cuando no se pasa `onToggle` — un checkbox
deshabilitado se ve casi idéntico a uno clickeable (confunde a simple vista) y,
más grave, revertir ese `disabled` a un `<span>` decorativo sin más lo dejaba
sin nombre accesible (un lector de pantalla lo saltea en silencio, cuando el
checkbox original sí anunciaba su estado). Se resolvió en
`Common/ProductsEditor.tsx`: sin `onToggle`, `ProductsView` ahora renderiza un
ícono estático (`Check` de lucide-react, fondo verde si está tildado) con
`role="img" aria-label="Procesado"/"Sin procesar"` — visualmente distinto de un
control interactivo y accesible por lectores de pantalla. Con `onToggle` (la
pestaña Detalle) sigue siendo el checkbox real de siempre, sin cambios.

### 3. Buscador de Carga rápida — aclaración, sin cambio de código

Gonzalo preguntó para qué sirve el buscador que aparece arriba en Carga rápida.
**No es un campo de la propia página** — es el buscador global del Header
(`Layout/Header.tsx`, "Buscar trabajo, cliente, material...") que aparece en
TODAS las pantallas de la app (vía `AppLayout`), no algo puesto a propósito en
el formulario de alta. Se le explicó así, sin tocar código — si en algún momento
pide sacarlo específicamente de esa pantalla (podría verse como ruido en medio
de un formulario), es un cambio a evaluar aparte, no se hizo acá.

### 4. Skills corridas + hallazgo de contraste

`design-critique` y `accessibility-review` sobre los cambios de este punto 1-2 y
del punto 5 de abajo. Contraste del `CountdownBadge` compacto verificado contra
los 5 tonos que reusa (`crit` 7.77:1, `urg` 6.21:1, `norm` 5.78:1, `plan` 6.35:1,
`wait` 6.59:1) — todos de sobra por encima de AA (4.5:1); bajar el tamaño de
fuente a 10px no cambia el ratio de contraste (depende solo del color, no del
tamaño). El hallazgo real de accesibilidad fue el del ícono de "procesado" ya
descripto arriba.

### 5. Countdown del Kanban, demasiado grande — resuelto

`CountdownBadge` (`Common/Badges.tsx`) suma una prop `compact` — sin emoji,
`text-[10px] px-1.5 py-0.5` en vez de `text-xs px-2 py-1` con emoji, mismo peso
visual que el chip de N° de Copernico que ya vive al lado en la tarjeta del
Kanban. Se usa solo en `KanbanPage.tsx` (`CardBody`); el resto de la app
(Tabla, Dashboard, ficha) sigue con la versión normal. La fila que contiene
ambos chips (código + countdown) pasó a `flex-wrap`: en columnas angostas (el
caso normal del Kanban — ver AUDITORIA_UXUI_2026-09-15.md ítem #5) un código
largo tipo `TRB-2026-XXXXX` más el countdown no entran siempre en una sola
línea; antes el countdown se cortaba a mitad de palabra ("Fal/tan/0h/0m" en 3
líneas, lo que Gonzalo describió como "rarísimo, mucho espacio mal usado")
— ahora, si no entran juntos, el countdown baja entero a su propia línea.

### 6. Nota técnica: el navegador integrado no pudo leer contenido de `bonta-app.vercel.app`

Al pedir confirmar el deploy en Vercel, `navigate` a `https://bonta-app.vercel.app`
funcionó (la pestaña carga la URL) pero **todas** las herramientas de lectura de
contenido (`computer{screenshot}`, `get_page_text`, `read_page`,
`javascript_tool`) fallaron repetidamente con `"Policy check temporarily
unavailable; retry"` — probado en la pestaña existente y en una pestaña nueva,
varias veces, en dos rondas de la misma sesión. **En `localhost:5173` estas
mismas herramientas funcionaron sin problema en la misma sesión**, así que no es
una falla genérica del navegador — parece específico del origen
`bonta-app.vercel.app`. No se pudo determinar la causa (¿permiso pendiente de
aprobar del lado de Gonzalo? ¿bloqueo temporal de la herramienta?). Si una
sesión futura necesita mirar el sitio deployado y se encuentra con el mismo
error, no vale la pena reintentar en loop — probar una vez, y si persiste,
pedirle a Gonzalo que confirme visualmente él mismo o que revise si hay algún
permiso pendiente de aprobar en el panel del navegador integrado.

### 7. Estado de git

Todo lo de esta ronda (puntos 1, 2 y 5; el punto 3 no tocó código) va en un solo
commit. Verificar en el historial de `git log` si ya se pusheó a `origin/main`
antes de asumir que estos cambios están en producción.

---

## 31. Actualización 16/09 — roles (confirmación + 1 fix real), carga de diseño por persona, auto-archivado de Entregados

Ronda de 6 pedidos sobre roles/permisos, una visualización nueva y housekeeping
del Kanban/Trabajos. **Importante:** de los 4 pedidos de roles (1-4), 3 ya
estaban correctos en el código — se verificó explícitamente en vez de asumir, y
solo se tocó código donde de verdad hacía falta (punto 1). No confundir "ya
andaba bien" con "no hacía falta pedirlo": sin la verificación no se sabía.

### 1. Admin ve TODA la app — 1 fix real (default de scope del Dashboard)

**Verificado en `lib/permissions.ts`:** `canCreateJobs`, `canEditAnyJob`,
`canChangePriority`, `canAssign`, `canApproveFiles`, `canSeeStats`,
`canDeleteJob` ya devuelven `true` para `role === 'admin'` (además de
`coordinador`), y `canViewJob` ya deja a un admin ver cualquier trabajo sin
importar quién es responsable/asignado. **Esto ya cubría "editar, eliminar y
demás" para Pancho/Martín/Gonzalo — no hizo falta tocar nada ahí.**

**El fix real:** el Dashboard (`DashboardPage.tsx`) por default mostraba
"Por mí" a cualquiera que no fuera productor (`user.isProducer` — Pancho y
Martín son `admin` pero `is_producer=false`, ver §13), aunque a nivel de
permisos ya pudieran ver todo. Un admin recién entrado veía solo lo que él
mismo cargó y podía interpretarlo como "no veo el resto de la app" sin saber
que el toggle "Todos" ya estaba ahí. Se cambió el default: **cualquier
`role === 'admin'` arranca en "Todos"**, sin importar `isProducer`. Gastón
(coordinador, no admin) sigue arrancando en "A mí"; Alejandra/Richard/Nancy
(coordinador, no admin, no productor) siguen en "Por mí" — sin cambios para
ellos. Cada quien lo puede cambiar y queda guardado en su propio navegador
(`localStorage`), como ya funcionaba.

### 2-3. Gastón/Gonzalo (diseño, asignados + cargan) y Nancy/Richard/Alejandra (creación + Carga rápida) — ya correcto, sin cambios

**Verificado, no se tocó nada:** Gastón es `role='coordinador'` +
`is_producer=true` (§17.2, §21) → puede cargar trabajos (`canCreateJobs`) Y le
asignan trabajos como responsable (aparece en "Responsable interno"). Gonzalo
es `admin` + `is_producer=true` → mismo doble rol. Richard y Alejandra son
`role='coordinador'` (§18/§21) → `canCreateJobs` = true → deberían ver "Carga
rápida" en el sidebar. **Nancy sigue sin cuenta creada** (falta su email real,
tintero desde §16) — hasta que se cree con `role='coordinador'`, no va a
aparecer en ningún lado, es esperable, no es un bug.

### 4. Richard no ve "Carga rápida" — no es un bug de código, es de datos/sesión

`Sidebar.tsx` gatea el link únicamente por `canCreateJobs(user.role)` — código
puro, sin ningún caso especial por persona, y ya se aplica igual para
Alejandra. Si Richard no lo ve, las dos causas más probables (ninguna
corregible desde acá sin acceso a la base real):

1. **El SQL de alta de Richard (§18, bloque "(b) Alta de Richard") nunca se
   corrió de verdad**, o se corrió con el rol equivocado — mismo patrón de
   incidente que ya pasó varias veces en este proyecto (migraciones/SQL que se
   asumían corridas y no lo estaban). Verificar con:
   ```sql
   select name, email, role, is_producer from profiles where email = 'richard@estudiobonta.com.ar';
   ```
   Tiene que devolver `role = 'coordinador'`. Si da otra cosa (o ningún
   resultado, o el email no es ese), ahí está el problema — correr de nuevo el
   UPDATE de §18(b) con el email correcto.
2. **Sesión vieja:** si Richard inició sesión antes de que se corriera el
   UPDATE, su perfil en memoria puede haber quedado con el rol viejo hasta que
   cierre sesión y vuelva a entrar (o recargue fuerte la página). Pedirle que
   cierre sesión y entre de nuevo antes de asumir que el dato en la base está
   mal.

No se tocó código para este punto — no hay nada en el código que explique un
comportamiento distinto para Richard específicamente.

### 5. Widget "Carga de diseño" — nuevo, en el Dashboard

Pedido: poder ver de un vistazo cuántos trabajos "en diseño" tiene cada
productor (Gastón/Gonzalo hoy, cualquier productor activo a futuro) para no
sobrecargar a uno solo al asignar un trabajo nuevo. Se consultó la skill
`frontend-design` antes de construirlo (patrón recomendado: barra horizontal
comparativa, no una lista de números sueltos — la longitud relativa comunica
"quién tiene más" de un vistazo mejor que comparar dígitos).

- **`src/components/Dashboard/DesignLoadWidget.tsx`** (nuevo) — tarjeta blanca
  entre la grilla de KPI y el banner de "trabajos silenciosos". Por cada
  productor activo (`isProducer && active`), una fila: avatar + nombre, barra
  horizontal (tono `info` — el mismo color que ya usa toda la app para "en
  diseño", no un color nuevo) con ancho proporcional a
  `EN_DISENO + DISENO_LISTO` asignados como responsable, el número, y un tag
  verde "Menos cargado" para quien tiene menos (si no están todos empatados).
  **Se calcula sobre todos los trabajos visibles, no respeta el toggle A mí/
  Por mí/Todos** — el panorama de carga del equipo tiene que ser el mismo sin
  importar qué esté mirando en ese momento quien lo consulta.
  Si hay menos de 2 productores activos, el widget no se muestra (no hay nada
  que comparar).
- **Hallazgo de accesibilidad** (`design-critique` + `accessibility-review`
  corridas sobre el widget): un `<div>` con `aria-label` pero sin `role`, con
  todos sus hijos `aria-hidden`, puede no exponerse en el árbol de
  accesibilidad de algunos lectores de pantalla (queda "vacío"). Se agregó
  `role="group"` a cada fila para garantizar que el `aria-label` (ej. "Gonzalo
  Varela: 3 trabajos en diseño") se anuncie.

### 6. Auto-archivado de trabajos Entregados (3 días)

Kanban y Trabajos se llenaban de trabajos ya Entregados sin límite. Gonzalo
pidió elegir entre 2 o 3 días de margen — se eligió **3**.

- **`lib/selectors.ts`**: `ARCHIVE_AFTER_DAYS = 3` + `isArchivedJob(job)` —
  `true` solo si `status === 'TERMINADO'` y pasaron 3+ días desde
  `job.finishedAt` (`differenceInCalendarDays`, ya se usa `date-fns` en el
  proyecto). **No se toca ningún otro estado** (Cancelado no se pidió, y ya
  estaba excluido del Kanban de por sí).
- **`KanbanPage.tsx`**: la columna "Entregado" oculta por default los
  archivados — se suma un checkbox "Ver archivados (Entregado)" al popover
  "Filtros" ya existente (mismo lugar que prioridad/responsable), y cuenta
  para el badge numérico de filtros activos. El resto de las columnas no
  cambia (un trabajo archivado siempre es Entregado, nunca puede estar en otra
  columna).
- **`JobsPage.tsx`**: mismo criterio — un checkbox "Ver archivados (N)" al
  lado de los filtros existentes de Trabajos, con el conteo de cuántos están
  ocultos para que no parezca que "desaparecieron".
- **No se borra nada** — es puramente un filtro de vista por default en las
  dos pantallas que se llenaban. El Dashboard no necesitó cambios: ya excluía
  Terminado/Cancelado de su lista por default desde antes (§15.4).
- **El Dashboard SÍ sigue contando estos trabajos** en sus KPIs si en algún
  momento se los busca por otro filtro — el archivado es solo un default de
  Kanban/Trabajos, no un estado nuevo del trabajo ni algo que cambie qué es
  "correcto" contar en ningún otro lado.

### 7. Verificación

`npm run build` (tsc + vite) y `npm run lint` limpios en cada paso. Probado en
vivo con el bypass de auth local (2 productores + trabajos en distintos
estados y antigüedades, revertido con `git checkout` antes de commitear):
scope "Todos" activo por default para el admin simulado, widget de carga
mostrando la barra corta + tag "Menos cargado" en el productor con menos
trabajos, checkbox de archivados funcionando en Trabajos (5→6 al tildarlo) y
en Kanban (columna Entregado 1→2 al tildarlo, badge de Filtros mostrando "1").

### 8. Tintero — sin cambios

Sigue todo lo de rondas anteriores: base de conocimiento de materiales,
estados que sobran (`NUEVO`/`APROBADO`), Manual de uso, cuenta de Nancy, fix
de `handle_new_user()`, subida real de archivos a Storage, confirmar la Etapa
3 del wizard, mobile (relevado parcialmente, ver §27), `credits_as_assigner`
(columna muerta), AFIP (proyecto aparte, §28), y confirmar el SQL de Richard
del punto 4 de esta sección.

---

## 32. Actualización 16/09 (cont.) — Nancy YA tiene cuenta (dato nuevo), pero mal cargada: sale como productora y con el email como nombre

**Corrección importante para sesiones futuras:** todas las menciones anteriores
en este archivo de "Nancy sin cuenta / falta su email" (§16.3, tintero de §18,
§21, §25, §26, §27, §31) están **desactualizadas** — Gonzalo confirmó que Nancy
ya tiene cuenta creada, con email **`nancy@ploteosbonta.com.ar`**. Nadie había
corrido el UPDATE de `profiles` que este proyecto siempre necesita después de
crear un usuario nuevo (mismo paso que ya hizo falta para Gastón/Pancho/Martín/
Alejandra/Richard) — por eso quedó con los valores por default del trigger
`handle_new_user()`.

**Los 2 síntomas que reportó Gonzalo, mismo origen (datos, no código):**
1. **Nancy aparecía en el widget "Carga de diseño" del Dashboard** (§31.5) —
   ese widget filtra productores con `isProducer && active`, exactamente el
   mismo criterio que ya usa el resto de la app (selector "Responsable",
   filtro de responsable del Kanban, etc. — ver §13.1, §19.3). Nancy no debería
   contar como productora (es coordinadora, como Alejandra/Richard) —
   `is_producer` en su fila de `profiles` quedó en `true`, el default de la
   columna, porque nadie lo puso en `false` a mano. **No se tocó código** — no
   corresponde que el widget tenga un criterio de "quién es productor" distinto
   al resto de la app, sería inconsistente. El fix es el UPDATE de abajo, igual
   que ya se hizo para Pancho/Martín en su momento.
2. **"Nancy" aparece como su email en vez de su nombre** — mismo trigger,
   mismo motivo: nadie corrió el `update profiles set name = 'Nancy'...`.

### SQL a correr en Supabase (SQL Editor → New query → Run)

```sql
update profiles
set name = 'Nancy', role = 'coordinador', sector = 'Coordinación', is_producer = false
where email = 'nancy@ploteosbonta.com.ar';
```

Verificación:
```sql
select name, email, role, is_producer, sector from profiles where email = 'nancy@ploteosbonta.com.ar';
```
Esperado: `name = 'Nancy'`, `role = 'coordinador'`, `is_producer = false`,
`sector = 'Coordinación'` — mismo perfil que Alejandra/Richard (§18/§20).

**Pendiente de confirmar que Gonzalo lo corrió** — no asumir que ya está
aplicado en ninguna sesión futura, verificar con el `select` de arriba antes de
dar el tema por cerrado. Hasta que se corra, Nancy va a seguir apareciendo en
el widget de carga de diseño y con el email como nombre en toda la app (Header,
"Generado por"/"Asigna → Responsable" de cualquier ficha que ella cargue,
`UsersPage`, etc. — no es solo el widget nuevo, es cualquier lugar que muestre
`user.name`).

No hubo cambios de código en esta ronda — es puramente un dato a corregir en la
base real.

---

## 33. Actualización 16/09 (cont.) — "Carga de diseño": de barra continua a puntos por trabajo

Gonzalo probó el widget de §31.5 y preguntó algo puntual y acertado: "¿las
barras hacen falta que vayan a lo largo hasta el fondo? ¿no se podría plantear
de otra manera más lógica?" — y pidió mirar referentes reales antes de tocar
nada.

**El problema real que señaló:** la barra original escalaba su ancho contra el
**máximo del grupo visible**, no contra ninguna magnitud absoluta — así que
quien tuviera más trabajos en diseño quedaba *siempre* con la barra al 100% de
ancho, sin importar si eran 3 o 30. Esta app no tiene ningún concepto de
"capacidad" (no hay un número de referencia de "cuánto es mucho"), así que esa
barra al tope sugería falsamente "está lleno/saturado" cuando en realidad podía
ser una carga perfectamente normal.

**Referentes consultados (vía skill `frontend-design`):** las vistas de
"workload" de herramientas reales que sí usan barras continuas (Asana, monday.com,
ClickUp) lo hacen contra una **capacidad definida y real** (horas/día, puntos de
historia) — sin eso, una barra relativa al grupo es un patrón sin la información
que necesita para tener sentido. Linear ni siquiera usa barras para esto:
agrupa por asignado y muestra un conteo simple. Conclusión: sin un número de
capacidad real en esta app (y no había ningún pedido de sumar uno), el patrón
correcto es representar la cantidad real, no un porcentaje inventado.

**Rediseño aplicado** (`Dashboard/DesignLoadWidget.tsx`): la barra continua se
reemplazó por **un punto circular (14px, tono `info`) por cada trabajo en
diseño**, tope de 10 puntos visibles + "+N" en texto si hay más, seguido del
número exacto. Un punto = un trabajo real es honesto en cualquier escala (1
punto para 1 trabajo, 3 puntos para 3, nunca se "infla" a lo ancho) y reusa el
mismo lenguaje de chip/pill que ya usa el resto de la app (`PriorityBadge`,
chips de material en `ProductsEditor`) en vez de importar un control de
bar-chart genérico ajeno al resto de la UI. Con 0 trabajos, en vez de una fila
vacía que podría leerse como "roto", el texto "Sin trabajos en diseño".

**Skill `design-critique`** corrida sobre el rediseño antes de aplicarlo — sin
hallazgos nuevos (la jerarquía puntos→número→tag "Menos cargado" quedó clara,
mismo `role="group"` + `aria-label` de §31 sin cambios, contraste del punto
`info` sobre fondo blanco verificado en 5.02:1, sobre el mínimo de 3:1 para
elementos gráficos no textuales).

Verificado en vivo con el bypass de auth local (2 productores, 1 y 3 trabajos
en diseño — revertido con `git checkout` antes de commitear): los puntos se
leen y comparan de un vistazo sin implicar que nadie está "lleno".

`npm run build`/`npm run lint` limpios. Sin cambios de código fuera de este
archivo.

---

## 34. Actualización 16/09 (cont.) — "Carga de diseño": de puntos a solo el conteo (3ra vuelta, la que quedó)

Gonzalo probó los puntos de §33 y dio feedback preciso: "no me gusta de esta
manera... hay mucha distancia entre las barras y los números a la derecha, está
raro" — y, sobre la propia explicación de la sección anterior ("Linear
directamente no usa barras... solo conteos agrupados"): **"¿y por qué no hacés
esto?"**. Tenía razón — la sección 33 ya había identificado la respuesta
correcta (conteo simple, sin visualización) pero no la aplicó, se quedó a mitad
de camino con los puntos.

**Versión final** (`Dashboard/DesignLoadWidget.tsx`): se sacó la fila de puntos
por completo. Cada renglón ahora es `justify-between` — avatar + nombre a la
izquierda, tag "Menos cargado" (si aplica) + el número a la derecha, sin ningún
elemento intermedio que estire la fila y deje espacio vacío. El número va en el
mismo chip redondeado que ya usan los contadores de columna del Kanban
(`KanbanPage.tsx`, `toneCls.count`: `bg-info-bg text-info-text border-info/30`)
— ni un patrón nuevo ni un color nuevo, el mismo lenguaje que ya existía en la
app para "cuántos hay acá".

Verificado en vivo (mismo bypass de auth local, revertido antes de commitear):
sin el espacio raro que señaló Gonzalo — cada fila queda compacta, con el
nombre pegado al avatar de un lado y el número pegado al tag del otro.
`npm run build`/`npm run lint` limpios.

**Lección para no repetir:** cuando el propio análisis (referentes, skills)
ya apunta a la respuesta más simple, aplicarla — no quedarse en una versión
intermedia que todavía carga la complejidad que se identificó como innecesaria.

---

## 35. Actualización 16/09 (cont.) — "Carga de diseño": chips compactos en vez de filas `justify-between` (4ta y última vuelta)

Gonzalo: "ahora quedo sin barra ni puntos y MUY espaciado los nombres a los
números, hacelo mejor aun. Super profesional". Tenía razón otra vez — la causa
concreta: la tarjeta de este widget es tan ancha como la grilla de KPI de
arriba (hasta 1800px), y cada fila usaba `justify-between`, así que el nombre
quedaba pegado al borde izquierdo y el número al derecho, con un hueco enorme
en el medio de una tarjeta que en los hechos solo tiene 2 renglones de
contenido real.

**Fix final** (`Dashboard/DesignLoadWidget.tsx`): en vez de una lista de filas
que ocupan el ancho completo de la tarjeta, cada productor es ahora **un chip
compacto** (`inline-flex`, fondo `ink-50`, `rounded-full`) que contiene avatar +
nombre + número + (si aplica) "· menos cargado", todo pegado adentro del mismo
contenedor — nombre y número quedan uno al lado del otro sin espacio
artificial. Los chips de los distintos productores se acomodan en una fila
(`flex flex-wrap gap-2`) uno al lado del otro, no apilados en renglones anchos.
El número sigue reusando el mismo estilo de los contadores de columna del
Kanban, ahora fusionado adentro del chip.

Verificado en vivo (mismo bypass de auth local, revertido antes de commitear):
"Gastón [1] · menos cargado" y "Gonzalo [3]" quedan como dos chips cortos uno
junto al otro, sin ningún hueco — se ve compacto y prolijo, no una lista de
renglones anchos casi vacíos. `npm run build`/`npm run lint` limpios.

**Resumen de las 4 vueltas de este widget** (§31.5 → §33 → §34 → §35), para no
repetir el camino largo la próxima vez que se pida algo parecido: barra
relativa al máximo (implica "lleno" falsamente) → puntos por trabajo (deja
hueco raro entre puntos y número) → filas `justify-between` con solo el
conteo (mismo hueco, ahora entre nombre y número) → **chips compactos con
nombre+número juntos, la versión que se quedó**. La lección de fondo es la
misma que ya se anotó en §34: en un widget angosto de contenido (2-3 líneas),
no uses un layout que asuma que el contenido tiene que llenar el ancho de una
tarjeta pensada para otra cosa (la grilla de KPI) — agrupar el contenido en
unidades compactas propias es casi siempre mejor que estirarlo.

---

## 36. Actualización 16/09 (cont.) — "Carga de diseño": vuelve la barra, pulida (5ta y — ahora sí — última vuelta)

Gonzalo, viendo los chips de §35: "no, no quedo bueno. Mucho aire por todos
lados, es difícil de leer, no es claro, **la barra estaba ok pero hay que
pulirla** para que quede bien, que sea rápido de ver, de visualizar y entender
la situación de cada uno." Sacar la barra en §33 fue un sobre-corrección — el
problema nunca fue "barra sí o no", eran dos cosas puntuales de la barra
original de §31.5, y ya estaban identificadas desde el principio: (a) escalaba
al 100% para quien tuviera más sin importar si eran 3 o 30, y (b) el resto de
las vueltas intermedias (puntos, chips) perdieron el "aire" en otro lado en vez
de arreglarlo donde estaba.

**Versión final** (`Dashboard/DesignLoadWidget.tsx`):
1. **La tarjeta pasa a `max-w-sm`** en vez de ocupar el ancho completo del
   Dashboard (hasta 1800px, igual que la grilla de KPI). Esta es la causa real
   del "mucho aire" en las 3 vueltas anteriores (§33/§34/§35) — con 2 líneas de
   contenido real, no tiene sentido un contenedor tan ancho; cualquier layout
   adentro de un contenedor así iba a tener huecos.
2. **La barra vuelve, con un piso de escala** (`SCALE_FLOOR = 5`): el ancho de
   cada barra ahora es `count / max(5, count_real)`, no `count / max_del_grupo`
   — con 1-4 trabajos (el rango normal de este equipo de 2 personas) las barras
   se ven proporcionalmente cortas de verdad, no siempre al 100%. Recién si
   alguien llega a 5+ trabajos en diseño la barra empieza a acercarse al final
   — ahí sí "está cargado" es una lectura honesta.
3. **Fila compacta y alineada**: columna de nombre de ancho fijo (84px) +
   barra `flex-1` (corta, porque ahora vive adentro de una tarjeta angosta) +
   número pegado al final — sin espacio artificial entre ninguno de los tres.
4. **"Menos cargado" se sacó del renglón** (dejaba de leerse bien ahí) y pasa a
   una sola frase abajo de las barras: "**Nombre** tiene menos carga." — no
   hace falta repetirlo por persona si solo hay uno con el mínimo.
5. La barra de quien tiene menos carga se pinta en `plan` (verde) en vez de
   `info` (azul) — refuerza visualmente la misma idea que ya dice la frase de
   abajo, sin agregar un elemento nuevo.

Verificado en vivo (mismo bypass de auth local, revertido antes de commitear):
Gonzalo (3 trabajos) con una barra al 60% de una escala de 5, Gastón (1
trabajo) al 20%, "Gastón tiene menos carga." debajo — se compara de un
vistazo, sin lucir "lleno" y sin aire de sobra. `npm run build`/`npm run lint`
limpios.

**Resumen final de las 5 vueltas de este widget** (§31.5 → §33 → §34 → §35 →
§36): barra sin piso de escala → puntos → solo conteo en filas anchas → chips
compactos → **barra con piso de escala + tarjeta angosta**. Los dos problemas
reales identificados desde la primera ronda (escala engañosa + tarjeta
demasiado ancha para su contenido) eran independientes entre sí — sacar la
barra nunca iba a arreglar el segundo, y de hecho lo empeoró al perder la
comparación visual instantánea que la barra sí daba. **Lección para no
repetir:** frente a un problema de diseño con 2 causas reales, arreglar las
2 causas — no descartar el elemento entero por una sola de ellas.

---

## 37. Actualización 17/09 — "Carga de diseño": filas en paralelo, no apiladas (6ta vuelta)

Gonzalo, con la barra ya pulida de §36: "está bien ahora, pero ponenos en
paralelo, no uno abajo de otro, así es más fino que alto y no ocupamos visión
de trabajos" — el widget apilaba una fila por productor (`space-y-2`), lo que
lo hacía más alto de lo necesario y empujaba hacia abajo la lista de "Trabajos
activos" que es lo que de verdad importa ver sin scrollear de más.

**Fix** (`Dashboard/DesignLoadWidget.tsx`): el contenedor pasa de `space-y-2`
(una fila por renglón) a `flex flex-wrap items-center gap-x-5 gap-y-2` (los
productores uno al lado del otro, en la misma línea). Cada productor se achica
a una unidad compacta propia (avatar 18px + nombre + barra fija de 64px +
número, `gap-1.5` interno) en vez de una fila que reparte columna de nombre +
`flex-1` de barra — con varios productores en paralelo, ya no tiene sentido que
la barra de cada uno "estire" hasta ocupar el resto de una fila propia. La
tarjeta pasa de `max-w-sm` a `max-w-md` para darle margen a 2+ productores lado
a lado sin apretarlos; si hay más productores de los que entran en una línea,
`flex-wrap` los baja a una segunda fila en vez de desbordar. La frase "Nombre
tiene menos carga" se mantiene debajo, sin cambios.

Resultado: con 2 productores el widget pasa de ~4 líneas de alto (título +
descripción + 2 filas + frase) a ~3 (título + descripción + 1 fila con los 2
lado a lado + frase) — más fino, como pidió Gonzalo. Verificado en vivo (mismo
bypass de auth local, revertido antes de commitear): Gonzalo (barra al 60%) y
Gastón (barra al 20%) en la misma línea, `aria-label` de cada uno intacto.
`npm run build`/`npm run lint` limpios.

**Nota para no repetir el patrón de las 6 vueltas de este widget** (§31.5 →
§33 → §34 → §35 → §36 → §37): cada ronda fue un ajuste real y puntual sobre
feedback específico de uso, no cambios de gusto porque sí — layout apilado vs.
en paralelo, ancho de tarjeta, escala de la barra, y contenido de cada fila son
4 ejes de diseño independientes entre sí. Si en el futuro se pide "ajustar" este
widget de nuevo, identificar primero CUÁL de esos ejes es el problema real
antes de tocar el resto.

---

## 38. Actualización 17/09 (cont.) — SQL de Nancy/Richard: verificado con SELECT real, Nancy OK, Richard sigue mal

Gonzalo pidió chequear si el SQL de la sección 32 (Nancy) y de la 31.4 (Richard)
ya estaba corrido, "teóricamente lo hice". La sesión **no pudo consultarlo
directamente** — la tabla `profiles` tiene RLS `to authenticated using (true)`
(`002_policies.sql`), así que un request anónimo con la `anon key` devuelve `[]`
en vez de un error (probado contra el REST de Supabase); sin loguearse con una
cuenta real (nunca se hace, ni con credenciales de Gonzalo) no hay forma de leer
la tabla desde acá. Se le pidió a Gonzalo que corra el SELECT y pase el
resultado — lo hizo, screenshot con las dos filas:

| name | email | role | is_producer | sector |
|---|---|---|---|---|
| Richard | richard@estudiobonta.com.ar | **`produccion`** | false | Coordinación |
| Nancy | nancy@ploteosbonta.com.ar | `coordinador` | false | Coordinación |

**Nancy: confirmado resuelto.** `role`/`is_producer`/`sector`/`name` quedaron
exactamente como pedía el SQL de la sección 32 — no hace falta ningún SQL más
para ella. Ya no sale como productora en "Carga de diseño" ni con el email como
nombre.

**Richard: el SQL de la sección 18(b) NUNCA se aplicó de verdad**, pese a que en
algún momento se dio por confirmado — `role` quedó en `produccion` (el default
del trigger `handle_new_user()`), no en `coordinador`. `is_producer`/`sector` sí
están bien (corrieron en algún momento posterior, probablemente junto con el SQL
de la sección 20 que solo tocaba `sector`). Esto **confirma la sospecha de la
sección 31.4**: con `role='produccion'`, `canCreateJobs` da `false`, así que a
Richard no le puede aparecer "Carga rápida" en el sidebar — no es un bug de
código, es este dato mal cargado. SQL pendiente, a correr en Supabase → SQL
Editor → Run:

```sql
update profiles set role = 'coordinador' where email = 'richard@estudiobonta.com.ar';
```

Verificar después con:
```sql
select name, email, role, is_producer, sector from profiles where email = 'richard@estudiobonta.com.ar';
```
Esperado: `role='coordinador'`. **No dar esto por cerrado en ninguna sesión
futura sin ese SELECT** — ya pasó dos veces con Richard puntualmente (sección 18
y ahora esta) que se asumió corrido sin estarlo.

Sin cambios de código en esta ronda — es puramente verificación de datos. Memoria
de proyecto (`project_team_roles`) actualizada con este resultado.

**Actualización el mismo día, minutos después:** Gonzalo corrió el UPDATE de
arriba y pasó un segundo screenshot del SELECT — confirma `role='coordinador'`
para Richard. **Con esto, los 7 de 7 perfiles del equipo quedan verificados
correctos, sin ningún SQL pendiente.** Richard ya debería ver "Carga rápida" en
el sidebar (si no la ve, pedirle que cierre sesión y vuelva a entrar — el rol
puede haber quedado cacheado en su sesión si ya estaba logueado, mismo caso ya
señalado en la sección 31.4 punto 2). Memoria `project_team_roles` actualizada a
este estado final.

---

## 39. Actualización 17/09 (cont.) — Auditoría Fase 1 (simplificación/UX) + primer cambio: se sacan los estados NUEVO/APROBADO

Gonzalo pidió una auditoría completa (arquitectura, modelo de datos, Dashboard/
Trabajos/Kanban, ficha, estados, permisos) antes de tocar código, con la meta de
simplificar la app sin perder información — no una reconstrucción, una revisión
crítica de lo que ya existe. Se hizo sin escribir código, leyendo a fondo
`types/index.ts`, `catalog.ts`, `statusChange.ts`, `selectors.ts`,
`permissions.ts`, las tres vistas (Dashboard/JobsTable/Kanban), `JobDetailPage.tsx`
completo, `QuickJobPage.tsx`, `useStore.ts`, `Header.tsx`, `CommentsPanel.tsx` y el
esquema SQL. El análisis completo (qué mantener/simplificar/eliminar/modificar/
agregar + plan por fases) se le presentó en el chat, no quedó en un archivo aparte
— si hace falta retomarlo, está en el historial de esa conversación.

### Hallazgos que no estaban documentados en ninguna sección anterior de este archivo

1. **`Job.stages` / `JobStage[]` — sistema de etapas sin ninguna UI.** `createJob`
   sigue sembrando un renglón en `job_stages` por cada etapa del tipo de trabajo
   (`jobType.defaultStages`), y existe una acción completa en el store
   (`setStageStatus`, con log de actividad) para marcarlas — pero **ningún
   componente la llama ni muestra `job.stages`** (confirmado por grep sobre todo
   `src/components`). Es dato puro sin UI, un tercer sistema de "estado" además de
   `job.status` y las columnas del Kanban. Su único efecto indirecto es que
   `calculateRisk()` (`lib/risk.ts`) cuenta `job.stages.filter(s => s.active).length`
   para el nivel de riesgo "Alto" — pero como `active` nunca se pone en `false` en
   ningún lado, en la práctica es solo un proxy de "cuántas etapas tiene el tipo de
   trabajo". **Pendiente de decisión de Gonzalo**: sacarlo del todo (mi
   recomendación) o construirle una pantalla real. No se tocó nada de esto todavía.
2. **Buscador global del Header no respeta `visibleJobs`.** Busca sobre
   `useStore((s) => s.jobs)` directo, sin filtrar por rol — un usuario
   `producción`/`instalación` (que en el resto de la app solo ve sus propios
   trabajos vía `canViewJob`) puede ver en el dropdown de resultados trabajos
   ajenos (nombre, cliente, responsable) aunque después la ficha se lo bloquee al
   entrar. Además busca sobre `materialIds`, un campo `@deprecated` (reemplazado
   por `products` desde el 02/09) — no encuentra nada cargado en meses. No
   corregido todavía, queda para Fase 2.
3. **`UsersPage` sin ningún guard de permiso**, a diferencia de `ConfigPage` (que sí
   valida `canManageCatalog(user.role)` y degrada a solo lectura). Cualquier
   persona logueada que navegue a `/usuarios` a mano ve la lista completa con el
   checkbox de activar/desactivar cuentas — el guardado fallaría por RLS, pero la
   UI se muestra igual. Es el prerequisito a resolver antes de construir el
   Histórico admin-only que pidió Gonzalo (sección 15 de su brief) — hoy no existe
   ningún patrón de guard de ruta reutilizable en el proyecto. No corregido todavía.
4. **Botones de mención por sector en Comentarios son decorativos.**
   `CommentsPanel.tsx`, constante `MENTIONABLE` (`@Coordinación`, `@Diseño`, etc.)
   inserta texto literal en el textarea, pero `submit()` solo genera una mención
   real (y por lo tanto notificación) si el texto matchea el nombre de pila de un
   usuario real — nunca notifica a "todo Diseño". No corregido todavía.
5. **`deleteJob` es un borrado físico total** (cascade real en la base, sin
   registro de quién ni cuándo) — no existe ningún soft-delete hoy. Relevante para
   el pedido de Gonzalo de poder eliminar trabajos desde el Kanban (arrastrar a un
   tacho): antes de construir eso conviene pasar a borrado lógico, coherente con
   su preferencia explícita de no perder información si se puede evitar.

### Estados — aclaración importante (no es el bug que parecía)

El dropdown "Estado de trabajo" **ya usa la misma función** (`statusOptionsFor` de
`lib/statusChange.ts`) en Dashboard, Trabajos y ficha — no hay tres listas
independientes por pantalla, eso ya se había resuelto en una ronda anterior. Lo que
sí es real: para admin/coordinador ese dropdown ofrece 11 estados (`ADMIN_STATUSES`)
mientras el Kanban solo tiene 7 columnas — porque `JobStatus` mezcla macro-etapa
(lo que ve el Kanban) con sub-estado dentro de esa etapa (ej. `EN_DISENO` vs
`DISENO_LISTO` son la misma columna pero valores distintos del enum). Separar esto
conceptualmente queda para una fase futura (Fase 3 del plan); no se tocó en esta
ronda, solo se sacaron los dos valores que ya estaban muertos (ver abajo).

### Cambio aplicado esta ronda: se sacan los estados `NUEVO` y `APROBADO`

Gonzalo confirmó explícitamente que sobran (ver también sección 7, punto 4, que ya
lo sospechaba desde hace semanas — ningún flujo los produce desde que `createJob`
inserta `PENDIENTE`/`FALTA_INFORMACION` directamente).

**Código tocado:**
- `types/index.ts` — sacados del union `JobStatus`.
- `data/catalog.ts` — sacados de `STATUS_LABELS` y de la lista de estados de la
  columna Kanban "Pendiente" (que ahora agrupa solo `PENDIENTE` y
  `FALTA_INFORMACION`).
- `Common/Badges.tsx` — sacados de `STATUS_TONE`.
- `data/seed.ts` (código muerto en runtime, pero `tsc` lo sigue compilando — ver
  sección 2) — los 4 trabajos demo que tenían `status: 'NUEVO'`/`'APROBADO'` pasan
  a `'PENDIENTE'` para que el archivo siga tipando.
- `supabase/001_schema.sql` — el default de la columna `status` pasa de `'NUEVO'`
  a `'PENDIENTE'` (documentación de instalación limpia; en la práctica nunca se
  usaba porque `createJob` siempre manda el status explícito).

**Migración nueva `supabase/017_drop_legacy_statuses.sql`** — por las dudas de que
haya algún trabajo real viejo con `status = 'NUEVO'` o `'APROBADO'` en la base (no
se pudo verificar desde acá por RLS, ver sección 38 sobre esa limitación), migra
cualquiera que exista a `PENDIENTE` antes de que el cambio de código deje esos
valores sin `STATUS_LABELS` (lo que renderizaría un badge en blanco). **Hay que
correrla en Supabase:**
```sql
update jobs set status = 'PENDIENTE' where status in ('NUEVO', 'APROBADO');
alter table jobs alter column status set default 'PENDIENTE';
```
Verificado con `npm run build` (tsc + vite) y `npm run lint` limpios — sin cambios
ni warnings nuevos. **Pendiente de confirmar que Gonzalo corrió esta migración** —
no asumir que ya está aplicada en ninguna sesión futura sin el SQL de verificación:
`select status, count(*) from jobs group by status;` no debería devolver ninguna
fila con `NUEVO` o `APROBADO`.

### Estado de git

Sin commit todavía — Gonzalo no lo pidió en esta ronda. El resto de la auditoría
(sistema de etapas, buscador global, guard de `UsersPage`, soft-delete, Histórico)
sigue pendiente de que confirme cómo seguir antes de tocar más código — Fase 1 fue
explícitamente "solo auditoría", este cambio de estados fue la única excepción
porque Gonzalo lo confirmó de forma explícita y acotada.

---

## 40. Actualización 17/09 (cont.) — arranca Fase 2: se saca el sistema de etapas, se tapa la fuga del buscador global y el agujero de permisos de Usuarios

Gonzalo confirmó los dos puntos que habían quedado abiertos de la sección 39: sacar
el sistema de etapas (sí), y sobre el archivado — preguntado de nuevo, dijo "no sé
de qué hablás, así que la respuesta es no" (no se acordaba del detalle de esa
pregunta puntual de la auditoría). Se interpreta como un "no" a la opción más
compleja (un registro artificial de "quién archivó"), lo que en los hechos
confirma la recomendación original: el archivado sigue siendo calculado al vuelo
(`isArchivedJob`, sin `archived_at`/`archived_by`) — no hay nada que implementar
todavía, es Fase 4. **Si en algún momento Gonzalo pide precisión sobre esto, volver
a explicar la pregunta desde cero** — no asumir que la recuerda de una sesión
anterior. Dicho esto, pidió arrancar la Fase 2 completa del plan de la auditoría.
Se hicieron los 3 ítems que esa fase tenía pendientes.

### 1. Sistema de etapas — eliminado por completo

Se sacó todo lo que sembraba/leía/exponía `job.stages` (ver sección 39, hallazgo 1,
para el diagnóstico completo de por qué era dato sin dueño):
- `types/index.ts` — se borraron `StageKey`, `StageStatus`, `JobStage`, y los
  campos `Job.stages` y `JobType.defaultStages`.
- `data/catalog.ts` — se borró `STAGE_LABELS` y el campo `defaultStages` de cada
  entrada de `DEFAULT_JOB_TYPES`.
- `lib/dbMappers.ts` — se borró `mapStage()` y el campo `stages` de `mapJob()`; ya
  no se lee `row.job_stages` ni se mapea `job_types.default_stages`.
- `lib/supabaseQueries.ts` — se sacó `job_stages(*)` del embed `JOB_SELECT`.
- `store/useStore.ts` — se borró la acción `setStageStatus` completa (no la
  llamaba ningún componente, confirmado), el campo `activeStageKeys` de
  `NewJobInput`, y el insert a `job_stages` dentro de `createJob`. `addJobType`
  ya no manda `default_stages` al crear un tipo nuevo (la columna tiene default
  `'{}'` en la base, no hace falta mandarlo).
- `components/QuickJob/QuickJobPage.tsx` — sacado `activeStageKeys: jobType.defaultStages` del payload de `createJob` (y la variable `jobType`, que ya no se usaba para nada más).
- `data/seed.ts` (código muerto en runtime, pero compilado por `tsc`) — se sacaron
  `makeStages`/`buildStages`, el campo `stages` del objeto `Job`, y
  `stagesDone`/`stageInProgress` de la interfaz `Seed` y de las ~20 filas del
  dataset demo (reemplazo mecánico con `sed`, verificado después con build).
- **`lib/risk.ts`** — `calculateRisk()` usaba `job.stages.filter(s => s.active).length`
  como proxy de "cuántas etapas tiene este tipo de trabajo" para el nivel de
  riesgo "Alto". Al sacar `job.stages`, se simplificó esa condición a
  `job.requiresInstallation && hours <= 96` (instalación + plazo ajustado ya
  alcanza como señal de "más partes móviles, más riesgo") — se sacó el umbral de
  "3+ etapas" en vez de reemplazarlo por una consulta a `jobTypes` para no sumar
  una dependencia nueva a una función que hasta ahora era pura.

**Lo que NO se tocó, a propósito:** la tabla `job_stages` y la columna
`job_types.default_stages` siguen existiendo en la base — no se dropearon ni se
migró nada a nivel de esquema. Son datos huérfanos ahora (nada los lee ni los
escribe desde la app), pero borrar una tabla es una operación destructiva que no
corresponde meter en la misma pasada que un refactor de código; si en algún
momento Gonzalo quiere limpiarlos de la base para no dejar basura, es una
migración aparte a pedir explícitamente.

### 2. Buscador global del Header — dejó de mostrar trabajos ajenos

`Header.tsx` buscaba sobre `useStore((s) => s.jobs)` sin pasar por
`visibleJobs(user, jobs)` — un rol `producción`/`instalación` (que en el resto de
la app solo ve lo suyo vía `canViewJob`) podía ver en el dropdown de resultados
nombre/cliente/responsable de trabajos ajenos, aunque la ficha se lo bloqueara
después al entrar. Se agregó el filtro `visibleJobs(user, jobs)` antes de buscar
(con guard `if (!user) return []` porque el hook corre antes del `if (!user)
return null` del final del componente). De paso, el buscador matchea contra
`materialIds` — campo `@deprecated` desde el 02/09, reemplazado por `products` —
así que no encontraba nada cargado en meses; ahora busca
`job.products[].label`/`.materialIds` en su lugar.

### 3. Guard de rutas admin-only — nuevo, aplicado a `/usuarios`

Hallazgo de la auditoría (sección 39, hallazgo 3): `UsersPage` no validaba ningún
permiso — a diferencia de `ConfigPage` (que sí chequea `canManageCatalog` y
degrada a solo lectura), cualquier persona logueada que navegara a `/usuarios` a
mano veía la lista completa de usuarios con el checkbox de activar/desactivar
cuentas (el guardado en sí fallaba por RLS, pero la UI se mostraba igual).

Nuevo componente **`Common/RequireRole.tsx`** — wrapper de ruta genérico
(`{ allow: (role) => boolean; children }`) que redirige a `/` con `<Navigate>` si
el usuario no cumple el chequeo, mismo patrón que ya usa `AppLayout` para
`!user`. Aplicado en `App.tsx` a la ruta `/usuarios`:
`<RequireRole allow={canManageUsers}><UsersPage /></RequireRole>`. `/configuracion`
se dejó como está (su propio chequeo interno con degradado a solo lectura es
correcto ahí — ver los catálogos de tipos/materiales no es sensible). Este
componente queda como el patrón a reusar cuando se construya el Histórico
admin-only (Fase 4).

### Verificación

`npm run build` (tsc + vite) y `npm run lint` limpios — sin warnings nuevos (el
único warning que tira `oxlint` es preexistente, de `Badges.tsx`, sin relación con
esta ronda). Grep final sobre todo `src/` confirma cero referencias sueltas a
`StageKey`/`JobStage`/`StageStatus`/`STAGE_LABELS`/`setStageStatus`/
`activeStageKeys`/`defaultStages`/`job_stages`. Se probó que el login carga sin
errores de consola en `localhost:5173`; no se hizo una pasada visual autenticada
completa esta ronda (los cambios son en su mayoría de tipos/backend — remoción de
código muerto, un filtro de búsqueda, y un redirect de ruta — de riesgo bajo y sin
UI nueva que mostrar).

### Estado de git

Commiteado y pusheado a `origin/main` en un commit dedicado a esta ronda (además
del commit previo de NUEVO/APROBADO, ya en `main` desde antes de arrancar esto).

### Lo que sigue de la Fase 2 original — ya cerrado

Con esto se completan los 3 ítems que el plan de la sección 38 (auditoría) había
puesto en Fase 2. Quedan Fase 3 (unificar estados — separar macro-etapa de
sub-estado en `JobStatus`), Fase 4 (soft-delete + tacho en Kanban + Histórico
admin-only + subir umbral de archivado a 5 días), Fase 5 (fricción de uso diario)
y Fase 6 (manual) — a la espera de que Gonzalo pida seguir con la que corresponda.

---

## 41. Actualización 17/09 (cont.) — Fase 3: `BLOQUEADO` deja de ser un estado, pasa a ser un flag ortogonal (bug de fondo corregido)

Gonzalo pidió seguir con Fase 3 ("unificar estados"). Investigando a fondo antes
de tocar nada apareció un **bug de correctitud real, no solo cosmético**, que
terminó siendo el corazón de esta fase.

### El bug encontrado

`blockJob` pisaba `jobs.status = 'BLOQUEADO'` al bloquear un trabajo, y
`unblockJob` lo devolvía **siempre** a `'EN_PRODUCCION'` al desbloquear, sin
importar en qué etapa real estuviera el trabajo. Un trabajo bloqueado estando en
Control de calidad (o en Instalación, o donde sea) **perdía esa etapa real** al
desbloquearse — volvía a aparecer como si recién hubiera entrado a producción,
aunque en verdad ya estuviera mucho más adelante en el flujo. Además, como
`BLOQUEADO` no estaba en ninguna columna de `KANBAN_COLUMNS`, el Kanban lo
mandaba a la columna "Pendiente" por el fallback de `columnOf()` — un trabajo
bloqueado a mitad de producción "saltaba" visualmente al principio del tablero.

Esto es exactamente el tipo de problema que el punto 10 de tu pedido original
sospechaba ("si existen estados que en realidad deberían ser sub-estados/flags,
analizar si corresponde separarlos") — `BLOQUEADO` nunca fue una etapa de verdad,
es una pausa que puede pasar en cualquier etapa. Tratarlo como si reemplazara la
etapa fue lo que causaba la pérdida de datos.

### La solución

**`BLOQUEADO` se sacó de `JobStatus` por completo.** Bloquear/desbloquear un
trabajo ya no toca `status` en absoluto — solo abre/cierra una fila en
`block_records`, tal como ya hacía antes de tocar el status. "¿Está bloqueado?"
sigue siendo `isBlocked(job)` (`lib/selectors.ts`, ya existía y ya era correcta:
deriva de `blockRecords`, nunca leyó `status`) — lo que cambió es que ahora **es
la única fuente de verdad**, status ya no compite con ella.

**Código tocado:**
- `types/index.ts`, `data/catalog.ts` (`STATUS_LABELS`), `Common/Badges.tsx`
  (`STATUS_TONE`) — sacado `BLOQUEADO`.
- `store/useStore.ts` — `blockJob`/`unblockJob` ya no escriben `status`, solo
  tocan `last_activity_at` (mismo criterio que el resto de los "touch" del
  store).
- `data/seed.ts` — el único trabajo demo con `status: 'BLOQUEADO'` pasa a
  `'EN_PRODUCCION'` (su bloqueo real se sigue viendo igual: ya tenía su propio
  campo `blocked` que arma `blockRecords` aparte).
- **Nuevo `BlockedBadge`** (`Common/Badges.tsx`) — pill rojo compacto
  (🔒 Bloqueado, con el motivo en el `title`), mismo lenguaje que
  `SampleReviewBadge`. Se agregó a las 4 vistas que antes se enteraban de un
  bloqueo solo porque el status literal decía "Bloqueado":
  - `JobsTable.tsx` — al lado del `StatusSelect`.
  - `DashboardJobCard.tsx` — al lado del `StatusSelect`.
  - `Kanban/KanbanPage.tsx` — tag "bloqueado" en la fila del cliente (mismo
    patrón que el tag "muestra" que ya existía) **+ borde rojo de 2px en toda la
    tarjeta** — este último es la compensación real por haber perdido el "salto
    a Pendiente": antes esa reubicación errónea funcionaba, sin querer, como una
    señal visual fortísima de "esto está mal"; ahora que el trabajo se queda en
    su columna real (correcto), hacía falta algo igual de imposible de no ver.
  - `JobDetailPage.tsx` — sumado a la tira de badges de la cabecera, además del
    banner rojo completo que ya tenía (ese banner no se tocó, sigue con el
    motivo completo y el botón "Desbloquear").
- **`JobsPage.tsx`** — nuevo checkbox "🔒 Solo bloqueados (N)" en la barra de
  filtros (mismo patrón que "Ver archivados") — compensa que elegir "Bloqueado"
  en el filtro de Estado ya no es una opción posible.

### Migración pendiente — `018_drop_bloqueado_status.sql`

Si hay algún trabajo real en la base con `status = 'BLOQUEADO'` ahora mismo, no
hay forma de recuperar en qué etapa estaba de verdad antes de bloquearse (ese
dato ya se había perdido con el diseño viejo, el mismo bug de arriba). La
migración lo pasa a `'EN_PRODUCCION'` como valor de referencia (mismo default
que ya usaba `unblockJob`) — **el bloqueo en sí no se pierde**, sigue viéndose
igual porque ahora se arma desde `block_records`, no desde `status`. Si algún
trabajo puntual necesita otra etapa real, se corrige a mano después. SQL a
correr en Supabase:
```sql
update jobs set status = 'EN_PRODUCCION' where status = 'BLOQUEADO';
```
**Pendiente de confirmar que Gonzalo la corrió** — mismo patrón de siempre, no
asumir. Verificar con `select code, name, status from jobs where status =
'BLOQUEADO';` (debería devolver 0 filas).

### Lo que NO se tocó, a propósito

`EN_DISENO`/`DISENO_LISTO` (mismo grupo del Kanban, dos valores distintos) y
`LISTO_PARA_ENTREGA`/`LISTO_PARA_INSTALACION` (ídem) **no se colapsaron** —
a diferencia de `BLOQUEADO`, son distinciones reales y con sentido (diseño
terminado pero sin aprobar todavía; el destino final es distinto según si el
trabajo va a instalación o no), no un flag mal modelado. Restructurar el enum
completo en dos dimensiones (macro-etapa + sub-estado explícito) sería un cambio
mucho más grande para un beneficio dudoso, y no correspondía sin pedirlo — se
resolvió específicamente el caso que tenía un bug real detrás.

### Verificación

`npm run build`/`npm run lint` limpios, sin warnings nuevos. Grep final sobre
`src/` confirma que `BLOQUEADO` solo queda en comentarios explicativos y en el
texto literal del banner de la ficha (no en ninguna comparación de tipo). No se
hizo una pasada visual autenticada completa esta ronda — mismo criterio que la
Fase 2 (cambios de lógica/estado, verificados por build + revisión de código, no
hay UI nueva compleja que justifique el bypass de auth local).

### Estado de git

Commiteado y pusheado a `origin/main`.

---

## 42. Actualización 17/09 (cont.) — Fase 4: borrado lógico, tacho en el Kanban, sección Histórico (admin-only), 5 días de archivado

Última fase del plan de la auditoría con trabajo concreto. Los 4 puntos que
tenía pendientes, todos hechos:

### 1. Borrado lógico — `deleteJob` deja de ser un DELETE físico

Antes: `deleteJob` hacía `supabase.from('jobs').delete()` con cascade real —
sin rastro, sin poder deshacer. Ahora marca `deleted_at`/`deleted_by` (UPDATE,
no DELETE); el trabajo desaparece de Dashboard/Trabajos/Kanban/buscador global
pero sigue entero (archivos, comentarios, historial) y es **restaurable**.

- **Migración `019_job_soft_delete.sql`** — agrega `jobs.deleted_at`/
  `jobs.deleted_by`, y actualiza la función `jobs_update_guard()` (trigger que
  ya protegía `priority_manual`/`client_id`/`responsible_user_id`/
  `committed_date`/`requires_installation`/`code` — ver `002_policies.sql`) para
  que estos dos campos nuevos también exijan admin/coordinador, espejo exacto de
  `canDeleteJob` en la UI. Sin esto, la policy `jobs_update` de base (bastante
  permisiva: cualquiera con `can_view_job`) hubiera dejado "eliminar" un trabajo
  a cualquier rol con acceso de lectura.
- `types/index.ts` — `Job.deletedAt`/`Job.deletedBy`.
- `store/useStore.ts` — `deleteJob` reescrito (UPDATE + `insertActivity`, acción
  `'eliminar'`); nueva acción `restoreJob` (limpia los dos campos, acción
  `'restaurar'`).
- `lib/selectors.ts` — nueva `isDeletedJob(job)`.
- Las 3 vistas operativas (`DashboardPage`, `JobsPage`, `KanbanPage`) y el
  buscador global (`Header.tsx`) filtran `!job.deletedAt` — un trabajo eliminado
  nunca vuelve a aparecer ahí por accidente.
- `JobsTable.tsx` / `KanbanPage.tsx` — el texto de confirmación de "Eliminar"
  se actualizó: ya no dice "esta acción no se puede deshacer" (era cierto con
  el DELETE físico, ya no lo es) — ahora explica que se puede restaurar desde
  Histórico.
- `JobDetailPage.tsx` — si se abre la ficha de un trabajo eliminado (por
  ejemplo desde el link "Ver ficha" de Histórico), banner rojo arriba de todo:
  "🗑️ Este trabajo está eliminado desde el DD/MM (Nombre) — ... " + botón
  "Restaurar" (gateado por `canDeleteJob`). El resto de la ficha sigue
  funcionando normal (no se bloqueó edición) — no correspondía sumar esa
  complejidad sin que Gonzalo lo pidiera.

### 2. Eliminar desde el Kanban — arrastrar al tacho + confirmación

Nuevo `TrashDropZone` (`KanbanPage.tsx`) — un tacho flotante abajo a la derecha
que **solo se renderiza mientras hay una tarjeta en vuelo** (durante un drag),
como en Trello: no ocupa espacio en el uso normal del board. Solo visible si
`canDeleteJob(user.role)`. Soltar una tarjeta ahí **nunca elimina directo** —
abre el mismo `ConfirmDialog` con el nombre y N° exactos del trabajo, y recién
al confirmar llama a `deleteJob` (el borrado lógico de arriba). Probado en vivo
con el bypass de auth local: arrastrar una tarjeta hasta el tacho abre
correctamente "¿Eliminar 'Trabajo activo' (TRB-0001)?..." — funciona de punta a
punta.

### 3. Sección Histórico — nueva, admin-only

Nueva ruta `/historico` (`components/Historico/HistoricoPage.tsx`), nuevo
permiso **`canViewHistorico`** en `lib/permissions.ts` — deliberadamente
**solo `admin`**, no `coordinador` (a diferencia de la mayoría de los permisos
del proyecto), porque Gonzalo lo pidió así explícito en su brief original
("solamente para los administradores"). Es una función separada de
`canManageUsers` aunque hoy ambas den lo mismo (solo admin) — si el día de
mañana alguien no-admin necesita ver Usuarios pero no Histórico, o viceversa,
no hace falta desenredar nada.

- **No es "otro Dashboard"**: sin KPIs, sin indicadores operativos — es
  puramente buscar/consultar. Filtros: texto libre (N°/cliente/nombre),
  responsable, tipo de trabajo (los 3 que pedía el brief original explícito
  como mínimo — fecha se cubre por el orden, más recientemente archivado/
  eliminado primero, en vez de un date-range picker aparte, para no
  sobrecomplicar).
- Muestra **dos categorías juntas**, cada una con su propio tag: trabajos
  **archivados** (`isArchivedJob` — Entregados hace 5+ días) y trabajos
  **eliminados** (`isDeletedJob`). Cada fila tiene "Ver ficha" siempre, y
  "Restaurar" (gateado por `canDeleteJob`) solo si está eliminado — un
  archivado no se "restaura", ya está accesible normal, solo viejo.
- **Guard de ruta**: reusa `RequireRole` (creado en la Fase 2) —
  `<RequireRole allow={canViewHistorico}>`. Link nuevo en el Sidebar, sección
  "Administración", ícono `Archive` — el bloque completo de esa sección ahora
  se muestra si `canManageUsers(role) || canViewHistorico(role)` es cierto,
  con cada link (Usuarios/Configuración/Histórico) gateado individualmente
  adentro, para que un futuro rol que tuviera uno sin el otro no vea un link
  roto.
- Verificado en vivo con el bypass de auth local: la tabla mostró
  correctamente 1 fila "Eliminado" (con quién y cuándo) y 1 fila "Archivado"
  (con la fecha de entrega), cada una con sus badges/acciones correctas.

### 4. Umbral de archivado: 3 → 5 días

`lib/selectors.ts`, `ARCHIVE_AFTER_DAYS` — cambiado de 3 a 5, a pedido
explícito de Gonzalo (brief original, punto 13: "usar 5 días pero hacerlo
configurable"). **Sigue calculado al vuelo**, sin cron ni columna
`archived_at`/`archived_by` — Gonzalo confirmó en la sección 40 que no quería
la versión con registro artificial. "Configurable" hoy significa "cambiar la
constante en código", igual que ya era con 3 — si en algún momento se quiere
un control real desde la UI (sin redeploy), es un `app_settings` chico a
agregar aparte, no se hizo ahora por no sobrecomplicar sin pedido explícito.

### Verificación

`npm run build`/`npm run lint` limpios en cada paso. **Esta ronda sí se probó
visualmente con el bypass de auth local** (a diferencia de Fase 2/3, que eran
mayormente lógica/backend) — se sembraron 4 trabajos falsos (activo, bloqueado,
archivado, eliminado) y se navegó Kanban (columna real + borde rojo del
bloqueado, ausencia total del archivado/eliminado, drag-to-trash con
`left_click_drag` hasta abrir el diálogo de confirmación), Trabajos (checkbox
"Solo bloqueados" filtrando correctamente), ficha del trabajo eliminado
(banner + botón Restaurar), e Histórico (las 2 filas con sus tags/fechas/
acciones correctas). Sin errores de consola relevantes — los únicos que
aparecieron (`invalid input syntax for type uuid: "j4"`) son esperables: la
ficha intenta cargar comentarios/historial reales contra IDs falsos que no son
UUID, mismo patrón ya documentado en rondas anteriores de bypass (§29). El
cambio en `App.tsx` se revirtió con `git checkout -- src/App.tsx` — **ojo**:
ese revert también se llevó puesta la ruta real de `/historico` que ya estaba
en el archivo (no solo el bypass), así que hubo que reaplicarla a mano después;
quedó confirmado con `git diff src/App.tsx` que el archivo final solo tiene el
cambio de ruta esperado, nada del bypass. **Lección para la próxima vez**: si
se edita un archivo con cambios reales Y se le suma un bypass temporal en la
misma sesión, más seguro hacer el revert con una edición puntual (deshacer solo
el bloque del bypass) en vez de `git checkout --` sobre el archivo entero,
salvo que se sepa que no tiene ningún cambio real sin commitear todavía.

### Estado de git

Commiteado y pusheado a `origin/main` (Fase 4 completa).

### Lo que queda del plan original

Fase 5 (fricción de uso diario) y Fase 6 (manual con capturas). Con esto se
cierran las 4 fases "de código" del plan de la auditoría (sección 38-42) — las
dos que faltan son de un carácter distinto (revisión de uso real / documentación
visual), no refactors puntuales.

---

## 43. Actualización 17/09 (cont.) — Fase 5: recorrida de fricción de uso diario

A diferencia de las Fases 2-4 (implementar algo puntual ya definido), la Fase 5
es "buscar fricción" — así que en vez de partir de una lista de cambios, se
recorrieron en vivo los flujos que pedía el brief original (crear, abrir,
modificar, comentar, subir archivo, cambiar estado, finalizar) con el bypass de
auth local, tipeando/clickeando de verdad en vez de solo leer código.

### Recorrido y hallazgos

- **Crear (Carga rápida)**: sin fricción — cliente, nombre, tipo, fecha (con
  chips rápidos que autosugieren prioridad), descripción, producto con
  material/medidas, y la barra inferior pasa de "Cargá al menos una medida..."
  a "Listo para crear" en vivo. Confirma lo que ya decía la auditoría de Fase 1.
- **Abrir / Modificar / Cambiar estado**: sin fricción nueva — tabs, selects de
  estado/prioridad/muestra, todo responde bien. Ya se había probado a fondo en
  Fase 3.
- **Subir archivo / Finalizar**: dropzone de Archivos y el botón "Mensaje para
  el cliente" (con "Abrir en WhatsApp"/"Copiar mensaje") probados en vivo, sin
  fricción — el mensaje generado se lee natural y completo.
- **Comentar — fricción real encontrada y corregida**: los chips
  `@Coordinación`/`@Diseño`/`@Producción`/`@Instalación` del panel de
  comentarios (ya sospechados en la auditoría de Fase 1 como "posiblemente
  decorativos") **se confirmaron rotos en vivo**: clickear "@Diseño" inserta el
  texto pero `submit()` solo generaba una mención real (y por lo tanto una
  notificación — `addComment` llama a `insertNotifications(mentions, ...)`) si
  el texto matcheaba el nombre de pila de un usuario real. Clickear cualquiera
  de esos 4 chips **nunca avisaba a nadie**, aunque visualmente parecía una
  mención funcional. Confirmado probando el clic real y viendo que `mentions`
  quedaba vacío.

### Fix aplicado — menciones por sector ahora son reales

`CommentsPanel.tsx` — en vez de borrar los chips (opción más simple pero perdía
una funcionalidad con valor real: avisar de una sola vez a todo un equipo), se
los conectó a `role` en vez de a nombres de usuario individuales:
`@Coordinación` → todos los usuarios `active` con `role: 'coordinador'`,
`@Diseño` → `role: 'diseno'`, `@Producción` → `role: 'produccion'`,
`@Instalación` → `role: 'instalacion'`. Se usó `role` (enum fijo) en vez de
`sector` (texto libre editable por admin, ver sección 20) porque un match por
substring contra texto libre es frágil — podía dar cero resultados según cómo
esté escrito el sector de cada uno. `submit()` ahora combina menciones por
nombre (ya existían) + menciones por rol (nuevas) en un solo array sin
duplicados. Verificado en vivo con un segundo usuario de prueba (`role:
'diseno'`): clickear "@Diseño" + enviar corrió `submit()` completo sin errores
de lógica (el único error en consola fue el esperado por el ID falso del
devpreview contra Supabase real, no un fallo del fix).

### Hallazgo menor, no corregido

El checkbox "procesado" de `ProductsView` (pestaña Detalle) apareció en el
árbol de accesibilidad como `checkbox "on"` en vez de describir el producto —
pero no se pudo confirmar si es un problema real (podría ser simplemente el
`value="on"` por default de cualquier `<input type="checkbox">` sin `value`
explícito, que algunos serializadores de accesibilidad muestran en vez del
nombre accesible real derivado del `<label>` que lo envuelve). No se tocó por
no tener certeza de que sea un bug — si en algún momento se confirma con un
lector de pantalla real, agregar un `aria-label` explícito ahí es un fix de
una línea.

### Lo que NO se encontró (y por qué no se buscó más)

El resto de los flujos (Kanban drag&drop, Trabajos, Histórico, Dashboard) ya se
habían probado a fondo en las Fases 2-4 de esta misma sesión — no se repitió
esa recorrida para no duplicar trabajo. La deuda ya conocida y documentada
(subida real de archivos a Storage, checklist de control de calidad no
adaptado por tipo de trabajo, Manual sin contenido) **no es fricción nueva**,
son decisiones ya tomadas de alcance — no se tocaron acá.

### Verificación

`npm run build`/`npm run lint` limpios. Bypass de auth local revertido con una
Edit puntual (deshaciendo solo el bloque agregado) en vez de `git checkout --`
sobre todo el archivo — la lección de la Fase 4 (§42) sobre no perder cambios
reales de la misma sesión al revertir se aplicó bien esta vez; `git diff
src/App.tsx` dio vacío antes de commitear.

### Estado de git

Commiteado y pusheado a `origin/main`.

### Lo que queda del plan original

Solo Fase 6 (manual con capturas reales) — que además depende de que Gonzalo
mire la app ya deployada primero, como se le sugirió al cerrar la Fase 4.

---

## 44. Actualización 17/09 (cont.) — el dropdown de estado pasa a tener exactamente las 7 opciones del Kanban

Gonzalo volvió con algo concreto: "sigue estando mal, en dashboard cuando abro
el dropdown de una ficha me figuran muchísimas opciones, quiero las mismas 7
columnas que tengo en el kanban". Esto es justo lo que la Fase 3 (§41) había
dejado señalado pero sin resolver del todo — en ese momento se explicó que el
dropdown ya usaba la misma función en las 3 vistas (no había 3 listas
distintas), pero para admin/coordinador esa única función seguía ofreciendo 11
valores (`ADMIN_STATUSES`) contra las 7 columnas del Kanban. Ahora si se
resolvió a fondo.

### Qué cambió

`lib/statusChange.ts` — se borraron `SELECTABLE_STATUSES` y `ADMIN_STATUSES`
(las dos listas por rol) y se reemplazaron por una sola:
```ts
const PRIMARY_STATUS_OPTIONS: JobStatus[] = KANBAN_COLUMNS.map((c) => c.statuses[0]);
```
Es decir, el dropdown **deja de tener su propia lista hardcodeada** — toma el
primer estado de cada columna directo de `KANBAN_COLUMNS` (`data/catalog.ts`),
así que si el día de mañana cambian las columnas del Kanban, este select
cambia solo, sin volver a desalinearse. Resultado: **7 opciones, siempre
iguales, para todos los roles** — Pendiente, En diseño, En producción, En
control de calidad, Listo para entregar, En instalación, Entregado. La
distinción por rol se sacó del todo porque ya no hacía falta: el Kanban
tampoco restringe por rol quién puede arrastrar una tarjeta a qué columna
(cualquiera que vea el trabajo puede), así que no había motivo real para que
el select sí discriminara.

`statusOptionsFor(job)` ya no recibe `role` — se actualizaron los 3 call sites
(`DashboardJobCard.tsx`, `JobsTable.tsx`, `JobDetailPage.tsx`).

### Los 2 estados que quedaron afuera — con su propio camino, no perdidos

1. **`FALTA_INFORMACION`** — ya no se puede poner a mano desde el select (mismo
   criterio que el propio Kanban, que tampoco tiene columna propia para este
   estado — lo agrupa dentro de "Pendiente"). Se sigue alcanzando solo al crear
   un trabajo con instalación sin dirección. Si un trabajo YA está en ese
   estado, sigue apareciendo como opción extra al principio del select (mismo
   mecanismo de siempre) para poder sacarlo eligiendo cualquiera de las 7.
   **Ojo:** antes cualquier rol (no solo admin) podía poner un trabajo en
   "Falta información" a mano desde el select — con este cambio ya no. Si
   Gonzalo lo necesita de vuelta como acción explícita (por ejemplo, un
   diseñador se da cuenta que falta info del cliente y quiere marcarlo), avisar
   y se le agrega un botón dedicado, mismo patrón que "Bloquear"/"Cancelar".
2. **`CANCELADO`** — pasa a tener su propio botón **"Cancelar trabajo"** en la
   cabecera de la ficha (al lado de "Bloquear trabajo"), visible solo para
   admin/coordinador (`canEditAnyJob`) y solo si el trabajo no está ya
   Cancelado/Entregado. Con `ConfirmDialog` mostrando el nombre y N° exactos
   antes de confirmar (mismo patrón que eliminar). Revertir un cancelado sigue
   siendo por el select normal (aparece como opción extra mientras dure).
   **Nota de UX corregida en la propia verificación**: el `ConfirmDialog` por
   default usa "Cancelar" como texto del botón de "volver atrás" — con
   `confirmLabel="Cancelar trabajo"` al lado, quedaban dos botones que
   arrancaban con la misma palabra ("Cancelar" / "Cancelar trabajo"), confuso.
   Se le pasó `cancelLabel="Volver"` explícito para desambiguar.

### `tryChangeJobStatus` — normalización de "Listo para entregar"

Como el select ahora ofrece un solo "Listo para entregar" (ya no hay una
opción separada para "Listo para instalación"), `tryChangeJobStatus`
(`lib/statusChange.ts`) normaliza el destino real al principio: si
`job.requiresInstallation` es `true`, el estado que se aplica de verdad es
`LISTO_PARA_INSTALACION`, no `LISTO_PARA_ENTREGA` — mismo criterio que ya
usaba el drag&drop del Kanban al soltar en esa columna
(`job.requiresInstallation && targetCol.key === 'listo' ? ...`). Como esta
normalización vive en el único punto de entrada que usan las 3 vistas, no hizo
falta duplicarla en cada componente.

### Verificación

Probado en vivo con el bypass de auth local, 4 casos: un trabajo en
`EN_INSTALACION` con `requiresInstallation=true` (dropdown mostró exactamente
las 7 opciones, con "En instalación" ya seleccionado), uno en
`FALTA_INFORMACION` (apareció como 8va opción extra al principio, se puede
sacar eligiendo cualquiera de las 7), uno normal en `EN_DISENO` (7 opciones +
botones "Bloquear trabajo" y "Cancelar trabajo" ambos visibles, confirmé el
texto del diálogo de cancelar), y uno ya `CANCELADO` (apareció como opción
extra para poder revertirlo, y el botón "Cancelar trabajo" correctamente NO
se mostró). `npm run build`/`npm run lint` limpios. Bypass revertido con Edit
puntual, `git diff src/App.tsx` vacío antes de commitear.

### Estado de git

Commiteado y pusheado a `origin/main`.

---

## 45. Actualización 20/09 — 5 pedidos puntuales: contador de carga (bug real), notificación de asignación, menciones @ con autocompletado, hora de creación, "Tercerizado" más claro

Ronda de correcciones puntuales sobre la app ya funcionando — sin auditoría
nueva, sin tocar arquitectura, sobre lo que ya existe. Orden pedido por
Gonzalo: contador → notificación de asignación → menciones → hora de creación
→ "Tercerizado". Documento en ese orden.

### 1. Bug del contador de "Carga de diseño" — encontrado y corregido

**Síntoma reportado:** se le asignaron ~3 trabajos a Gastón y el contador
seguía en 0.

**Causa real** (`Dashboard/DesignLoadWidget.tsx`): el contador solo contaba
trabajos con `status === 'EN_DISENO' || status === 'DISENO_LISTO'`. Un
trabajo recién asignado nace en `PENDIENTE` (decisión 5, sección 4) y no hay
ninguna forma de pasarlo a "En diseño" salvo moverlo a mano en el Kanban o el
select de estado — así que "se lo asigné hoy" y "está en diseño" casi nunca
coinciden el mismo día. **No era un bug de ID, caché ni refresh** — se revisó
específicamente cada una de esas hipótesis (`responsibleUserId` viene de la
misma tabla `profiles` que `users`, sin desdoblamiento posible; el widget lee
`jobs` en vivo del store, sin caché propia) y todas estaban bien. El filtro de
estado era, literalmente, demasiado angosto para lo que el widget necesita
responder: "¿cuánto tiene encima cada uno ahora mismo?".

**Fix:** se amplía el conteo a cualquier trabajo **activo** (`isActive()` de
`lib/selectors.ts` — ya existía, todo menos Entregado/Cancelado, mismo
criterio que ya usa el resto del Dashboard) del que la persona sea
responsable, sin importar la etapa exacta. Cubre los 7 criterios de aceptación
que pidió Gonzalo (0→0, 1→1, 3→3, nueva asignación actualiza, cambio de
asignación actualiza a ambos, trabajo que deja de contar por estado se
actualiza, sin diferencia entre lo asignado y lo mostrado) porque ahora es un
cálculo directo sobre `jobs` en cada render, sin estado intermedio que se
pueda desincronizar. El título del widget ("Carga de diseño") no se tocó —
hoy Gastón y Gonzalo son los únicos productores y solo hacen diseño, así que
"todo lo activo que tiene asignado" y "carga de diseño" siguen siendo lo
mismo en la práctica.

No hay tests automatizados en el proyecto (confirmado en sección 2) — no se
agregó suite nueva, se verificó en vivo con el bypass de auth local (ver
"Verificación" más abajo).

### 2. Notificación al asignar un trabajo

**Hallazgo antes de tocar nada:** el store ya tenía una acción `assignJob`
completa (con su propia notificación "Te asignaron a...") pero **sin ningún
call site** — nada la llama desde la UI, porque no existe ninguna pantalla
para reasignar un trabajo después de creado (`responsibleUserId` se fija una
sola vez, en Carga rápida, y "Responsable interno" en la ficha es un `Field`
de solo lectura). Es decir: **crear el trabajo es, hoy, el único evento real
de asignación** que existe en la app.

`createJob` ya notificaba al responsable en ese momento, pero con el texto
genérico "Nueva ficha: ...", que no comunica que a esa persona puntual le
tocó ser responsable (se lee más a "algo nuevo entró" que a "te asignaron
esto"). Se separó en dos notificaciones distintas, mismo mecanismo de
siempre (`insertNotifications`, sin sistema paralelo):
- **Responsable + "Asignar también a"** → `Te asignaron el trabajo "X".`
  (mismo texto exacto que ya usaba `assignJob`, por consistencia).
- **Admins que no son responsables ni asignados** → se quedan con `Nueva
  ficha: "X".` (les interesa que algo entró, pero no es trabajo suyo).

Sin duplicados: el segundo grupo excluye explícitamente a cualquiera que ya
esté en el primero. El click-to-navegar de la campana (Header.tsx) ya
funcionaba de antes — no hizo falta tocarlo.

### 3. Menciones @ con autocompletado — nuevo

`JobDetail/CommentsPanel.tsx` reescrito para agregar el dropdown que pedía
Gonzalo. Comportamiento: tipear `@` + letras muestra hasta 6 usuarios activos
cuyo nombre matchea (sin distinguir mayúsculas/tildes), con flechas ↑/↓ para
moverse, Enter/Tab/click para elegir, Escape para cerrar. Al elegir, inserta
`@Nombre ` en el texto y sigue escribiendo desde ahí.

**La mención queda atada al ID real del usuario**, no al texto — se guarda en
un mapa `id → nombre insertado` (`mentionedUsers`) en el momento de elegir del
dropdown, no reconstruyendo desde el texto final. En `submit()`, esa mención
solo cuenta si el `@Nombre` sigue de verdad presente en el texto (por si se
borra a mano después de insertarla) — así nunca se notifica a alguien que ya
no aparece mencionado. Si se mencionan varios, cada uno recibe su propia
notificación; nunca se notifica a uno mismo (`filter(id => id !== user.id)`
antes de mandar, más un filtro espejo agregado en `addComment` del store como
defensa extra, mismo criterio que ya usa el resto de las acciones).

**De paso, un bug real que tenía el código anterior** (de la Fase 5, §43): la
detección de menciones por nombre buscaba `text.includes('@' + primerNombre)`
sobre CUALQUIER usuario — si dos personas comparten nombre de pila, o si
alguien tipeaba "@algo" que por casualidad coincidía con un nombre sin haber
elegido a esa persona del dropdown, se generaba una mención (y notificación)
no intencional, sin ningún vínculo real de ID. Reemplazado por completo por
el mecanismo de arriba.

Se mantienen los chips `@Coordinación`/`@Diseño`/`@Producción`/`@Instalación`
(rol, Fase 5) sin cambios — combinan con las menciones individuales en el
mismo array final, sin duplicados.

`addComment` (store) ahora arma el texto de la notificación con `jobLabel()`
("Te mencionaron en un comentario — {trabajo}.") en vez del genérico de
antes, mismo estilo que el resto de notificaciones del store.

### 4. Hora de creación en la ficha del Dashboard

`Dashboard/DashboardJobCard.tsx` — debajo de la línea "Asignado {fecha} ·
Entrega {fecha} [countdown]" se agregó una segunda línea, más chica
(`text-[11px]`, gris secundario): "Creado {fecha}, {hora}" (`fmtShort`, ya
usado en otros lados de la app para fecha+hora compacta). Mismo timestamp que
"Asignado" de arriba (`job.createdAt` — hoy no existe un timestamp de
asignación separado, se fija en el mismo momento que se crea el trabajo), la
diferencia es que esta línea suma la hora exacta. No compite con nombre/
descripción del trabajo porque vive en el bloque de metadata de la derecha,
no en el bloque de contenido principal.

### 5. "Tercerizado" más claro en Carga rápida / Detalle

`Common/ProductsEditor.tsx` — el pill único "Tercerizada" (que solo cambiaba
de color al activarse, sin texto propio para el estado "no") se reemplazó por
un segmentado de dos opciones siempre visibles: **"Hecho acá" | "Tercerizado"**
(con el ícono de camión en la segunda). Mismo lugar exacto en la cabecera de
cada producto, mismo tamaño — no se agregó ningún paso ni pantalla nueva. La
diferencia es que ahora el estado activo nunca depende solo del color/relleno:
siempre hay texto explícito de las dos opciones, así que no se puede confundir
con una etiqueta de categoría ("esta pantalla es para tercerizados") — queda
claro que es una característica de ESE producto puntual, con un "no" real
disponible. La vista de solo lectura (`ProductsView`, minuta técnica y
pestaña Detalle en modo vista) no se tocó — ahí seguir mostrando el pill
"Tercerizada" solo cuando aplica es el patrón correcto (mismo criterio que
`BlockedBadge`/`SampleReviewBadge`: positivo-únicamente).

### Verificación

`npm run build`/`npm run lint` limpios en cada paso. Probado en vivo con el
bypass de auth local (2 productores con distinta carga real — uno con 3
trabajos activos en 3 estados distintos, PENDIENTE/EN_DISENO/EN_PRODUCCION—
más 2 usuarios con nombres parecidos "Alejandra Ruiz"/"Alejandro Paz" para
probar el filtro del autocompletado):
- Carga de diseño mostró correctamente 3 para el productor con los 3 trabajos
  activos (antes del fix hubiera mostrado 1).
- La ficha del Dashboard mostró "Creado 18 sep, 11:12" debajo de "Asignado...".
- Tipear "@ale" en Comentarios mostró el dropdown con "Alejandra Ruiz" y
  "Alejandro Paz"; clickear insertó "@Alejandra " y el cursor quedó
  correctamente después, se pudo seguir escribiendo sin romper nada; el envío
  corrió `submit()` completo sin errores de lógica (el único error de
  consola fue el esperado por IDs falsos contra Supabase real).
- El segmentado "Hecho acá"/"Tercerizado" en Carga rápida cambió de estado
  correctamente al clickear, con el color/fondo del producto acompañando.

Bypass de auth local revertido con Edit puntual (no `git checkout --`, lección
de la Fase 4) — `git diff src/App.tsx` vacío antes de commitear.

### Pendiente / a revisar

- **Punto 1 (notificación de asignación):** cubre el único evento de
  asignación que existe hoy (creación). Si en algún momento Gonzalo pide
  poder **reasignar** un trabajo después de creado (cambiar "Responsable
  interno" desde la ficha), la acción `assignJob` del store ya está lista
  para eso — solo faltaría construir la UI y llamarla; ahí la notificación
  "Te asignaron..." se dispararía en ese momento también, sin cambios
  adicionales.
- **Punto 3 (menciones):** el dropdown se ancla siempre al mismo lugar (arriba
  del textarea), no sigue la posición exacta del cursor dentro del texto —
  simplificación deliberada (seguir el caret real en un `<textarea>` simple
  necesitaría medir texto con canvas/librería aparte) que no debería notarse
  en el uso normal (comentarios cortos), pero si Gonzalo lo ve raro con
  comentarios largos, avisar.
- Nada del resto del tintero (subida real de archivos, Manual, mobile, AFIP,
  etc.) se tocó en esta ronda — sigue todo como estaba.

### Estado de git

Commiteado y pusheado a `origin/main`.

---

## 46. Actualización 20/09 (cont.) — se reproduce de nuevo el bloqueo del navegador integrado contra `bonta-app.vercel.app`

Gonzalo pidió probar el sitio ya deployado. **Se reprodujo el mismo problema
ya documentado en la sección 30, punto 6** — en una sesión completamente
nueva, meses después, lo que confirma que no fue un glitch puntual: `navigate`
carga `https://bonta-app.vercel.app` sin problema, pero **todas** las
herramientas de lectura probadas (`get_page_text`, `computer{screenshot}`,
`read_console_messages`, `read_network_requests`) devuelven el mismo error,
"Policy check temporarily unavailable; retry", específicamente contra ese
origen — las mismas herramientas funcionan sin problema contra
`localhost:5173` en la misma sesión (confirmado varias veces en las rondas
anteriores). No se insistió en loop (ya estaba anotado que no vale la pena).

**No se pudo verificar el deploy real esta ronda.** Lo que sí se pudo
verificar (y se verificó, ronda a ronda, con el bypass de auth local en
`localhost:5173`) es que el código compila limpio y se comporta como se
espera en cada feature — pero eso prueba el código, no el build real ya
publicado en Vercel. Si una sesión futura se encuentra con el mismo bloqueo,
no perder tiempo reintentando — pedirle a Gonzalo que:
1. revise si hay algún permiso pendiente de aprobar para ese origen en el
   panel del navegador integrado, o
2. mire él mismo `bonta-app.vercel.app` y confirme visualmente.

Sin cambios de código en esta ronda.

---

## 47. Actualización 20/09 (cont.) — "no me salta notificación": descartado como bug, era auto-notificación (por diseño)

Gonzalo probó las notificaciones del punto 1/3 de la sección 45 (asignación y
menciones) y reportó que no le saltaba ninguna: creó una ficha asignándosela a
sí mismo y no vio aviso; entró a otra ficha, se mencionó a sí mismo en un
comentario y tampoco. Se revisó a fondo antes de tocar código.

**Diagnóstico (sin cambios de código, confirmado por revisión + SQL real):**
ambas pruebas fueron auto-referenciales, y la app **filtra la auto-notificación
a propósito** en los dos casos, exactamente como pedía el brief original (punto
2/3, 20/09: "no autonotificación"):
- `createJob` arma destinatarios con `.filter((id) => id && id !== actorId)`
  antes de notificar "Te asignaron..." (`store/useStore.ts` — ver §45.2). Si el
  responsable sos vos mismo, la lista queda vacía.
- Las menciones se filtran dos veces: en `CommentsPanel.tsx` (`.filter((id) =>
  id !== user.id)`, construcción de `mentions`) y de nuevo en `addComment` del
  store (mismo filtro, defensa extra) — ver §45.3.

Se sospechó también un drift de la policy RLS de `notifications` (ya pasó dos
veces antes, CLAUDE.md §12.8/§22/§27) como causa alternativa — **descartado**:
Gonzalo corrió `select policyname, cmd, qual, with_check from pg_policies where
tablename = 'notifications';` y la policy real coincide exactamente con
`002_policies.sql` (`notifications_insert` con `with_check: true`,
`notifications_select`/`notifications_update` filtradas por
`user_id = auth.uid()`). **No hay ningún problema de RLS vigente en esta
tabla.**

**Conclusión: no es un bug, es la regla "no auto-notificación" funcionando
como se pidió.** Con una sola cuenta logueada es imposible generar una prueba
que no sea auto-referencial — para verificar de verdad el sistema hace falta
un segundo usuario real (asignarle una ficha a Gastón/Pancho/etc. y que
revise su propia campana, o mencionar a otra persona real en un comentario y
que confirme si le llegó). Sin cambios de código en esta ronda — no
correspondía tocar algo que ya funciona como se especificó.

---

## 48. Actualización 20/09 (cont.) — "Muestra al cliente": nuevo estado intermedio "En producción (OT emitida)"

Gonzalo explicó una dinámica real que los 3 estados existentes (`none`/
`awaiting`/`approved`, sección 23) no cubrían: antes de poder avisarle al
cliente que la muestra está lista para que venga a verla (`awaiting`), primero
se emite una OT para FABRICAR esa muestra y hay que esperar a que esté hecha.
Ese tramo — "ya la mandé a hacer, todavía no le avisé a nadie" — no tenía
representación; el flujo real es:

**Sin muestra → Muestra en producción (OT emitida) → Enviada, falta OK →
Aprobada por el cliente**

### Cambios de código

1. **`SampleReview`** (`types/index.ts`) pasa de 3 a 4 valores:
   `'none' | 'in_production' | 'awaiting' | 'approved'`. Comentario del tipo
   actualizado para explicar el matiz entre `in_production` (la muestra se está
   haciendo, el cliente todavía no sabe nada) y `awaiting` (la muestra ya existe,
   se le avisó al cliente, falta que venga y la apruebe) — son dos momentos
   distintos, no lo mismo con otro nombre.
2. **`SAMPLE_REVIEW_META`** (`data/catalog.ts`) — nueva entrada
   `in_production: { option: 'En producción (OT emitida)', chip: 'Muestra en
   producción' }`, insertada entre `none` y `awaiting` (el `<select>` de la
   ficha itera `Object.keys(SAMPLE_REVIEW_META)`, así que el orden de este
   objeto es el orden real de las opciones — quedó en el orden del flujo).
3. **`SampleReviewBadge`** (`Common/Badges.tsx`) — el pill ahora usa 3 tonos en
   vez de 2: `info` (azul, "en curso" — mismo lenguaje que el resto de la app,
   decisión 9 de la sección 4) para `in_production`, `norm` (ámbar) para
   `awaiting` sin cambios, `plan` (verde) para `approved` sin cambios.
4. **Tag del Kanban** (`KanbanPage.tsx`, `CardBody`) — antes solo aparecía en
   `awaiting`; ahora aparece también en `in_production`, con el mismo texto
   corto "muestra" pero coloreado distinto (azul vs. ámbar) para que se pueda
   distinguir de un vistazo en qué momento está sin tener que abrir la ficha.
5. **`setSampleReview`** (`store/useStore.ts`) — el mapa de texto para el log
   de actividad y la notificación al responsable/asignados suma la entrada de
   `in_production` ("muestra en producción (OT emitida)").
6. **Migración `020_job_sample_review_in_production.sql`** — el `check` de
   `jobs.sample_review` solo permitía `'none'/'awaiting'/'approved'`; se
   recrea el constraint agregando `'in_production'`. **Hay que correrla en
   Supabase:**
   ```sql
   alter table jobs drop constraint if exists jobs_sample_review_check;
   alter table jobs add constraint jobs_sample_review_check
     check (sample_review in ('none', 'in_production', 'awaiting', 'approved'));
   ```
   Verificación después de correrla: `select sample_review, count(*) from jobs
   group by sample_review;` no debería tirar error, y ya se puede probar
   marcar una ficha real en "En producción (OT emitida)" sin que rechace el
   update. También sumada a `001_schema.sql` para instalaciones nuevas.
   **Confirmado corrida por Gonzalo (20/09, mismo día).**

### Lo que no se tocó

`JobDetailPage.tsx` no necesitó ningún cambio propio — el `<select>` ya
generaba sus opciones iterando `SAMPLE_REVIEW_META`, así que el estado nuevo
apareció solo al agregarlo al catálogo. Tampoco se tocó Carga rápida ni la
hoja de exportación al cliente (mismo criterio ya documentado en la sección 23:
la muestra es un dato operativo interno que surge con el trabajo ya en curso,
no al darlo de alta).

### Verificación

`npm run build`/`npm run lint` limpios. Probado en vivo con el bypass de auth
local (4 fichas fake, una por cada valor de `sampleReview`, revertido con una
Edit puntual sobre `src/App.tsx` — confirmado `git diff src/App.tsx` vacío
antes de commitear): en la ficha, el `<select>` mostró las 4 opciones en el
orden correcto con "En producción (OT emitida)" preseleccionado en la ficha
correspondiente; el badge de la cabecera mostró "Muestra en producción ·
20 sep 2026"; en el Dashboard las 4 fichas mostraron "Sin muestra" (sin pill),
"Muestra en producción", "Muestra: falta OK" y "Muestra OK" respectivamente;
en el Kanban las tarjetas 2 y 3 (`in_production`/`awaiting`) mostraron el tag
"muestra" en azul y ámbar respectivamente, tal como se esperaba.

### Estado de git

Commiteado y pusheado a `origin/main`.
