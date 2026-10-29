// Modelo de datos — espejo del esquema Postgres/Supabase definido en la especificación.
// Cuando se conecte el backend real, estas interfaces se mantienen y solo cambia
// la capa de acceso a datos (src/store).

export type RoleId = 'admin' | 'coordinador' | 'diseno' | 'produccion' | 'instalacion';

export interface Role {
  id: RoleId;
  label: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  sector: string;
  avatarColor: string;
  active: boolean;
  // Separado de `role` a propósito: el rol es el permiso de sistema (admin ve
  // Usuarios/Configuración), esto es si a la persona le asignan trabajos de
  // verdad. Un dueño puede ser admin sin ser nunca responsable de un trabajo;
  // Gonzalo puede ser admin Y diseñador a la vez.
  isProducer: boolean;
  // Separado también de `role`: puede cargar un trabajo (tiene permiso), pero
  // no necesariamente aparece como opción en "Asignado por" — ese campo es un
  // crédito de "quién de verdad fue el que lo tomó/coordinó con el cliente"
  // (Nancy/Richard/Alejandra/Gonzalo), no cualquiera que tenga acceso al
  // formulario (Gastón/Pancho/Martín pueden cargar en un apuro, pero el
  // crédito real le queda a otro). Ver `assigners` en QuickJobPage.tsx.
  creditsAsAssigner: boolean;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  contacts: { name: string; phone: string; email: string }[];
  address: string;
  notes: string;
  tier: 'estandar' | 'prioritario';
}

// Catálogo editable desde Configuración (13/09) — vive en la tabla `job_types`
// de Supabase, no en una lista fija de código. El id es un string libre
// (slug generado a partir del label al crearlo desde la UI), no un union
// cerrado: un admin puede agregar tipos nuevos en cualquier momento. Los ids
// "viejos" del catálogo sintetizado original (impresion_uv, senaletica, etc.)
// siguen en la tabla por trabajos de prueba que ya los tienen guardados, pero
// dejaron de ofrecerse en el selector — ver `LEGACY_JOB_TYPE_IDS` en
// data/catalog.ts.
export type JobTypeId = string;

export interface JobType {
  id: JobTypeId;
  label: string;
}

// Editable desde Configuración, igual que JobTypeId — ver ese comentario arriba.
export type MaterialId = string;

export interface Material {
  id: MaterialId;
  label: string;
}

export type JobStatus =
  | 'PENDIENTE' | 'FALTA_INFORMACION' | 'EN_DISENO' | 'DISENO_LISTO'
  | 'EN_PRODUCCION' | 'EN_CONTROL_CALIDAD' | 'LISTO_PARA_ENTREGA'
  | 'LISTO_PARA_INSTALACION' | 'EN_INSTALACION' | 'TERMINADO' | 'CANCELADO';

export type Priority = 'CRITICO' | 'URGENTE' | 'NORMAL' | 'PLANIFICADO' | 'EN_ESPERA';
export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

// Muchos clientes piden una muestra / prueba impresa (colores, definición,
// textura) antes de mandar a producir el trabajo entero. `none` = no hay muestra
// en juego; `in_production` = ya se emitió la OT de la muestra y se está
// haciendo, todavía no se le avisó al cliente (20/09, CLAUDE.md §48); `awaiting`
// = la muestra ya está y se le avisó al cliente, falta que venga a verla y dé el
// OK (no arrancar la producción completa); `approved` = el cliente la aprobó,
// vía libre.
export type SampleReview = 'none' | 'in_production' | 'awaiting' | 'approved';

export interface FileVersion {
  id: string;
  version: number;
  fileName: string;
  sizeKb: number;
  uploadedBy: string;
  uploadedAt: string;
  approved: boolean;
}

export interface JobFile {
  id: string;
  logicalName: string;
  kind: string;
  versions: FileVersion[];
}

export interface Comment {
  id: string;
  jobId: string;
  userId: string;
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  jobId: string;
  userId: string;
  action: string;
  detail: string;
  createdAt: string;
}

export type BlockReason =
  | 'falta_archivo' | 'falta_aprobacion' | 'falta_informacion' | 'falta_material'
  | 'problema_maquina' | 'problema_diseno' | 'problema_cliente' | 'problema_instalacion' | 'otro';

