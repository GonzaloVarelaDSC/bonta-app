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

export type JobTypeId =
  | 'impresion_uv' | 'bajo_acrilico' | 'plotter_vinilo' | 'vidrieras' | 'senaletica'
  | 'carteleria' | 'letras_corporeas' | 'backlight' | 'stands' | 'eventos'
  | 'ambientacion' | 'carpinteria' | 'acrilico' | 'trofeos' | 'impresion_3d'
  | 'piezas_especiales' | 'otro';

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
  | 'NUEVO' | 'FALTA_INFORMACION' | 'APROBADO' | 'EN_DISENO' | 'DISENO_LISTO'
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

export interface Job {
  id: string;
  code: string | null; // N° de trabajo / orden de Copernico — lo carga a mano un admin/coordinador, no se genera solo
  name: string;
  clientId: string;
  contactName: string;
  createdByUserId: string | null;
  responsibleUserId: string;
  assignedUserIds: string[];
  createdAt: string;
  requestedDate: string; // fecha solicitada por cliente
  committedDate: string; // fecha comprometida internamente (con hora)
  finishedAt?: string;

  jobTypeId: JobTypeId;
  description: string;
  quantity: string;
  measurements: string;
  materialIds: MaterialId[];
  technique: string;
  finish: string;
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
