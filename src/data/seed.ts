// NOTA: desde que la app se conectó a Supabase, este archivo ya no lo importa nada en
// tiempo de ejecución — los datos de prueba viven en supabase/005_seed_demo_data.sql.
// Se deja como referencia porque documenta el dataset original y algún día puede servir
// para un modo "demo sin backend" (ver README, sección de Fase 1 original).

import type {
  User, Client, Job, Comment, ActivityLogEntry, Notification, JobStage, StageKey,
} from '../types';
import { JOB_TYPES, QC_TEMPLATE, STAGE_LABELS } from './catalog';
import { calculateAutoPriority } from '../lib/priority';

// ---------- Usuarios ----------
export const USERS: User[] = [
  { id: 'u-marcela', name: 'Marcela Bonta', email: 'marcela@estudiobonta.com', role: 'admin', sector: 'Dirección', avatarColor: '#0f4c3a', active: true },
  { id: 'u-juan', name: 'Juan Pérez', email: 'juan@estudiobonta.com', role: 'coordinador', sector: 'Coordinación', avatarColor: '#146b52', active: true },
  { id: 'u-maria', name: 'María Gómez', email: 'maria@estudiobonta.com', role: 'diseno', sector: 'Diseño', avatarColor: '#7c3aed', active: true },
  { id: 'u-lucia', name: 'Lucía Fernández', email: 'lucia@estudiobonta.com', role: 'diseno', sector: 'Diseño', avatarColor: '#9333ea', active: true },
  { id: 'u-pedro', name: 'Pedro Ramírez', email: 'pedro@estudiobonta.com', role: 'produccion', sector: 'Producción', avatarColor: '#c2410c', active: true },
  { id: 'u-diego', name: 'Diego Sosa', email: 'diego@estudiobonta.com', role: 'produccion', sector: 'Producción', avatarColor: '#b45309', active: true },
  { id: 'u-nahuel', name: 'Nahuel Torres', email: 'nahuel@estudiobonta.com', role: 'instalacion', sector: 'Instalación', avatarColor: '#0369a1', active: true },
  { id: 'u-gonzalo', name: 'Gonzalo Varela', email: 'gonzalo@estudiobonta.com', role: 'coordinador', sector: 'Diseño Industrial / Producción', avatarColor: '#0f4c3a', active: true },
];

export function userById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

// ---------- Clientes ----------
export const CLIENTS: Client[] = [
  { id: 'c-lacoste', name: 'Lacoste', company: 'Lacoste Argentina', tier: 'prioritario', address: 'Av. Alvear 1883, CABA',
    contacts: [{ name: 'Sofía Márquez', phone: '11-4444-1122', email: 'sofia.marquez@lacoste.com.ar' }], notes: 'Cliente de marca — estándares de instalación estrictos en todas las sucursales.' },
  { id: 'c-subway', name: 'Subway', company: 'Subway Argentina', tier: 'prioritario', address: 'Av. Corrientes 3247, CABA',
    contacts: [{ name: 'Ramiro Díaz', phone: '11-5566-8899', email: 'rdiaz@subway-ar.com' }], notes: 'Rollout de cartelería en varias sucursales simultáneas.' },
  { id: 'c-galicia', name: 'Banco Galicia', company: 'Banco Galicia', tier: 'prioritario', address: 'Tte. Gral. J. D. Perón 407, CABA',
    contacts: [{ name: 'Valentina Ríos', phone: '11-4321-0099', email: 'valentina.rios@bancogalicia.com' }], notes: 'Señalética interior de sucursales — requiere aprobación de marca corporativa.' },
  { id: 'c-victoriasecret', name: "Victoria's Secret", company: "Victoria's Secret Argentina", tier: 'prioritario', address: 'Av. Santa Fe 3253, CABA',
    contacts: [{ name: 'Camila Suárez', phone: '11-2233-4455', email: 'camila.suarez@vs-ar.com' }], notes: 'Vidrieras de temporada — fechas de cambio muy ajustadas.' },
  { id: 'c-carrefour', name: 'Carrefour', company: 'Carrefour Argentina', tier: 'estandar', address: 'Av. Rivadavia 8620, CABA',
    contacts: [{ name: 'Martín Acosta', phone: '11-6677-8800', email: 'martin.acosta@carrefour.com.ar' }], notes: 'Cartelería de precios e indicadores de sucursal.' },
  { id: 'c-farmaplus', name: 'Farmaplus', company: 'Farmaplus S.A.', tier: 'estandar', address: 'Av. Cabildo 2140, CABA',
    contacts: [{ name: 'Estela Núñez', phone: '11-3344-5566', email: 'estela@farmaplus.com.ar' }], notes: 'Cadena de farmacias — letreros backlight e identificación de local.' },
  { id: 'c-sinteplast', name: 'Sinteplast', company: 'Sinteplast S.A.', tier: 'estandar', address: 'Parque Industrial, San Luis',
    contacts: [{ name: 'Hernán López', phone: '266-444-5522', email: 'hlopez@sinteplast.com' }], notes: 'Stands para exposiciones de pinturería.' },
];

