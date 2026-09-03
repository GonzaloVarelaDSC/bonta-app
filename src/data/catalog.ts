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

// Sintetizado (26/08) alrededor de máquina/proceso real del estudio en vez de
// una "vertical" abstracta por cliente (antes eran 17 tipos tipo "Señalética"/
// "Ambientación" que en la práctica se resolvían con la misma máquina). Los 3
// de impresión son máquinas distintas a propósito — Gonzalo pidió dejarlas
// separadas. El resto de la lista es una síntesis razonable a confirmar/ajustar
// con él, no un relevamiento exhaustivo de todo lo que hace el estudio.
export const JOB_TYPES: JobType[] = [
  { id: 'impresion_v7000', label: 'Impresión V7000', defaultStages: ['diseno', 'impresion', 'corte', 'control_calidad'] },
  { id: 'impresion_s40', label: 'Impresión S40', defaultStages: ['diseno', 'impresion', 'corte', 'control_calidad'] },
  { id: 'impresion_p9000', label: 'Impresión P9000', defaultStages: ['diseno', 'impresion', 'corte', 'control_calidad'] },
  { id: 'corte_laser', label: 'Corte láser', defaultStages: ['diseno', 'corte', 'control_calidad'] },
  { id: 'corte_cnc', label: 'Corte CNC', defaultStages: ['diseno', 'corte', 'control_calidad'] },
  { id: 'corporeo', label: 'Corpóreo', defaultStages: ['diseno', 'corte', 'armado', 'terminacion', 'control_calidad', 'instalacion'] },
  { id: 'carpinteria', label: 'Carpintería', defaultStages: ['diseno', 'carpinteria', 'terminacion', 'control_calidad'] },
  { id: 'acrilico', label: 'Acrílico', defaultStages: ['diseno', 'corte', 'terminacion', 'control_calidad'] },
  { id: 'vidrieras_stands', label: 'Vidrieras y stands', defaultStages: ['diseno', 'impresion', 'armado', 'control_calidad', 'instalacion'] },
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
  PENDIENTE: 'Pendiente',
  NUEVO: 'Nuevo',
  FALTA_INFORMACION: 'Falta información',
  APROBADO: 'Aprobado',
  EN_DISENO: 'En diseño',
  DISENO_LISTO: 'Procesado',
  EN_PRODUCCION: 'En producción',
  EN_CONTROL_CALIDAD: 'En control de calidad',
  LISTO_PARA_ENTREGA: 'Listo para entrega',
  LISTO_PARA_INSTALACION: 'Listo para instalación',
  EN_INSTALACION: 'En instalación',
  TERMINADO: 'Terminado',
  BLOQUEADO: 'Bloqueado',
  CANCELADO: 'Cancelado',
};

export type ColumnTone = 'wait' | 'info' | 'norm' | 'review' | 'plan' | 'site' | 'done';

// Columnas del tablero Kanban — agrupan estados afines (ver especificación).
// Orden = cadena real de producción (pedido por Gonzalo el 25/08). Diseño y
// Producción son columnas separadas (se unieron en una primera vuelta, pero se
// pidió volver a separarlas — cada una es un tramo bien distinto del trabajo).
// `tone` le da a cada columna una identidad de color propia (antes solo había 3
// tonos repetidos entre 7 columnas): gris = no arrancado, celeste = diseño,
// dorado = producción, violeta = control de calidad, verde = listo, verde
// azulado = instalación, gris cálido = terminado/archivado.
export const KANBAN_COLUMNS: { key: string; label: string; statuses: JobStatus[]; tone: ColumnTone }[] = [
  { key: 'pendiente', label: 'Pendiente', statuses: ['PENDIENTE', 'NUEVO', 'FALTA_INFORMACION', 'APROBADO'], tone: 'wait' },
  { key: 'diseno', label: 'Diseño', statuses: ['EN_DISENO', 'DISENO_LISTO'], tone: 'info' },
  { key: 'produccion', label: 'Producción', statuses: ['EN_PRODUCCION'], tone: 'norm' },
  { key: 'control_calidad', label: 'Control de calidad', statuses: ['EN_CONTROL_CALIDAD'], tone: 'review' },
  { key: 'listo', label: 'Listo', statuses: ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION'], tone: 'plan' },
  { key: 'instalacion', label: 'Instalación', statuses: ['EN_INSTALACION'], tone: 'site' },
  { key: 'terminado', label: 'Terminado', statuses: ['TERMINADO'], tone: 'done' },
];

export const QC_TEMPLATE = [
  { key: 'medidas', label: 'Medidas correctas', required: true },
  { key: 'material', label: 'Material correcto', required: true },
  { key: 'color', label: 'Color correcto', required: true },
  { key: 'impresion', label: 'Impresión correcta', required: true },
  // Bajo acrílico se ve desde el frente pero se imprime del lado de atrás — si
  // la imagen no se espeja antes de imprimir, sale al revés y hay que rehacer
  // la pieza. Gonzalo (02/09): paso crítico, aparece en el checklist de todos
  // los trabajos (no solo los de acrílico) para no depender de acordarse.
  { key: 'espejado', label: 'Imagen espejada (si es impresión bajo acrílico)', required: true },
  { key: 'corte', label: 'Corte correcto', required: false },
  { key: 'terminacion', label: 'Terminación correcta', required: true },
  { key: 'cantidad', label: 'Cantidad correcta', required: true },
  { key: 'archivo', label: 'Archivo correcto (versión aprobada)', required: true },
  { key: 'danos', label: 'Sin daños', required: true },
  { key: 'embalaje', label: 'Embalaje correcto', required: false },
];