export interface BlockRecord {
  id: string;
  reason: BlockReason;
  description: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
}

export interface QualityCheckItem {
  key: string;
  label: string;
  required: boolean;
  checked: boolean;
}

export interface InstallationInfo {
  address: string;
  contactName: string;
  contactPhone: string;
  date?: string;
  time?: string;
  assignedUserIds: string[];
  notes: string;
  completed: boolean;
  completedAt?: string;
  completedNotes?: string;
}

// Un "renglón" de medida: cantidad + ancho + alto, para pedidos con variantes
// mixtas (ej. "2 de 20x20, 3 de 10x10"). Ancho/alto son texto libre a propósito
// (no numérico) para poder anotar "a medida de la imagen" o "proporcional".
export interface SizeItem {
  quantity: string;
  width: string;
  height: string;
}

/**
 * Un trabajo real casi nunca es "un material, una medida" — son combinaciones
 * de productos/procesos distintos para el mismo cliente en el mismo trabajo
 * (ej. "Corpóreo 3D" + "Corpóreo en acrílico"). Cada `Product` es uno de esos
 * renglones: su propio material, sus propias medidas, y un check para llevar
 * el pulso de cuáles ya se procesaron.
 *
 * `notes` es a propósito texto libre y no un campo estructurado por espesor/
 * terminación/montaje — las combinaciones reales (espesor de acrílico, mate/
 * brillo/satin según la máquina, con o sin base, demasía de 7mm por lado si va
 * montado salvo que sea sobre PVC, etc.) son demasiado variables para forzarlas en
 * dropdowns sin arriesgar quedar mal o incompletas; un renglón de texto que la
 * gente que sabe del oficio complete a mano es más fiel que una UI rígida
 * adivinando reglas del rubro. Si con el uso real se ve un patrón que conviene
 * estructurar, se agrega después.
 */
// Configuración de la pestaña "Producción" de la ficha (12/10) — vive aparte de
// `products` (jsonb propio, `jobs.production_config`) para que preparar la
// planilla de taller nunca toque la carga original del trabajo. Los productos de
// la OT NO se copian: se referencian por `productId` y sus datos (nombre,
// medidas, material) se leen siempre en vivo de `job.products`; acá solo se
// guarda lo propio de producción (procesos e indicación extra). Los componentes
// que no están en la OT (`source: 'extra'`) sí guardan sus datos completos.
export type ProductionProcessId = string;
export interface ProductionItem {
  id: string;
  source: 'job' | 'extra';
  productId?: string; // solo source='job'
  processes: ProductionProcessId[];
  note: string; // indicación para el taller, ej. "montar sobre PVC 3mm"
  // Solo source='extra' (texto libre, igual que SizeItem):
  label?: string;
  quantity?: string;
  size?: string;
}
// Composición y armado (19/10, CLAUDE.md §75): un producto terminado de la OT
// (ej. "Corpóreo de polifan", 3 unidades) y qué piezas de la planilla lleva UNA
// unidad. Las piezas NO se copian: se referencian por `pieceKey` (id del ítem de
// producción + índice de medida = un renglón de la planilla). El total requerido
// se calcula (por unidad × unidades), nunca se guarda. `ready` y `assembled` son
// los únicos registros de avance: los cuenta a mano quien arma, por tipo de pieza
// (no pieza por pieza), así el corte puede seguir haciéndose por lotes.
export interface AssemblyComponent {
  pieceKey: string;
  perUnit: number;
  ready: number; // piezas de este tipo hechas y disponibles para armar (total acumulado)
}
export interface Assembly {
  id: string;
  label: string;
  units: number; // unidades terminadas que pide la OT
  components: AssemblyComponent[];
  assembled: number; // unidades ya armadas
}
export interface ProductionConfig {
  items: ProductionItem[];
  assemblies?: Assembly[];
}

export interface Product {
  id: string;
  label: string; // ej. "Corpóreo 3D", "Corpóreo en acrílico"
  materialIds: MaterialId[];
  sizeItems: SizeItem[];
  notes: string; // espesor, color de acrílico, mate/brillo/satin, con o sin base, montado o no, etc.
  checked: boolean; // "ya lo procesé" — informativo, nunca bloquea el cambio de estado del trabajo
  // Esta pieza la hace un proveedor externo, no el estudio. Se marca aparte
  // (con color propio en la carga y en las fichas) porque cambia a quién hay
  // que seguirle el trámite. Opcional: datos viejos no lo tienen.
  outsourced?: boolean;
}

