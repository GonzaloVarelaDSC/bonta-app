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

// Catálogo sintetizado (26/08) alrededor de máquina/proceso real en vez de
// "vertical" abstracta — ver data/catalog.ts. Los ids viejos (abajo) se dejan
// en el tipo por los pocos trabajos de prueba que ya los tienen guardados;
// `JOB_TYPES` (lo que se ofrece para elegir) ya no los incluye.
export type JobTypeId =
  | 'impresion_v7000' | 'impresion_s40' | 'impresion_p9000'
  | 'corte_laser' | 'corte_cnc' | 'corporeo' | 'carpinteria' | 'acrilico' | 'vidrieras_stands' | 'otro'
  // @deprecated ids viejos, ya no aparecen en el selector — quedan para no romper el tipado de trabajos de prueba existentes.
  | 'impresion_uv' | 'bajo_acrilico' | 'plotter_vinilo' | 'vidrieras' | 'senaletica'
  | 'carteleria' | 'letras_corporeas' | 'backlight' | 'stands' | 'eventos'
  | 'ambientacion' | 'trofeos' | 'impresion_3d' | 'piezas_especiales';

export interface JobType {
  id: JobTypeId;
  label: string;
  defaultStages: StageKey[];
}

export type MaterialId =
  | 'acrilico' | 'pvc' | 'mdf' | 'madera' | 'metal' | 'vidrio' | 'vinilo' | 'papel' | 'tela' | 'otros';

export interface Material {
  id: MaterialId;
  label: string;
}

export type StageKey =
  | 'diseno' | 'impresion' | 'corte' | 'laminado' | 'armado'
  | 'carpinteria' | 'terminacion' | 'control_calidad' | 'embalaje' | 'instalacion';

export type StageStatus = 'pendiente' | 'en_progreso' | 'terminado';

export interface JobStage {
  key: StageKey;
  label: string;
  active: boolean;
  status: StageStatus;
  assignedUserId?: string;
}

export type JobStatus =
  | 'PENDIENTE' | 'NUEVO' | 'FALTA_INFORMACION' | 'APROBADO' | 'EN_DISENO' | 'DISENO_LISTO'
  | 'EN_PRODUCCION' | 'EN_CONTROL_CALIDAD' | 'LISTO_PARA_ENTREGA'
  | 'LISTO_PARA_INSTALACION' | 'EN_INSTALACION' | 'TERMINADO' | 'BLOQUEADO' | 'CANCELADO';

export type Priority = 'CRITICO' | 'URGENTE' | 'NORMAL' | 'PLANIFICADO' | 'EN_ESPERA';
export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

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
 * brillo/satin según la máquina, con o sin base, demasía de 5mm si va montado
 * salvo que sea sobre PVC, etc.) son demasiado variables para forzarlas en
 * dropdowns sin arriesgar quedar mal o incompletas; un renglón de texto que la
 * gente que sabe del oficio complete a mano es más fiel que una UI rígida
 * adivinando reglas del rubro. Si con el uso real se ve un patrón que conviene
 * estructurar, se agrega después.
 */
export interface Product {
  id: string;
  label: string; // ej. "Corpóreo 3D", "Corpóreo en acrílico"
  materialIds: MaterialId[];
  sizeItems: SizeItem[];
  notes: string; // espesor, color de acrílico, mate/brillo/satin, con o sin base, montado o no, etc.
  checked: boolean; // "ya lo procesé" — informativo, nunca bloquea el cambio de estado del trabajo
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
  createdAt: string;
  requestedDate: string; // fecha solicitada por cliente
  committedDate: string; // fecha comprometida internamente (con hora)
  finishedAt?: string;
  readyAt?: string; // fecha en que quedó "Listo" por primera vez (se graba sola, no se pisa después)

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
  observations: string;
  specialRequirements: string;

  status: JobStatus;
  stages: JobStage[];

  priorityAuto: Priority;
  priorityManual: Priority | null;

  requiresInstallation: boolean;
  installation?: InstallationInfo;

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
