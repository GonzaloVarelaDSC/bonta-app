# Auditoría UX/UI, accesibilidad y código — Estudio Bonta

**Fecha:** 15/09/2026
**Fuentes:** auditoría de diseño (skill `design-critique`) y de accesibilidad (skill
`accessibility-review`) sobre 7+1 capturas reales de la app (`/audit-screenshots/`,
tomadas con Playwright), más una revisión de código sobre `src/` buscando estados de
carga/error, spacing/tipografía hardcodeados y componentes duplicados.

**Criterio de orden:** severidad real de uso, no el orden en que salió cada hallazgo
en su informe de origen. Un fallo silencioso en una acción que cambia datos (estado,
prioridad, usuarios) pesa más que una inconsistencia visual, aunque los tres informes
originales los hayan marcado igual ("Moderado"). Los hallazgos relacionados entre sí
están agrupados en un solo ítem con todas sus ubicaciones, no repetidos uno por uno.

---

## 🔴 Crítico

### 1. Cambiar el estado o la prioridad de un trabajo puede fallar en silencio total

**Estado: resuelto (temporal, con `alert()` nativo — pendiente reemplazar por un
patrón de notificación consistente con el resto de la UI, ver ítem de `confirm()`
nativo ya señalado como corte de alcance).**

**Dónde:** el flujo más usado del día a día — Kanban, Tabla de trabajos, Dashboard y
la ficha completa.

**Qué está mal:** el único punto de cambio de estado (`tryChangeJobStatus`,
`src/lib/statusChange.ts:85`) llama a `setStatus(...)` sin `await` ni `.catch()`.
Como es la función que usan los 4 lugares donde se cambia el estado de un trabajo —
`src/components/Kanban/KanbanPage.tsx:282`, `src/components/Jobs/JobsTable.tsx:123`,
`src/components/Dashboard/DashboardJobCard.tsx:113` y
`src/components/JobDetail/JobDetailPage.tsx:154` — el hueco se repite en los 4. Lo
mismo pasa con los selects de prioridad, muestra y fecha comprometida, cada uno
llamando a su acción del store directo desde el `onChange`, sin manejo de error:
- `setPriority` — `src/components/JobDetail/JobDetailPage.tsx:146` y
  `src/components/Dashboard/DashboardJobCard.tsx:108`
- `setSampleReview` — `src/components/JobDetail/JobDetailPage.tsx:163`
- `updateCommittedDate` — `src/components/JobDetail/JobDetailPage.tsx:223`
- `undo()` del Kanban (revertir un drag) — `src/components/Kanban/KanbanPage.tsx:292`

`setStatus` en el store (`src/store/useStore.ts`) sí es optimista con rollback si
Supabase rechaza el cambio, pero el rollback es silencioso: la persona ve que el
estado "vuelve solo" al valor anterior sin ninguna explicación de por qué.
`setSampleReview` (líneas 379-393) y `updateCommittedDate` (líneas 398-408) tienen
el mismo patrón optimista-con-rollback que `setStatus` — confirmado, no requieren
nota aparte. **`setPriority` (líneas 366-374) es un caso distinto: deuda conocida.**
No es optimista — no toca el store hasta que Supabase confirma el éxito (recién ahí
`refreshJob()` trae el valor nuevo) — así que no hay un valor "de mentira" para
revertir, pero tampoco hay feedback visual inmediato mientras la operación está en
curso, ni el `<select>` queda deshabilitado mientras tanto: si la persona vuelve a
tocarlo antes de que la primera llamada termine, puede haber una carrera entre dos
`setPriority` en simultáneo sin ningún orden garantizado.

**Por qué importa para Bonta:** este proyecto ya tuvo, documentado en su propio
historial (CLAUDE.md), al menos 3 incidentes reales de este tipo exacto — la
migración de `contact_phone` sin correr, `ready_at` sin correr, la policy de
`notifications` desincronizada — todos con el mismo síntoma: una acción que
"debería" funcionar falla contra la base real sin que nadie lo note hasta que
alguien pregunta por qué su trabajo no se movió. Con este hueco, si vuelve a pasar
(falta correr una migración, una policy de RLS queda mal — algo que ya pasó varias
veces y no hay migration runner que lo prevenga), Gastón o Gonzalo pueden arrastrar
un trabajo a "Listo para entregar" en el Kanban, ver que "funcionó" visualmente por
un instante, y que se revierta solo sin ningún mensaje — mientras el cliente sigue
esperando porque el estado real en la base nunca cambió.