function clientById(id: string) { return CLIENTS.find((c) => c.id === id)!; }

// ---------- Helpers de fechas relativas a "ahora" ----------
const NOW = new Date();
function hoursFromNow(h: number): string {
  return new Date(NOW.getTime() + h * 3_600_000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString();
}

function makeStages(keys: StageKey[], doneCount: number, inProgressKey?: StageKey): JobStage[] {
  return keys.map((k, i) => ({
    key: k,
    label: STAGE_LABELS[k],
    active: true,
    status: i < doneCount ? 'terminado' : k === inProgressKey ? 'en_progreso' : 'pendiente',
  }));
}

function qc(overrides: Record<string, boolean> = {}) {
  return QC_TEMPLATE.map((q) => ({ ...q, checked: overrides[q.key] ?? false }));
}

interface Seed {
  code: string; name: string; clientId: string; contactName: string;
  responsibleUserId: string; assignedUserIds: string[]; jobTypeId: Job['jobTypeId'];
  description: string; quantity: string; measurements: string; materialIds: Job['materialIds'];
  technique: string; finish: string; color: string; observations: string;
  createdDaysAgo: number; committedInHours: number; status: Job['status'];
  stagesDone: number; stageInProgress?: StageKey;
  requiresInstallation?: boolean; installAddress?: string;
  blocked?: { reason: Job['blockRecords'][0]['reason']; description: string; hoursAgo: number };
  clientImportant?: boolean;
  lastActivityHoursAgo: number;
  fileApproved?: boolean;
}

const S: Seed[] = [
  { code: 'TRB-2026-00458', name: '20 carteles de sucursal', clientId: 'c-lacoste', contactName: 'Sofía Márquez',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-diego', 'u-pedro'], jobTypeId: 'carteleria',
    description: '20 carteles de fachada para relanzamiento de sucursales AMBA.', quantity: '20 unidades', measurements: '150x60 cm',
    materialIds: ['pvc', 'vinilo'], technique: 'Impresión UV + corte', finish: 'Laminado mate', color: 'Verde Lacoste + blanco',
    observations: 'Coordinar entrega escalonada por sucursal.', createdDaysAgo: 4, committedInHours: 6, status: 'EN_PRODUCCION',
    stagesDone: 2, stageInProgress: 'impresion', requiresInstallation: true, installAddress: 'Múltiples sucursales AMBA',
    clientImportant: true, lastActivityHoursAgo: 1, fileApproved: true },

  { code: 'TRB-2026-00459', name: 'Vidriera temporada primavera', clientId: 'c-victoriasecret', contactName: 'Camila Suárez',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-maria', 'u-nahuel'], jobTypeId: 'vidrieras',
    description: 'Vinilado de vidriera con nueva campaña de temporada.', quantity: '1 vidriera', measurements: '4.20 x 2.60 m',
    materialIds: ['vinilo'], technique: 'Plotter + corte', finish: 'Vinilo autoadhesivo', color: 'Full color',
    observations: 'Instalación fuera de horario comercial.', createdDaysAgo: 1, committedInHours: 3, status: 'BLOQUEADO',
    stagesDone: 1, stageInProgress: 'impresion', requiresInstallation: true, installAddress: 'Av. Santa Fe 3253, CABA',
    blocked: { reason: 'falta_aprobacion', description: 'Cliente todavía no aprobó el arte final de la vidriera.', hoursAgo: 5 },
    clientImportant: true, lastActivityHoursAgo: 5 },

  { code: 'TRB-2026-00460', name: 'Señalética interior sucursal Congreso', clientId: 'c-galicia', contactName: 'Valentina Ríos',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-lucia'], jobTypeId: 'senaletica',
    description: 'Cartelería direccional y de cajeros para sucursal remodelada.', quantity: '14 piezas', measurements: 'Varias',
    materialIds: ['acrilico', 'pvc'], technique: 'Impresión UV', finish: 'Corte a medida', color: 'Paleta corporativa Galicia',
    observations: 'Requiere aprobación de marca antes de producción.', createdDaysAgo: 6, committedInHours: 22, status: 'EN_DISENO',
    stagesDone: 0, stageInProgress: 'diseno', clientImportant: true, lastActivityHoursAgo: 3 },

  { code: 'TRB-2026-00461', name: 'Cartelería de precios góndola', clientId: 'c-carrefour', contactName: 'Martín Acosta',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-pedro'], jobTypeId: 'plotter_vinilo',
    description: 'Reposición mensual de cartelería de precios.', quantity: '80 unidades', measurements: '30x20 cm',
    materialIds: ['papel'], technique: 'Impresión digital', finish: 'Sin laminar', color: 'Full color',
    observations: '', createdDaysAgo: 2, committedInHours: 96, status: 'APROBADO',
    stagesDone: 0, lastActivityHoursAgo: 20 },

  { code: 'TRB-2026-00462', name: 'Letras corpóreas iluminadas fachada', clientId: 'c-farmaplus', contactName: 'Estela Núñez',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-maria', 'u-diego'], jobTypeId: 'letras_corporeas',
    description: 'Logo corpóreo con iluminación LED para nuevo local.', quantity: '1 set (8 letras)', measurements: 'Altura 60 cm',
    materialIds: ['metal', 'acrilico'], technique: 'Corte láser + armado', finish: 'Pintura + LED backlight', color: 'Verde Farmaplus',
    observations: 'Verificar acometida eléctrica en el local.', createdDaysAgo: 10, committedInHours: 140, status: 'EN_PRODUCCION',
    stagesDone: 2, stageInProgress: 'armado', requiresInstallation: true, installAddress: 'Av. Cabildo 2140, CABA', lastActivityHoursAgo: 30 },

  { code: 'TRB-2026-00463', name: 'Stand feria Pinturería Expo', clientId: 'c-sinteplast', contactName: 'Hernán López',
    responsibleUserId: 'u-gonzalo', assignedUserIds: ['u-gonzalo', 'u-diego', 'u-pedro'], jobTypeId: 'stands',
    description: 'Stand de 6x4m para feria del sector, estructura + gráfica + mobiliario.', quantity: '1 stand', measurements: '6x4 m',
    materialIds: ['mdf', 'vinilo'], technique: 'Carpintería + impresión UV', finish: 'Pintura + gráfica adhesivada', color: 'Paleta Sinteplast',
    observations: 'Desarmable, se traslada en camión propio.', createdDaysAgo: 15, committedInHours: 240, status: 'EN_PRODUCCION',
    stagesDone: 1, stageInProgress: 'carpinteria', requiresInstallation: true, installAddress: 'La Rural, CABA (montaje in situ)', lastActivityHoursAgo: 8 },

  { code: 'TRB-2026-00464', name: 'Trofeos torneo interno', clientId: 'c-sinteplast', contactName: 'Hernán López',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-lucia'], jobTypeId: 'trofeos',
    description: '30 trofeos termoformados con grabado de sponsor.', quantity: '30 unidades', measurements: '25 cm alto',
    materialIds: ['acrilico'], technique: 'Termoformado + grabado', finish: 'Base metálica', color: 'Transparente',
    observations: '', createdDaysAgo: 3, committedInHours: 200, status: 'DISENO_LISTO', stagesDone: 1, lastActivityHoursAgo: 14 },

  { code: 'TRB-2026-00465', name: 'Prototipo packaging 3D', clientId: 'c-farmaplus', contactName: 'Estela Núñez',
    responsibleUserId: 'u-maria', assignedUserIds: ['u-maria'], jobTypeId: 'impresion_3d',
    description: 'Prototipo de dispenser de mostrador para evaluación interna.', quantity: '2 unidades', measurements: '18x12x10 cm',
    materialIds: ['otros'], technique: 'Impresión 3D FDM', finish: 'Lijado', color: 'Blanco',
    observations: 'Es exploratorio, sin fecha comprometida crítica.', createdDaysAgo: 1, committedInHours: 168, status: 'NUEVO',
    stagesDone: 0, lastActivityHoursAgo: 20 },

  { code: 'TRB-2026-00466', name: 'Backlight cartel de local', clientId: 'c-farmaplus', contactName: 'Estela Núñez',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-diego'], jobTypeId: 'backlight',
    description: 'Cartel backlight de fachada para nueva sucursal.', quantity: '1 unidad', measurements: '3x1 m',
    materialIds: ['acrilico', 'metal'], technique: 'Impresión UV + armado', finish: 'Marco de aluminio', color: 'Verde/blanco',
    observations: '', createdDaysAgo: 8, committedInHours: -20, status: 'EN_CONTROL_CALIDAD', stagesDone: 3,
    lastActivityHoursAgo: 26 }, // atrasado

  { code: 'TRB-2026-00467', name: 'Ambientación local temporada', clientId: 'c-victoriasecret', contactName: 'Camila Suárez',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-maria', 'u-nahuel'], jobTypeId: 'ambientacion',
    description: 'Gráfica de piso y probadores para campaña de temporada.', quantity: '12 piezas', measurements: 'Varias',
    materialIds: ['vinilo'], technique: 'Impresión + corte', finish: 'Antideslizante', color: 'Full color',
    observations: '', createdDaysAgo: 2, committedInHours: 50, status: 'EN_DISENO', stagesDone: 0, stageInProgress: 'diseno',
    clientImportant: true, lastActivityHoursAgo: 4 },

  { code: 'TRB-2026-00468', name: 'Piezas especiales exhibidor', clientId: 'c-lacoste', contactName: 'Sofía Márquez',
    responsibleUserId: 'u-gonzalo', assignedUserIds: ['u-gonzalo'], jobTypeId: 'piezas_especiales',
    description: 'Exhibidor a medida en acrílico plegado para mostrador.', quantity: '15 unidades', measurements: '30x20x15 cm',
    materialIds: ['acrilico'], technique: 'Corte + plegado', finish: 'Pulido', color: 'Transparente',
    observations: 'Diseño industrial a cargo de Gonzalo — pieza nueva, sin antecedente.', createdDaysAgo: 5, committedInHours: 90,
    status: 'EN_DISENO', stagesDone: 0, stageInProgress: 'diseno', clientImportant: true, lastActivityHoursAgo: 2 },

  { code: 'TRB-2026-00469', name: 'Vinilos flota de vehículos', clientId: 'c-subway', contactName: 'Ramiro Díaz',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-pedro', 'u-diego'], jobTypeId: 'plotter_vinilo',
    description: 'Rotulado de 4 vehículos de delivery con nueva gráfica.', quantity: '4 vehículos', measurements: 'Kit completo por vehículo',
    materialIds: ['vinilo'], technique: 'Plotter de corte', finish: 'Laminado UV', color: 'Amarillo/verde Subway',
    observations: '', createdDaysAgo: 1, committedInHours: 4, status: 'EN_PRODUCCION', stagesDone: 1, stageInProgress: 'corte',
    clientImportant: true, lastActivityHoursAgo: 2 },

  { code: 'TRB-2026-00470', name: 'Cartel bajo acrílico placa institucional', clientId: 'c-galicia', contactName: 'Valentina Ríos',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-pedro'], jobTypeId: 'bajo_acrilico',
    description: 'Placa institucional para hall de sucursal central.', quantity: '1 unidad', measurements: '80x60 cm',
    materialIds: ['acrilico'], technique: 'Impresión bajo acrílico', finish: 'Marco premium', color: 'Full color + dorado',
    observations: '', createdDaysAgo: 12, committedInHours: 300, status: 'APROBADO', stagesDone: 0,
    lastActivityHoursAgo: 60 },

  { code: 'TRB-2026-00471', name: 'Gráfica evento lanzamiento', clientId: 'c-subway', contactName: 'Ramiro Díaz',
    responsibleUserId: 'u-gonzalo', assignedUserIds: ['u-gonzalo', 'u-nahuel'], jobTypeId: 'eventos',
    description: 'Backdrop, banners y señalética para evento de lanzamiento de producto.', quantity: '1 set completo',
    measurements: 'Backdrop 4x3m + 6 banners', materialIds: ['vinilo', 'tela'], technique: 'Impresión + armado', finish: 'Estructura desarmable',
    color: 'Paleta Subway', observations: 'Evento con fecha fija, no se puede mover.', createdDaysAgo: 3, committedInHours: 18,
    status: 'EN_PRODUCCION', stagesDone: 1, stageInProgress: 'impresion', requiresInstallation: true, installAddress: 'Centro de convenciones, CABA',
    clientImportant: true, lastActivityHoursAgo: 3 },

  { code: 'TRB-2026-00472', name: 'Reposición vinilo dañado vidriera', clientId: 'c-carrefour', contactName: 'Martín Acosta',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-diego'], jobTypeId: 'vidrieras',
    description: 'Reposición de vinilo de vidriera dañado por clima.', quantity: '1 pieza', measurements: '2x1.5 m',
    materialIds: ['vinilo'], technique: 'Plotter', finish: 'Laminado', color: 'Full color', observations: '',
    createdDaysAgo: 0, committedInHours: 2, status: 'NUEVO', stagesDone: 0, requiresInstallation: true,
    installAddress: 'Av. Rivadavia 8620, CABA', lastActivityHoursAgo: 0.5 },

  { code: 'TRB-2026-00473', name: 'Cartel MDF pintado local nuevo', clientId: 'c-farmaplus', contactName: 'Estela Núñez',
    responsibleUserId: 'u-juan', assignedUserIds: [], jobTypeId: 'carteleria',
    description: 'Hacer cartelería para el local nuevo.', quantity: '', measurements: '', materialIds: [], technique: '', finish: '',
    color: '', observations: 'Pedido tomado por teléfono — falta especificar casi todo.', createdDaysAgo: 0, committedInHours: 20,
    status: 'FALTA_INFORMACION', stagesDone: 0, lastActivityHoursAgo: 0.2 },

  { code: 'TRB-2026-00474', name: 'Corte láser piezas MDF exhibidor', clientId: 'c-sinteplast', contactName: 'Hernán López',
    responsibleUserId: 'u-gonzalo', assignedUserIds: ['u-gonzalo', 'u-pedro'], jobTypeId: 'piezas_especiales',
    description: 'Piezas de exhibidor de mostrador cortadas en CNC/láser, ensamble a presión.', quantity: '8 sets', measurements: '40x30 cm por set',
    materialIds: ['mdf'], technique: 'Router CNC', finish: 'Pintura', color: 'Blanco', observations: 'Primer prototipo antes de serie.',
    createdDaysAgo: 2, committedInHours: 130, status: 'APROBADO', stagesDone: 0, lastActivityHoursAgo: 40 },

  { code: 'TRB-2026-00475', name: 'Cartel backlight cancelado por cliente', clientId: 'c-galicia', contactName: 'Valentina Ríos',
    responsibleUserId: 'u-juan', assignedUserIds: [], jobTypeId: 'backlight',
    description: 'Cartel backlight — proyecto dado de baja por el cliente.', quantity: '1 unidad', measurements: '2x1 m',
    materialIds: ['acrilico'], technique: 'Impresión UV', finish: '', color: '', observations: 'Cliente canceló el proyecto.',
    createdDaysAgo: 20, committedInHours: -100, status: 'CANCELADO', stagesDone: 0, lastActivityHoursAgo: 96 },

  { code: 'TRB-2026-00476', name: 'Vidriera navideña — control final', clientId: 'c-lacoste', contactName: 'Sofía Márquez',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-nahuel'], jobTypeId: 'vidrieras',
    description: 'Últimos retoques y control de calidad antes de instalación.', quantity: '1 vidriera', measurements: '4x2.5 m',
    materialIds: ['vinilo'], technique: 'Plotter + corte', finish: 'Laminado', color: 'Full color', observations: '',
    createdDaysAgo: 9, committedInHours: 8, status: 'LISTO_PARA_INSTALACION', stagesDone: 5, requiresInstallation: true,
    installAddress: 'Av. Alvear 1883, CABA', clientImportant: true, lastActivityHoursAgo: 5, fileApproved: true },

  { code: 'TRB-2026-00477', name: 'Cartel de piso entregado', clientId: 'c-carrefour', contactName: 'Martín Acosta',
    responsibleUserId: 'u-juan', assignedUserIds: ['u-pedro'], jobTypeId: 'plotter_vinilo',
    description: 'Cartelería de piso para promoción — ya entregada.', quantity: '25 unidades', measurements: '40x40 cm',
    materialIds: ['vinilo'], technique: 'Impresión digital', finish: 'Antideslizante', color: 'Full color', observations: '',
    createdDaysAgo: 14, committedInHours: -80, status: 'TERMINADO', stagesDone: 4, lastActivityHoursAgo: 70, fileApproved: true },
];

function buildStages(jobTypeId: Job['jobTypeId'], requiresInstallation: boolean, doneCount: number, inProgress?: StageKey): JobStage[] {
  const base = JOB_TYPES.find((t) => t.id === jobTypeId)!.defaultStages;
  const keys = requiresInstallation && !base.includes('instalacion') ? [...base, 'instalacion' as StageKey] : base;
  return makeStages(keys, doneCount, inProgress);
}

export const JOBS: Job[] = S.map((s, idx) => {
  const status = s.status;
  const stages = buildStages(s.jobTypeId, !!s.requiresInstallation, s.stagesDone, s.stageInProgress);
  const files: Job['files'] = s.fileApproved !== undefined ? [{
    id: `f-${idx}`, logicalName: 'archivo_final', kind: 'PDF',
    versions: [
      { id: `fv-${idx}-1`, version: 1, fileName: 'archivo_final_v1.pdf', sizeKb: 4200, uploadedBy: 'u-maria', uploadedAt: daysAgo(s.createdDaysAgo - 0.5), approved: false },
      { id: `fv-${idx}-2`, version: 2, fileName: s.fileApproved ? 'archivo_final_aprobado.pdf' : 'archivo_final_v2.pdf', sizeKb: 4350, uploadedBy: 'u-juan', uploadedAt: daysAgo(Math.max(s.createdDaysAgo - 1, 0)), approved: !!s.fileApproved },
    ],
  }] : [];

  const job: Job = {
    id: `job-${idx}`,
    code: s.code,
    name: s.name,
    clientId: s.clientId,
    contactName: s.contactName,
    contactPhone: '',
    createdByUserId: s.responsibleUserId,
    responsibleUserId: s.responsibleUserId,
    assignedUserIds: s.assignedUserIds,
    createdAt: daysAgo(s.createdDaysAgo),
    requestedDate: hoursFromNow(s.committedInHours - 4),
    committedDate: hoursFromNow(s.committedInHours),
    jobTypeId: s.jobTypeId,
    description: s.description,
    quantity: s.quantity,
    measurements: s.measurements,
    materialIds: s.materialIds,
    technique: s.technique,
    finish: s.finish,
    color: s.color,
    observations: s.observations,
    specialRequirements: '',
    status: status as Job['status'],
    stages,
    priorityAuto: 'NORMAL',
    priorityManual: null,
    requiresInstallation: !!s.requiresInstallation,
    installation: s.requiresInstallation ? {
      address: s.installAddress ?? '',
      contactName: s.contactName,
      contactPhone: clientById(s.clientId).contacts[0]?.phone ?? '',
      date: hoursFromNow(s.committedInHours).slice(0, 10),
      time: '10:00',
      assignedUserIds: s.assignedUserIds.filter((id) => userById(id)?.role === 'instalacion' || id === 'u-nahuel'),
      notes: '',
      completed: status === 'TERMINADO',
      completedAt: status === 'TERMINADO' ? daysAgo(s.lastActivityHoursAgo / 24) : undefined,
      completedNotes: status === 'TERMINADO' ? 'Instalación realizada sin observaciones.' : undefined,
    } : undefined,
    qualityChecks: qc(status === 'TERMINADO' || status === 'LISTO_PARA_INSTALACION' || status === 'LISTO_PARA_ENTREGA'
      ? { medidas: true, material: true, color: true, impresion: true, terminacion: true, cantidad: true, archivo: true, danos: true }
      : {}),
    files,
    blockRecords: s.blocked ? [{
      id: `b-${idx}`, reason: s.blocked.reason, description: s.blocked.description,
      openedBy: 'u-juan', openedAt: hoursFromNow(-s.blocked.hoursAgo),
    }] : [],
    lastActivityAt: hoursFromNow(-s.lastActivityHoursAgo),
    clientImportant: !!s.clientImportant,
  };
  return job;
});

// Calcula la prioridad automática de cada trabajo y fuerza dos casos a "prioridad manual"
// para que se vea en el demo la diferencia entre calculada y editada a mano.
JOBS.forEach((j) => { j.priorityAuto = calculateAutoPriority(j); });
JOBS.find((j) => j.code === 'TRB-2026-00463')!.priorityManual = 'URGENTE'; // Gonzalo subió prioridad del stand
JOBS.find((j) => j.code === 'TRB-2026-00465')!.priorityManual = 'EN_ESPERA'; // prototipo exploratorio, bajado a propósito

// ---------- Comentarios ----------
export const COMMENTS: Comment[] = [
  { id: 'cm-1', jobId: 'job-0', userId: 'u-maria', text: 'Falta confirmar el color del acrílico del zócalo.', mentions: [], createdAt: hoursFromNow(-3) },
  { id: 'cm-2', jobId: 'job-0', userId: 'u-juan', text: 'Confirmado: verde Lacoste estándar, ficha de marca adjunta.', mentions: [], createdAt: hoursFromNow(-2.5) },
  { id: 'cm-3', jobId: 'job-0', userId: 'u-pedro', text: '@Producción arrancamos con la primera tanda de 8 carteles hoy.', mentions: ['u-diego'], createdAt: hoursFromNow(-1) },
  { id: 'cm-4', jobId: 'job-1', userId: 'u-nahuel', text: 'Quedamos bloqueados hasta que el cliente apruebe el arte — @Coordinación avisen apenas confirmen.', mentions: ['u-juan'], createdAt: hoursFromNow(-5) },
  { id: 'cm-5', jobId: 'job-1', userId: 'u-juan', text: 'Ya envié el recordatorio por WhatsApp, esperando respuesta.', mentions: [], createdAt: hoursFromNow(-4) },
  { id: 'cm-6', jobId: 'job-10', userId: 'u-gonzalo', text: 'Primera propuesta de plegado lista, la subo para revisión.', mentions: [], createdAt: hoursFromNow(-2) },
];

// ---------- Historial ----------
export const ACTIVITY_LOG: ActivityLogEntry[] = [
  { id: 'al-1', jobId: 'job-0', userId: 'u-juan', action: 'crear', detail: 'Creó el trabajo.', createdAt: daysAgo(4) },
  { id: 'al-2', jobId: 'job-0', userId: 'u-juan', action: 'prioridad', detail: 'Cambió prioridad de NORMAL a URGENTE.', createdAt: daysAgo(3.5) },
  { id: 'al-3', jobId: 'job-0', userId: 'u-maria', action: 'archivo', detail: 'Subió archivo_final_v2.pdf.', createdAt: daysAgo(3) },
  { id: 'al-4', jobId: 'job-0', userId: 'u-juan', action: 'aprobacion', detail: 'Aprobó archivo_final_v2.pdf para producción.', createdAt: daysAgo(2.8) },
  { id: 'al-5', jobId: 'job-0', userId: 'u-pedro', action: 'estado', detail: 'Producción inició el trabajo.', createdAt: daysAgo(2) },
  { id: 'al-6', jobId: 'job-1', userId: 'u-nahuel', action: 'bloqueo', detail: 'Bloqueó el trabajo — falta aprobación del cliente.', createdAt: hoursFromNow(-5) },
];

// ---------- Notificaciones ----------
export const NOTIFICATIONS: Notification[] = [
  { id: 'n-1', userId: 'u-gonzalo', jobId: 'job-10', text: 'Te mencionaron en TRB-2026-00468.', read: false, createdAt: hoursFromNow(-2) },
  { id: 'n-2', userId: 'u-gonzalo', jobId: 'job-13', text: 'Nuevo trabajo asignado: TRB-2026-00471.', read: false, createdAt: hoursFromNow(-3) },
  { id: 'n-3', userId: 'u-gonzalo', jobId: 'job-4', text: 'TRB-2026-00462 pasó a EN_PRODUCCION.', read: true, createdAt: daysAgo(1) },
  { id: 'n-4', userId: 'u-juan', jobId: 'job-1', text: 'TRB-2026-00459 está bloqueado — falta aprobación del cliente.', read: false, createdAt: hoursFromNow(-5) },
  { id: 'n-5', userId: 'u-juan', jobId: 'job-8', text: 'TRB-2026-00466 está atrasado.', read: false, createdAt: hoursFromNow(-1) },
];
