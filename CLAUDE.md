# Estudio Bonta — Sistema de producción — Contexto para retomar en Claude Code

Este archivo es un handoff completo para que una sesión nueva de Claude Code, sin
memoria de las sesiones anteriores, pueda seguir trabajando en este proyecto sin que
Gonzalo tenga que reexplicar nada. Se escribió originalmente el 25/08/2026 y se fue
actualizando ronda a ronda desde entonces — la sección 1 a 8 son la base original
(puede tener frases con fecha vieja, ignorarlas) y las secciones numeradas al final
(9 en adelante, cada una fechada) son el historial de cambios en orden cronológico;
**la última —hoy, la de fecha más reciente— es la que manda sobre cualquier cosa que
la contradiga más arriba**. Última actualización: 08/09/2026 (sección 23).

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