**Fix concreto:** el patrón ya existe y funciona en 3 lugares del propio código —
`QuickJobPage.submit()` (`src/components/QuickJob/QuickJobPage.tsx:167-194`),
`ConfigPage`'s `EditableChip`/`AddChip` (`src/components/Common/ConfigPage.tsx:73-84`
y `:119-131`), y `JobsTable.handleDelete` (`src/components/Jobs/JobsTable.tsx:67-74`).
Los tres hacen `try { await accion(...) } catch (err) { alert(friendlyError(err)) }`.
Aplicar exactamente ese mismo patrón a los 6 puntos de arriba — no hace falta
inventar nada nuevo, `friendlyError()` (`src/lib/errors.ts`) ya está importado en la
mitad de estos archivos para otro uso.

---

### 2. Activar/desactivar un usuario puede fallar sin que nadie se entere

**Estado: resuelto (temporal, con `alert()` nativo — pendiente reemplazar por un
patrón de notificación consistente con el resto de la UI, ver ítem de `confirm()`
nativo ya señalado como corte de alcance). Además se corrigió `setUserActive` en
`src/store/useStore.ts:562-565`, que no revisaba el `error` de Supabase y aplicaba
el cambio local igual aunque el update real hubiera fallado — sin ese fix, el
`try/catch` del componente nunca se hubiera disparado.**

**Dónde:** `src/components/Users/UsersPage.tsx:24` — el checkbox "Activo" de cada
fila, `onChange={(e) => setUserActive(u.id, e.target.checked)}`.

**Qué está mal:** sin `try/catch`, sin estado deshabilitado mientras guarda, sin
ningún feedback si la actualización falla. Es el caso más desprotegido de toda la
app — ni siquiera tiene el respaldo optimista-con-rollback que sí tiene `setStatus`.

**Por qué importa para Bonta:** esto es control de acceso, no solo un dato de
trabajo. Si Gonzalo destilda "Activo" para alguien que dejó el estudio y el update
falla contra Supabase, la UI puede seguir mostrando el checkbox destildado (estado
local optimista de React) mientras esa persona **sigue teniendo acceso real** a la
cuenta — exactamente el tipo de brecha silenciosa que un fallo de RLS no
diagnosticado puede producir sin que Gonzalo tenga forma de notarlo desde la
pantalla de Usuarios.

**Fix concreto:** agregar un estado `savingId` (qué fila está guardando) para
deshabilitar el checkbox mientras corre la actualización, envolver la llamada en
`try/catch`, y en el catch **revertir el checkbox visualmente** además de mostrar
`alert(friendlyError(err))` — a diferencia de los casos del ítem 1, acá no hay
ningún estado optimista en el store que haga el rollback solo, así que el
componente lo tiene que manejar él mismo.

---

## 🟠 Alto

### 3. Resto de acciones de la ficha de trabajo sin manejo de error

**Estado: resuelto — con un hallazgo adicional al aplicar el fix.** Al revisar las
7 funciones del store detrás de estas acciones (bloquear, desbloquear, control de
calidad, archivos ×3, instalación completada) se encontró que **6 de las 7 no
chequeaban el `error` de Supabase en su escritura principal** — no era solo falta
de `try/catch` en el componente, sino que la propia función del store nunca se
enteraba del fallo (`supabase-js` no lanza excepción por sí solo; si no se lee
`error` explícitamente, el fallo queda invisible). Envolver el call site en
`try/catch` sin tocar el store no hubiera alcanzado: el `alert()` casi nunca se
hubiera disparado, porque `insertActivity()` (que sí lanza) suele tener éxito
igual aunque la escritura anterior haya fallado — el log de actividad diría
"Bloqueó el trabajo" o "Eliminó archivo.pdf" aunque esa escritura puntual nunca
haya llegado a la base.

**Fix aplicado — dos capas:**
1. **Store (`src/store/useStore.ts`)** — se agregó `if (error) throw error` (o el
   equivalente con la variable destructurada) a cada escritura de Supabase que lo
   omitía, en `blockJob`, `unblockJob`, `toggleQualityCheck`, `addFileVersion`
   (el insert a `file_versions`, que es el que faltaba — el insert a `job_files`
   ya estaba protegido), `approveFileVersion` (las 2 actualizaciones a
   `file_versions`) y `completeInstallation` (`installations` + el `jobs.update`
   de estado). Los `jobs.update({ last_activity_at })` que son solo un "touch" de
   timestamp (no el cambio de estado real) se dejaron sin chequear a propósito —
   mismo criterio que ya usa el resto del store en acciones no relacionadas
   (`assignJob`, `setStageStatus`, `addComment`), es un efecto secundario menor,
   no el dato que le importa a quien hizo la acción.
   - `toggleProductChecked` (la única de las 7 que ya chequeaba `error`) no
     necesitó cambios en el store.
