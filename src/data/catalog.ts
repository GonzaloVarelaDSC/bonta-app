import type { JobType, Material, Role, JobStatus, StageKey, BlockReason } from '../types';

export const ROLES: Role[] = [
  { id: 'admin', label: 'Administrador', description: 'Control total del sistema' },
  { id: 'coordinador', label: 'Coordinador / Producción', description: 'Gestiona el flujo completo de trabajos' },
  { id: 'diseno', label: 'Diseño', description: 'Trabajos asignados a diseño' },
  { id: 'produccion', label: 'Producción', description: 'Trabajos asignados a producción' },
  { id: 'instalacion', label: 'Instalación', description: 'Trabajos que requieren instalación en sitio' },
];

export const STAGE_LABELS: Record<StageKey, string> = {
  diseno: 'Diseño',
  impresion: 'Impresión',
  corte: 'Corte',
  laminado: 'Laminado',
  armado: 'Armado',
  carpinteria: 'Carpintería',
  terminacion: 'Terminación',
  control_calidad: 'Control de calidad',
  embalaje: 'Embalaje',
  instalacion: 'Instalación',
};

export const JOB_TYPES: JobType[] = [
  { id: 'impresion_uv', label: 'Impresión UV', defaultStages: ['diseno', 'impresion', 'corte', 'control_calidad', 'embalaje'] },
  { id: 'bajo_acrilico', label: 'Bajo acrílico', defaultStages: ['diseno', 'impresion', 'corte', 'terminacion', 'control_calidad', 'embalaje'] },
  { id: 'plotter_vinilo', label: 'Plotter / Vinilo', defaultStages: ['diseno', 'impresion', 'corte', 'control_calidad'] },
  { id: 'vidrieras', label: 'Vidrieras', defaultStages: ['diseno', 'impresion', 'corte', 'instalacion'] },
  { id: 'senaletica', label: 'Señalética', defaultStages: ['diseno', 'impresion', 'corte', 'armado', 'control_calidad', 'instalacion'] },
  { id: 'carteleria', label: 'Cartelería', defaultStages: ['diseno', 'impresion', 'corte', 'armado', 'control_calidad', 'instalacion'] },
  { id: 'letras_corporeas', label: 'Letras corpóreas', defaultStages: ['diseno', 'corte', 'armado', 'terminacion', 'control_calidad', 'instalacion'] },
  { id: 'backlight', label: 'Backlight', defaultStages: ['diseno', 'impresion', 'corte', 'armado', 'control_calidad', 'instalacion'] },
  { id: 'stands', label: 'Stands', defaultStages: ['diseno', 'impresion', 'carpinteria', 'armado', 'control_calidad', 'instalacion'] },
  { id: 'eventos', label: 'Eventos', defaultStages: ['diseno', 'impresion', 'armado', 'instalacion'] },
  { id: 'ambientacion', label: 'Ambientación', defaultStages: ['diseno', 'impresion', 'corte', 'instalacion'] },
  { id: 'carpinteria', label: 'Carpintería', defaultStages: ['diseno', 'carpinteria', 'terminacion', 'control_calidad'] },
  { id: 'acrilico', label: 'Acrílico', defaultStages: ['diseno', 'corte', 'terminacion', 'control_calidad', 'embalaje'] },
  { id: 'trofeos', label: 'Trofeos', defaultStages: ['diseno', 'impresion', 'corte', 'terminacion', 'control_calidad', 'embalaje'] },
  { id: 'impresion_3d', label: 'Impresión 3D', defaultStages: ['diseno', 'impresion', 'terminacion', 'control_calidad', 'embalaje'] },
  { id: 'piezas_especiales', label: 'Piezas especiales', defaultStages: ['diseno', 'impresion', 'corte', 'armado', 'terminacion', 'control_calidad'] },
  { id: 'otro', label: 'Otro', defaultStages: ['diseno', 'control_calidad'] },
];

export const MATERIALS: Material[] = [
  { id: 'acrilico', label: 'Acrílico' },
  { id: 'pvc', label: 'PVC' },
  { id: 'mdf', label: 'MDF' },
  { id: 'madera', label: 'Madera' },
  { id: 'metal', label: 'Metal' },
  { id: 'vidrio', label: 'Vidrio' },
  { id: 'vinilo', label: 'Vinilo' },
  { id: 'papel', label: 'Papel' },
  { id: 'tela', label: 'Tela' },
  { id: 'otros', label: 'Otros' },
];

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  falta_archivo: 'Falta archivo',
  falta_aprobacion: 'Falta aprobación',
  falta_informacion: 'Falta información',
  falta_material: 'Falta material',
  problema_maquina: 'Problema de máquina',
  problema_diseno: 'Problema de diseño',
  problema_cliente: 'Problema de cliente',
  problema_instalacion: 'Problema de instalación',
  otro: 'Otro',
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  NUEVO: 'Nuevo',
  FALTA_INFORMACION: 'Falta información',
  APROBADO: 'Aprobado',
  EN_DISENO: 'En diseño',
  DISENO_LISTO: 'Diseño listo',
  EN_PRODUCCION: 'En producción',
  EN_CONTROL_CALIDAD: 'En control de calidad',
  LISTO_PARA_ENTREGA: 'Listo para entrega',
  LISTO_PARA_INSTALACION: 'Listo para instalación',
  EN_INSTALACION: 'En instalación',
  TERMINADO: 'Terminado',
  BLOQUEADO: 'Bloqueado',
  CANCELADO: 'Cancelado',
};

// Columnas del tablero Kanban — agrupan estados afines (ver especificación).
// Orden pedido por Gonzalo: "Listo" y "Producción" primero (izquierda) porque son las
// columnas que más se consultan de un vistazo — el resto sigue el flujo de trabajo.
export const KANBAN_COLUMNS: { key: string; label: string; statuses: JobStatus[] }[] = [
  { key: 'listo', label: 'Listo', statuses: ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION'] },
  { key: 'produccion', label: 'Producción', statuses: ['EN_PRODUCCION'] },
  { key: 'nuevo', label: 'Nuevo / Por revisar', statuses: ['NUEVO', 'FALTA_INFORMACION', 'APROBADO'] },
  { key: 'diseno', label: 'Diseño', statuses: ['EN_DISENO', 'DISENO_LISTO'] },
  { key: 'terminacion', label: 'Terminación / QC', statuses: ['EN_CONTROL_CALIDAD'] },
  { key: 'instalacion', label: 'Instalación', statuses: ['EN_INSTALACION'] },
  { key: 'terminado', label: 'Terminado', statuses: ['TERMINADO'] },
];

export const QC_TEMPLATE = [
  { key: 'medidas', label: 'Medidas correctas', required: true },
  { key: 'material', label: 'Material correcto', required: true },
  { key: 'color', label: 'Color correcto', required: true },
  { key: 'impresion', label: 'Impresión correcta', required: true },
  { key: 'corte', label: 'Corte correcto', required: false },
  { key: 'terminacion', label: 'Terminación correcta', required: true },
  { key: 'cantidad', label: 'Cantidad correcta', required: true },
  { key: 'archivo', label: 'Archivo correcto (versión aprobada)', required: true },
  { key: 'danos', label: 'Sin daños', required: true },
  { key: 'embalaje', label: 'Embalaje correcto', required: false },
];