export interface Job {
  id: string;
  code: string | null; // N° de trabajo / orden de Copernico — lo carga a mano un admin/coordinador, no se genera solo
  name: string;
  clientId: string;
  contactName: string;
  contactPhone: string; // teléfono/WhatsApp de quien pidió este trabajo puntual
  createdByUserId: string | null;
  responsibleUserId: string;
  assignedUserIds: string[];
  // Gente del taller / instaladores sin cuenta en la app (lista fija, ver
  // ASSIGN_ALSO_NAMES en data/catalog.ts). Texto plano, no son perfiles.
  assignedNames: string[];
  createdAt: string;
  requestedDate: string; // fecha solicitada por cliente
  committedDate: string; // fecha comprometida internamente (con hora)
  finishedAt?: string;
  readyAt?: string; // fecha en que quedó "Listo" por primera vez (se graba sola, no se pisa después)
  // Borrado lógico (Fase 4, 17/09) — "Eliminar" ya no hace un DELETE real, marca
  // estos dos campos. Un trabajo con deletedAt desaparece de Dashboard/Trabajos/
  // Kanban pero sigue existiendo (archivos, comentarios, historial intactos) y es
  // consultable/restaurable desde Histórico.
  deletedAt?: string;
  deletedBy?: string | null;
  // Si este trabajo nació de confirmar un presupuesto (ver Quote.convertedJobId
  // más abajo), acá queda el vínculo inverso — permite ir del trabajo de vuelta
  // al presupuesto de origen. `undefined` para cualquier trabajo cargado normal.
  sourceQuoteId?: string;
  productionConfig: ProductionConfig;
  // Ruta de la imagen de contact sheet en el bucket privado `job-images` (027).
  contactSheetPath?: string | null;

  jobTypeId: JobTypeId;
  description: string;
  /** @deprecated reemplazado por `sizeItems` (26/08) — queda en el esquema por datos viejos, ya no se carga desde ningún formulario. */
  quantity: string;
  /** @deprecated reemplazado por `sizeItems` (26/08) — ídem. */
  measurements: string;
  /** @deprecated reemplazado por `products` (26/08) — un trabajo puede tener varios productos, cada uno con su propia medida. Queda por datos viejos. */
  sizeItems: SizeItem[];
  /** @deprecated ídem. */
  materialIds: MaterialId[];
  products: Product[];
  /** @deprecated "no existe" en la práctica del estudio — ya no se pide en ningún formulario. */
  technique: string;
  /** @deprecated ídem. */
  finish: string;
  /** @deprecated ídem. */
  color: string;
  /** @deprecated redundante con `description` (mismo texto libre a nivel trabajo, sin distinción real de uso) — Gonzalo pidió sacarlo (15/09). Queda en el esquema por datos viejos, ya no se carga ni se muestra desde ningún formulario. */
  observations: string;
  specialRequirements: string;

  status: JobStatus;

  priorityAuto: Priority;
  priorityManual: Priority | null;

  requiresInstallation: boolean;
  installation?: InstallationInfo;

  // Muestra/prueba al cliente antes de producir todo — ver type SampleReview.
  sampleReview: SampleReview;
  sampleReviewAt?: string; // cuándo se marcó por última vez (para "aprobada el ...")

  qualityChecks: QualityCheckItem[];

  files: JobFile[];

  blockRecords: BlockRecord[]; // el último sin closedAt = bloqueo activo

  lastActivityAt: string;
  clientImportant: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  jobId?: string;
  text: string;
  read: boolean;
  createdAt: string;
}

// Presupuestos — un posible trabajo que el cliente todavía NO confirmó.
// Deliberadamente separado de Job: mientras esté acá, nunca aparece en
// Trabajos/Kanban/Dashboard ni genera N° de Copernico/TRB (ver CLAUDE.md §52).
// `BORRADOR` = se está armando; `LISTO_PARA_ENVIAR` = ya tiene todo cargado;
// `ENVIADO` = se le mandó al cliente; `CONFIRMADO`/`RECHAZADO` = respuesta del
// cliente. La conversión a trabajo real (cuando confirma) es un paso aparte,
// todavía no implementado a propósito.
export type QuoteStatus = 'BORRADOR' | 'LISTO_PARA_ENVIAR' | 'ENVIADO' | 'CONFIRMADO' | 'RECHAZADO';