2. **Componente (`JobDetailPage.tsx`)** — mismo patrón que el crítico #1:
   `try { await accion(...) } catch (err) { alert(friendlyError(err)) }` en los 8
   call sites (bloquear, desbloquear, control de calidad, toggle de producto,
   subir/aprobar/eliminar archivo, instalación completada), más el `catch` que
   faltaba en `ProductsTab.save()` (tenía `try/finally` sin `catch` — el error de
   `updateJobSpecs`, que sí estaba bien chequeado en el store, se perdía como
   unhandled rejection sin avisar).

**Ninguna de las 7 tiene rollback optimista** (a diferencia de `setStatus` o
`toggleProductChecked`, que si Supabase rechaza el cambio revierten el store a la
mano). Estas 7 no tocan el store hasta que `refreshJob()` trae el valor real al
final — por eso un fallo a mitad de camino (ej. `block_records` insertado pero
`jobs.status` sin actualizar; o el primer `update` de `approveFileVersion` sin
aplicar el segundo) **no se revierte visualmente en pantalla porque nunca se
había aplicado nada visualmente para revertir** — solo se avisa con el `alert()`.
Es una diferencia real con el rollback de `setStatus`, documentada acá para no
asumir a futuro que las 7 se comportan igual.

**Deuda que queda (fuera de este alcance, ya señalada en el ítem original):** el
`alert()` nativo sigue siendo un patrón temporal — pendiente reemplazarlo por
algo consistente con el resto de la UI, junto con los 2 `confirm()` nativos que
ya estaban señalados como corte de alcance deliberado (ver 🟢 Bajo).

**Dónde (call sites originales, referencia):** `src/components/JobDetail/JobDetailPage.tsx` —
- Bloquear/desbloquear: `blockJob` (línea 308, dentro del `onConfirm` del modal —
  el modal se cierra igual haya fallado o no) y `unblockJob` (líneas 135-137)
- Control de calidad: `toggleQualityCheck` (línea 256)
- Detalle/productos: `toggleProductChecked` (línea 242)
- Archivos: `addFileVersion`/`approveFileVersion`/`deleteFileVersion` (líneas
  267-269, disparados desde `FilesTab` en 351/392/395 — sin estado de carga por
  ítem, así que un upload lento se puede re-disparar con otro click)
- Instalación completada: `onComplete` (línea 517 — el diálogo se cierra sin
  esperar que la acción termine)

**Qué está mal:** mismo patrón que el ítem 1 (fire-and-forget, sin try/catch), pero
acotado a acciones de la ficha individual en vez de las que se disparan desde
listados. `ProductsTab.save()` (líneas 428-436) es un caso intermedio: sí tiene
estado `saving` que deshabilita los botones, pero **no tiene catch** — si
`updateJobSpecs` tira un error, el botón se re-habilita pero nadie ve por qué falló.

**Por qué importa para Bonta:** son acciones que alguien hace parado al lado de la
máquina o con el cliente en el local — "marcá como bloqueado", "tildá que ya
revisaste el control de calidad", "subí el archivo aprobado". Si cualquiera de
estas falla en silencio, la persona sigue adelante asumiendo que quedó registrado
cuando no quedó, y el problema recién aparece cuando otra persona del equipo mira
la ficha más tarde y no encuentra lo que se supone que ya estaba cargado.

**Fix concreto:** mismo patrón try/catch + `alert(friendlyError(err))` que el
ítem 1. Para `FilesTab` puntualmente, sumar un `uploadingIds`/`Set<string>` para
deshabilitar el botón de subida mientras esa versión puntual está en curso.

---

### 4. Si falla la carga inicial de datos, la pantalla queda vacía sin explicación

**Estado: resuelto.** Se agregó `refreshAll()` al store (`src/store/useStore.ts`,
solo expone la función privada `get_loadAll` ya existente) y un banner en
`AppLayout.tsx` (`DataLoadBanner`) entre el Header y el contenido: si `loadError`
tiene contenido, muestra el mensaje + botón "Reintentar"; si `dataLoading` es
`true` sin error, una franja liviana "Actualizando datos...". Se verificó antes de
aplicar que `jobs`/`users`/`clients` no se resetean a vacío en el catch de
`get_loadAll` — quedan en lo que tenían antes, que en el boot inicial o justo
después de loguearse **es** `[]` — así que el copy del banner de error es
explícito sobre que la pantalla de abajo puede estar vacía por el error, no
porque no haya nada cargado hoy (evita que se confunda con "sin trabajos
activos").

**Dónde:** `src/store/useStore.ts:599, 618-628` — `dataLoading` y `loadError` se
setean correctamente en `get_loadAll()`, pero no los lee ningún componente
(`src/App.tsx` solo evalúa `authReady`, no `dataLoading`; `loadError` no aparece en
ningún `.tsx` del proyecto).

**Qué está mal:** si el fetch inicial (trabajos, clientes, usuarios, catálogos)
falla — caída de Supabase, credenciales vencidas, política de RLS rota — la app
renderiza el Dashboard/Kanban/Tabla con arrays vacíos, indistinguible de "hoy no
hay trabajos cargados".

**Por qué importa para Bonta:** el Dashboard es literalmente el "briefing diario"
de Gonzalo — la razón de ser de esta app es que él la abra a la mañana y sepa qué
hacer. Si un día falla la carga y ve el Dashboard vacío, lo más probable es que
piense que no hay nada pendiente en vez de que hay un problema técnico, y pierda
el día sin trabajar sobre lo que realmente hay cargado.

**Fix concreto:** en `AppLayout.tsx` (o en `DashboardPage.tsx`), leer
`useStore(s => s.loadError)` y, si no es `null`, mostrar un banner fijo arriba de
todo ("No se pudieron cargar los datos: {loadError}. Recargá la página o avisá si
sigue.") en vez de dejar que el resto de la UI renderice como si todo estuviera
bien. `dataLoading` puede usarse para un spinner simple en el mismo lugar donde
hoy solo se chequea `authReady`.

---

### 5. El Kanban no entra completo en una notebook común, ni siquiera hasta "Listo para entregar"

**Estado: resuelto.** `min-w-[1400px]` bajó a `min-w-[1150px]`
(`src/components/Kanban/KanbanPage.tsx`) — recupera las 7 columnas sin scroll en
1440-1536px y mejora 1366px de ~5 a ~6 y media, sin reintroducir el truncamiento
de texto (el fix de `line-clamp-2` en `CardBody` es independiente del ancho). Se
evaluó la alternativa de agregar solo una señal visual de scroll (sombra/degradé)
en vez de tocar el ancho, pero esa opción no resuelve este ítem — el problema acá
es que las columnas no entran *sin* scrollear, no que falte avisar que hay que
scrollear (eso es un problema distinto, ya trackeado aparte en el ítem #9).

**Dónde:** `src/components/Kanban/KanbanPage.tsx` — grilla de 7 columnas,
`min-w-[1400px]` (línea ~320), dentro de un layout con sidebar `w-60` (240px,
`src/components/Layout/Sidebar.tsx:23`) + `p-6` de padding de página (48px).

**Qué está mal:** ancho necesario para ver las 7 columnas sin scroll = 240 + 48 +
1400 = **1688px**. Contra resoluciones reales:

| Resolución | Ancho disponible | Columnas visibles sin scroll |
|---|---|---|
| 1366×768 (notebook muy común) | 1078px | ~5 completas |
| 1440×900 (notebook típica) | 1152px | ~5 y media |
| 1536×864 (1920×1080 con escalado 125%, default en muchos Windows) | 1248px | ~6 y un poco |
| 1920×1080 al 100% | 1632px | las 7 |

Es decir: en la enorme mayoría de notebooks de 13"-14" (que es probablemente el
hardware real del equipo), hace falta scrollear para llegar a "Instalación" y
"Entregado" — y en 1366-1440px, hasta **"Listo para entregar" queda parcialmente
cortado**.

**Por qué importa para Bonta:** "Listo para entregar" es, por decisión explícita
del propio proyecto, el estado que más se consulta de un vistazo (por eso está
primero en el orden de KPIs del Dashboard). Que justo esa columna quede al límite
de lo visible en la mayoría de las pantallas reales contradice esa prioridad — el
Kanban, que es la vista pensada para ver "en qué está todo" de un vistazo, obliga
a scrollear para ver lo más importante.

**Fix concreto:** el ensanche de `min-w-1120px` a `min-w-1400px` (hecho para que el
texto no se corte) y el wrap de texto (`line-clamp-2`) son dos arreglos
independientes — el segundo ya no depende del primero. Se puede angostar el
mínimo de nuevo, por ejemplo a `min-w-[1150px]` (~165px/columna), sin reintroducir
el corte de texto, recuperando 1-2 columnas visibles en 1366-1440px sin perder el
fix de texto ya hecho.

---

### 6. Cambiar de columna en el Kanban no tiene ninguna alternativa de teclado

**Dónde:** `src/components/Kanban/KanbanPage.tsx` — `useSensors(useSensor(PointerSensor, ...))`,
sin `KeyboardSensor` de `@dnd-kit/core`.

**Qué está mal:** la interacción central de esta pantalla (arrastrar una tarjeta
para cambiar el estado del trabajo) depende 100% de mouse o touch. El propio
comentario del código ya lo reconoce ("el cambio de columna sigue siendo por
mouse"). Sí se puede abrir la ficha con teclado (Enter/Espacio sobre la tarjeta,
correctamente implementado), pero no mover el trabajo de columna desde ahí.

**Por qué importa para Bonta:** hay un camino alternativo real (cambiar el estado
desde el select de la ficha o de la Tabla de trabajos), así que no es una barrera
total — pero si en algún momento alguien del equipo usa el Kanban con dificultad
motora, o simplemente prefiere teclado, la función que le da sentido a esta
pantalla en particular queda inoperable para esa persona sin que haya ningún
aviso de que existe un camino alternativo en otro lado.

**Fix concreto:** sumar `KeyboardSensor` a `useSensors()` (ya viene con
`@dnd-kit/core`, no hace falta instalar nada nuevo) con sus
`sortableKeyboardCoordinates` o equivalente para mover el foco entre columnas con
flechas y confirmar con Enter/Espacio — es la forma estándar documentada por la
propia librería para este caso exacto.

---

### 7. Los campos de medida (Cantidad/Ancho/Alto) son ilegibles para un lector de pantalla

**Estado: resuelto.** Se agregó `aria-label="Cantidad"`/`"Ancho"`/`"Alto"` a los 3
inputs (`src/components/Common/SizeItemsEditor.tsx:33-35`), sin tocar placeholders
ni layout. Cubre las 2 pantallas que usan el componente (Carga rápida y la pestaña
Detalle de la ficha, ambas vía `ProductsEditor.tsx`).

**Dónde:** `src/components/Common/SizeItemsEditor.tsx:33-35` — los 3 inputs de cada
renglón de medida.

**Qué está mal:** el input de "Cant." (línea 33) no tiene `placeholder` ni
`aria-label` — nombre accesible vacío. Los de "Ancho" y "Alto" (líneas 34-35)
comparten el **mismo placeholder literal** (`"cm o «a medida»"`), así que un lector
de pantalla anuncia ambos exactamente igual. Los encabezados visuales
("Cant./Ancho/Alto") son `<span>` sueltos en una fila aparte, sin `<label>` ni
`aria-labelledby` que los conecte a los inputs de abajo.

**Por qué importa para Bonta:** este componente se usa en Carga rápida y en la
pestaña Detalle de la ficha — es decir, en el único paso obligatorio para poder
crear un trabajo (la app no deja crear un trabajo sin al menos una medida
cargada). Un usuario de lector de pantalla no tiene forma de saber qué está
tipeando en 2 de los 3 campos, y en el tercero no tiene ninguna pista.

**Fix concreto:** en `SizeItemsEditor.tsx`, agregar `aria-label="Cantidad"` al
primer input, `aria-label="Ancho"` y `aria-label="Alto"` a los otros dos —
tres atributos, sin tocar el layout visual (los placeholders/labels visuales
pueden quedar igual).

---

## 🟡 Medio

### 8. El mismo estado de un trabajo se ve de color distinto según la pantalla

**Dónde:** `src/components/Common/Badges.tsx:51-58` (`STATUS_TONE`) vs.
`src/data/catalog.ts` (`KANBAN_COLUMNS[].tone`).

**Qué está mal:** el badge de estado (usado en Tabla, Dashboard y ficha) tiene solo
5 tonos — `EN_DISENO`, `DISENO_LISTO`, `EN_PRODUCCION`, `EN_CONTROL_CALIDAD` y
`EN_INSTALACION` mapean **todos al mismo azul** ("info"). El Kanban, en cambio, les
da 4 colores distintos a esos mismos 5 estados (Diseño=azul, Producción=dorado,
Control de calidad=violeta, Instalación=verde azulado). Es decisión deliberada
documentada en el propio comentario del código ("un color por macro-etapa, no por
estado individual"), pensada para no saturar una tabla densa — pero choca con el
argumento central del proyecto de que "el color se lee de un vistazo" (CLAUDE.md,
decisión 9), que se cumple *dentro* del Kanban pero no *entre* pantallas.

**Por qué importa para Bonta:** alguien que aprendió "dorado = en producción"
mirando el Kanban ve ese mismo trabajo en azul en la Tabla o el Dashboard — el
color deja de ser una señal confiable en cuanto se sale del tablero.

**Fix concreto:** extender `StatusTone` en `Badges.tsx` de 5 a los mismos 7 tonos
que ya usa `KANBAN_COLUMNS` — los tokens `norm`/`review`/`site` ya existen en
`tailwind.config.js`, así que es un cambio de mapeo, no de infraestructura de
color nueva.

---

### 9. Scroll horizontal sin ninguna señal de que hay más contenido (Kanban y Tabla en mobile)

**Estado: resuelto.** Se creó `src/components/Common/ScrollFade.tsx`
(`ScrollFadeX`) — un wrapper reusable que mide `scrollWidth`/`clientWidth`/
`scrollLeft` del contenedor scrolleable (con `onScroll` + `ResizeObserver`, sin
depender de una librería nueva) y superpone un degradé sutil de 40px en el borde
derecho, con `opacity-0`/`opacity-100` + `transition-opacity` — **no es una
sombra fija**: se apaga solo en cuanto `scrollLeft` llega al final del contenido
(con 1px de margen para redondeo de subpíxel), y vuelve a aparecer si se scrollea
para atrás. Aplicado en los dos lugares que señalaba el informe:
- `KanbanPage.tsx` — el contenedor `overflow-x-auto` de la grilla de 7 columnas
  (línea ~315) ahora es `<ScrollFadeX wrapperClassName="flex-1 min-h-0 mt-4"
  className="h-full overflow-x-auto" fadeFrom="from-ink-50">` — `fadeFrom` en
  `from-ink-50` porque el Kanban se ve directo sobre el fondo crema de la app
  (`bg-ink-50` en `AppLayout`), no sobre una tarjeta blanca.
- `JobsTable.tsx` — el `<div className="overflow-x-auto">` que envuelve la
  `<table>` (línea ~81) ahora es `<ScrollFadeX className="overflow-x-auto">`, con
  el `fadeFrom` por default (`from-white`) porque tanto `JobsPage` como
  `ClientsPage` (las dos pantallas que reusan `JobsTable`, ver CLAUDE.md
  estructura de carpetas) envuelven la tabla en una tarjeta blanca
  (`bg-white rounded-xl ... overflow-hidden`) — el fix llega gratis a las dos.

Verificado en vivo con la técnica de bypass de auth local (§25/§26/§27/§29 de
CLAUDE.md, revertida con `git checkout` antes de commitear): en Kanban a 900px
de ancho (`scrollWidth` 1150 vs. `clientWidth` 852) el degradé arranca en
`opacity: 1` y cae a `opacity: 0` al llegar al final del scroll; en la Tabla a
375px (`scrollWidth` 1166 vs. `clientWidth` 318) mismo comportamiento.

**Dónde (referencia original):** `src/components/Kanban/KanbanPage.tsx` (contenedor `overflow-x-auto` de
la grilla) y `src/components/Jobs/JobsTable.tsx` (`overflow-x-auto` alrededor de
la tabla) en viewport de 375px.

**Qué está mal:** en ambos casos, el borde derecho corta el contenido a mitad de
una tarjeta/columna sin ninguna sombra, degradé o ícono que indique que hay más.
Verificado que **no es una barrera dura**: un usuario de teclado sí llega a ese
contenido (el navegador auto-scrollea al enfocar un elemento fuera de vista) y un
lector de pantalla anuncia el contenido igual sin importar si está "visible" — el
problema es específicamente para quien usa mouse/touch y no intenta scrollear por
instinto.

**Por qué importa para Bonta:** en la Tabla mobile, solo 3 de 8 columnas son
visibles (Prioridad, N°, Cliente) — alguien mirando desde el celular puede no
enterarse de que el Estado, el Responsable o la fecha de Entrega existen ahí
mismo, un scroll a la derecha.

**Fix concreto:** un degradé/sombra sutil en el borde derecho cuando
`scrollWidth > clientWidth` (patrón estándar, se puede armar con un
`onScroll`/`ResizeObserver` chico que agregue una clase condicional), aplicado una
sola vez y reusado en los dos lugares.

---

### 10. `aria-label` faltante o inconsistente en varios selects/inputs

**Estado: resuelto.** Se agregaron los 7 atributos exactos que proponía el fix
concreto de este ítem, sin tocar layout ni placeholders — mismo criterio que ya
se usó en el ítem #7 (`SizeItemsEditor`): `aria-label="Estado"` en `StatusSelect`
(`Badges.tsx:114`, el `<select>` — ver la línea de más abajo, la numeración
original decía 110-126 para todo el componente); `aria-label="Buscar"` en el
input de búsqueda de `JobsPage.tsx:55-58`, y `"Prioridad"`/`"Estado"`/`"Cliente"`/
`"Responsable"` en los 4 `<select>` de filtro (`JobsPage.tsx:59/63/67/71`);
`aria-label="Buscar"` en el input del buscador del Header (`Header.tsx:65-71`).

**Dónde (referencia original):**
- `StatusSelect` (`src/components/Common/Badges.tsx:110-126`) no tiene
  `aria-label`, a diferencia de `PrioritySelect` (mismo archivo, línea ~93) que sí
  tiene `aria-label="Prioridad"` — mismo archivo, mismo patrón de componente,
  tratamiento distinto.
- Los 5 controles de filtro de `src/components/Jobs/JobsPage.tsx` (Buscar +
  4 `<select>`) no tienen `aria-label` ni `<label>` asociado.
- El buscador del Header (`src/components/Layout/Header.tsx:65-71`) solo tiene
  `placeholder`, sin `aria-label`.

**Por qué importa para Bonta:** en los selects, el texto de la opción
seleccionada sirve de respaldo (un lector de pantalla anuncia algo como
"● Pendiente, lista"), así que no es una barrera dura — pero es menos robusto y
menos inmediato que un `aria-label` explícito, y es inconsistente con el propio
patrón que el proyecto ya usa en `PrioritySelect`.

**Fix concreto:** agregar `aria-label="Estado"` a `StatusSelect`, y
`aria-label="Prioridad"`/`"Estado"`/`"Cliente"`/`"Responsable"`/`"Buscar"` a los
controles de `JobsPage.tsx` y `aria-label="Buscar"` al input del Header — 7
atributos en total, ningún cambio de layout.

---

### 11. `EditableCode` duplicado entre Tabla y Dashboard, ya con una diferencia real entre copias

**Dónde:** `src/components/Jobs/JobsTable.tsx:14-54` y
`src/components/Dashboard/DashboardJobCard.tsx:15-55`.

**Qué está mal:** es el mismo componente (input inline para cargar el N° de
Copernico) copiado y pegado en los dos archivos, ya documentado como duplicación
conocida — pero las dos copias **ya divergieron**: la versión de `JobsTable` tiene
`onClick={(e) => e.stopPropagation()}` en el input, la de `DashboardJobCard` no.
Hoy no causa un bug visible porque el contenedor de `DashboardJobCard` tiene su
propio guard (`closest('select, button, input')`) que cubre el mismo caso, pero es
exactamente el tipo de drift que con el tiempo produce un bug real cuando alguien
edita una copia y se olvida de la otra.

**Por qué importa para Bonta:** el propio CLAUDE.md ya advierte esto ("si se toca
uno, revisar si el otro necesita el mismo cambio") — es una advertencia que
depende de que la próxima persona (o sesión de Claude Code) se acuerde de leerla.

**Fix concreto:** mover `EditableCode` a `src/components/Common/` como componente
compartido (recibiendo `job`, `editable`, `onSave` y una prop de tamaño/estilo
para las pequeñas diferencias visuales entre Tabla y Dashboard), y que ambos
archivos lo importen de ahí en vez de mantener cada uno su copia.

---

## 🟢 Bajo

Hallazgos de pulido visual o de higiene de código, sin impacto funcional — no
bloquean ninguna tarea real del equipo, pero vale la pena tenerlos anotados.

- **Grilla de KPI del Dashboard asimétrica.** 9 tarjetas en filas de 7 (o de 2 en
  mobile) dejan la última fila con 1-2 tarjetas sueltas y un vacío grande al lado.
  *Fix:* ajustar a un número de columnas que sea divisor de 9, o agrupar las
  últimas 2 en su propia fila de ancho completo.
- **Densidad alta por fila en el Dashboard** (`src/components/Dashboard/DashboardJobCard.tsx`) —
  8-10 datos por ficha, funcional pero exigente para un primer vistazo.
- **Copy de Carga rápida** ("Todo en una sola pantalla") no coincide con el largo
  real del formulario (~1800px, 2-3 pantallas de scroll). *Fix:* ajustar el copy o
  colapsar por defecto secciones con valores ya sugeridos.
- **Panel de comentarios** de la ficha deja mucho espacio vacío cuando hay pocos
  mensajes (el caso más común en trabajos reales).
- **`font-brand` fuera de su alcance documentado** —
  `src/components/JobDetail/JobExportPage.tsx:56` lo usa para "Estudio Bonta" en
  la hoja de exportación al cliente; CLAUDE.md lo reserva solo para
  Sidebar/Login. *Fix:* cambiar a la tipografía funcional (Inter) como el resto
  de la UI, o confirmar con Gonzalo si quiere sumar este tercer lugar a la regla.
- **Colores y sombras sueltos fuera de los tokens:**
  - `'#999'` hardcodeado como fallback de `Avatar` en
    `src/components/JobDetail/JobDetailPage.tsx:290` y
    `src/components/JobDetail/CommentsPanel.tsx:41` — reemplazar por un token
    `ink-*` existente.
  - `shadow-[0_-2px_6px_rgba(15,23,32,0.08)]` en
    `src/components/JobDetail/JobDetailPage.tsx:199` y
    `drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]` en
    `src/components/Auth/LoginPage.tsx:55` — sombras de un solo uso fuera de
    `shadow-card`/`shadow-pop`.
  - Tamaños de texto sueltos (`text-[11px]`, `text-[10px]`, `text-[13px]`)
    repetidos sin un token compartido en `Badges.tsx` (4 veces),
    `JobDetailPage.tsx` (4 veces), `QuickJobPage.tsx` (6 veces),
    `Sidebar.tsx` (3 tamaños distintos) y `KanbanPage.tsx` (6 veces).
  - `Avatar` (`src/components/Common/Badges.tsx:174`) mete `width`/`height`/
    `fontSize` en `style` inline en vez de clases — solo el color de fondo está
    genuinamente justificado ahí por ser dato por usuario.
- **Tres componentes `Section` reimplementados por separado** —
  `src/components/QuickJob/QuickJobPage.tsx:56-66`,
  `src/components/Common/ConfigPage.tsx:43-52` y
  `src/components/JobDetail/JobExportPage.tsx:12-19` — mismo wrapper (tarjeta +
  título), tres implementaciones. *Fix:* unificar en `Common/`.
- **Kanban arma su propio pill de "muestra"** (`src/components/Kanban/KanbanPage.tsx:65-69`)
  en vez de reusar `SampleReviewBadge` (`Common/Badges.tsx:151-167`, que ya tiene
  una variante `size="sm"` pensada para este caso).
- **`confirm()` nativo todavía en 2 lugares** — borrar trabajo
  (`src/components/Jobs/JobsTable.tsx:68`) y borrar versión de archivo
  (`src/components/JobDetail/JobDetailPage.tsx:395`) — en vez del `ConfirmDialog`
  ya construido en `Common/Modal.tsx:27-51` y usado en Carga rápida. Ya señalado
  como corte de alcance deliberado en una ronda anterior — sigue abierto, no es
  un olvido nuevo.

---

## Resumen — por dónde arrancar

| # | Severidad | Ítem | Alcance del fix |
|---|---|---|---|
| 1 | 🔴 Crítico | Cambios de estado/prioridad sin manejo de error | Try/catch en ~6 puntos, patrón ya probado en el código |
| 2 | 🔴 Crítico | `setUserActive` sin manejo de error | 1 función, try/catch + rollback visual |
| 3 | 🟠 Alto | Resto de acciones de la ficha sin manejo de error | **Resuelto** — try/catch en 8 puntos + `if (error) throw` agregado en 6 de las 7 funciones del store que no lo tenían |
| 4 | 🟠 Alto | `loadError`/`dataLoading` nunca se muestran | 1 banner en AppLayout/DashboardPage |
| 5 | 🟠 Alto | Kanban no entra en notebooks comunes | Angostar `min-w` de la grilla |
| 6 | 🟠 Alto | Sin alternativa de teclado para mover tarjetas | Sumar `KeyboardSensor` de dnd-kit |
| 7 | 🟠 Alto | Inputs de medida sin nombre accesible | 3 atributos `aria-label` |
| 8 | 🟡 Medio | Color inconsistente entre Kanban y resto | Cambio acotado, sin riesgo |
| 9 | 🟡 Medio | Scroll sin señal (Kanban y Tabla mobile) | **Resuelto** — `ScrollFadeX` compartido, degradé que se apaga solo al llegar al final |
| 10 | 🟡 Medio | `aria-label` faltante/inconsistente | **Resuelto** — 7 atributos agregados (`StatusSelect`, filtros de `JobsPage`, buscador del Header) |
| 11 | 🟡 Medio | `EditableCode` duplicado | Cambio acotado, sin riesgo |
| resto | 🟢 Bajo | Pulido visual y limpieza de código | Sin apuro, sin impacto de uso real |

Los ítems 1-7 (crítico + alto) son los que recomendaría atacar primero — todos
tocan una acción real que el equipo hace todos los días, o una barrera dura de
acceso, y ninguno requiere una decisión de producto: son huecos de manejo de error
o de accesibilidad con un fix puntual y acotado.