/**
 * Un renglón del presupuesto — mismo espíritu que `Product` (ver más arriba)
 * pero más liviano: sin `checked`/`outsourced` (no tiene sentido todavía no
 * siendo un trabajo en curso). Reusa `SizeItem` para medidas+cantidad, igual
 * que los productos de un trabajo — `unit` es lo único nuevo (m², ml, unidad,
 * etc.), porque un presupuesto sí necesita dejar explícita la unidad para que
 * el cliente entienda qué se está cotizando.
 */
export interface QuoteItem {
  id: string;
  label: string; // descripción breve
  unit: string; // m², ml, unidad, kg, etc. — texto libre
  materialIds: MaterialId[];
  sizeItems: SizeItem[]; // medidas + cantidad por renglón
  notes: string;
}

export interface Quote {
  id: string;
  code: string; // identificación interna (PRE-2026-00001) — se genera sola, NUNCA un N° de Copernico/TRB
  clientId: string;
  name: string;
  items: QuoteItem[];
  status: QuoteStatus;
  // Importe — null mientras nadie lo cargó todavía. `priceIncludesIva` en null
  // significa "no se especificó" (no asumir ninguno de los dos por default,
  // para no dejar un número ambiguo de cara al cliente).
  price: number | null;
  priceIncludesIva: boolean | null;
  createdByUserId: string;
  createdAt: string;
  lastActivityAt: string;
  // Vínculo al trabajo real generado al confirmar (ver `confirmQuote` en el
  // store) — `null` mientras el presupuesto no se confirmó. Una vez seteado,
  // no vuelve a ponerse en null (un presupuesto confirmado no se puede volver
  // a convertir — ver CLAUDE.md, conversión Presupuesto → Trabajo).
  convertedJobId: string | null;
}

// Aviso flotante de "otro usuario cambió el estado de un trabajo" (07/10) —
// deliberadamente separado de `Notification` (la campana): no se persiste por
// usuario ni se guarda en `notifications`, vive solo en memoria de la sesión.
// 28/10: además del cambio de estado, también avisa otras modificaciones de la
// ficha ('cambio', con una línea por campo) y las menciones en comentarios.
export type FlagKind = 'estado' | 'cambio' | 'mencion';
export interface StatusFlag {
  id: string; // id de la fila de activity_log (o del comentario) que lo originó
  kind: FlagKind;
  jobId: string;
  jobName: string;
  from?: JobStatus; // solo 'estado'
  to?: JobStatus;   // solo 'estado'
  /** 'cambio': qué se modificó ({ label: 'Responsable', value: 'Martín → Gastón' }); 'mencion': el texto del comentario. */
  lines?: { label: string; value: string }[];
  authorId: string;
  /** Si agrupa varias filas del Historial, todas sus ids (para no repetirlas ni volver a mostrarlas). */
  memberIds?: string[];
  userName: string;
  at: string;
}

// Objetivo de mejora del módulo Métricas (028). La línea de base se mide al
// crearlo y queda fija; el valor actual se recalcula siempre con la misma
// definición (lib/metrics.ts, goalMetricValue).
export interface MetricGoal {
  id: string;
  title: string;
  metricKey: string;
  baselineFrom: string; // yyyy-mm-dd
  baselineTo: string;
  baselineValue: number | null;
  baselineN: number;
  targetValue: number;
  startDate: string;
  endDate: string;
  ownerUserId: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
}

// Importe final del trabajo (029) — lo que se le cobra al cliente. Tabla aparte
// de `jobs` para que solo lo vean/carguen admin y administración (mismo criterio
// que el valor de un presupuesto, canSetQuoteValue). Las métricas usan siempre
// `amountNet` (sin IVA) para no mezclar importes con y sin IVA.
export interface JobPrice {
  jobId: string;
  amountNet: number;
  enteredAmount: number;
  enteredWithIva: boolean;
  ivaRate: number;
  note: string;
  updatedBy: string;
  updatedAt: string;
}
