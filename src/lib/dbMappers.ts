// Convierte las filas de Postgres (snake_case, normalizadas en varias tablas) al modelo
// de la app (camelCase, anidado) definido en src/types. Mantener esto separado del store
// es lo que permite que los componentes no sepan que existe una base de datos detrás.
import type {
  User, Client, Job, Comment, ActivityLogEntry, Notification, JobStage, JobFile, BlockRecord,
  QualityCheckItem, InstallationInfo, MaterialId, StageKey, SizeItem, Product,
} from '../types';

export function mapProfile(row: any): User {
  return {
    id: row.id, name: row.name, email: row.email, role: row.role,
    sector: row.sector ?? '', avatarColor: row.avatar_color ?? '#146b52', active: row.active,
    isProducer: row.is_producer ?? true,
  };
}

export function mapClient(row: any): Client {
  return {
    id: row.id, name: row.name, company: row.company ?? '', address: row.address ?? '',
    notes: row.notes ?? '', tier: row.tier ?? 'estandar',
    contacts: (row.client_contacts ?? []).map((c: any) => ({ name: c.name, phone: c.phone, email: c.email })),
  };
}

export function mapComment(row: any): Comment {
  return { id: row.id, jobId: row.job_id, userId: row.user_id, text: row.text, mentions: row.mentions ?? [], createdAt: row.created_at };
}

export function mapActivity(row: any): ActivityLogEntry {
  return { id: row.id, jobId: row.job_id, userId: row.user_id, action: row.action, detail: row.detail, createdAt: row.created_at };
}

export function mapNotification(row: any): Notification {
  return { id: row.id, userId: row.user_id, jobId: row.job_id ?? undefined, text: row.text, read: row.read, createdAt: row.created_at };
}

function mapStage(row: any): JobStage {
  return { key: row.key as StageKey, label: row.label, active: row.active, status: row.status, assignedUserId: row.assigned_user_id ?? undefined };
}

function mapFile(row: any): JobFile {
  return {
    id: row.id, logicalName: row.logical_name, kind: row.kind,
    versions: (row.file_versions ?? [])
      .map((v: any) => ({ id: v.id, version: v.version, fileName: v.file_name, sizeKb: v.size_kb, uploadedBy: v.uploaded_by, uploadedAt: v.uploaded_at, approved: v.approved }))
      .sort((a: any, b: any) => a.version - b.version),
  };
}

function mapBlock(row: any): BlockRecord {
  return { id: row.id, reason: row.reason, description: row.description, openedBy: row.opened_by, openedAt: row.opened_at, closedAt: row.closed_at ?? undefined };
}

function mapQc(row: any): QualityCheckItem {
  return { key: row.key, label: row.label, required: row.required, checked: row.checked };
}

function mapInstallation(row: any): InstallationInfo | undefined {
  if (!row) return undefined;
  return {
    address: row.address ?? '', contactName: row.contact_name ?? '', contactPhone: row.contact_phone ?? '',
    date: row.install_date ?? undefined, time: row.install_time ?? undefined,
    assignedUserIds: (row.installation_assigned_users ?? []).map((a: any) => a.user_id),
    notes: row.notes ?? '', completed: row.completed, completedAt: row.completed_at ?? undefined, completedNotes: row.completed_notes ?? undefined,
  };
}

/** Espera una fila de `jobs` con los embeds de 001/002 (ver lib/supabaseQueries.ts). */
export function mapJob(row: any): Job {
  return {
    id: row.id, code: row.code ?? null, name: row.name, clientId: row.client_id, contactName: row.contact_name ?? '',
    contactPhone: row.contact_phone ?? '',
    createdByUserId: row.created_by_user_id ?? null,
    responsibleUserId: row.responsible_user_id,
    assignedUserIds: (row.job_assigned_users ?? []).map((a: any) => a.user_id),
    createdAt: row.created_at, requestedDate: row.requested_date ?? row.committed_date, committedDate: row.committed_date,
    finishedAt: row.finished_at ?? undefined,
    readyAt: row.ready_at ?? undefined,
    jobTypeId: row.job_type_id, description: row.description ?? '', quantity: row.quantity ?? '',
    measurements: row.measurements ?? '', sizeItems: (row.size_items ?? []) as SizeItem[],
    materialIds: (row.material_ids ?? []) as MaterialId[],
    products: (row.products ?? []) as Product[],
    technique: row.technique ?? '', finish: row.finish ?? '', color: row.color ?? '',
    observations: row.observations ?? '', specialRequirements: row.special_requirements ?? '',
    status: row.status, stages: (row.job_stages ?? []).map(mapStage),
    priorityAuto: row.priority_auto, priorityManual: row.priority_manual ?? null,
    requiresInstallation: row.requires_installation, installation: mapInstallation(row.installations),
    qualityChecks: (row.quality_checks ?? []).map(mapQc),
    files: (row.job_files ?? []).map(mapFile),
    blockRecords: (row.block_records ?? []).map(mapBlock),
    lastActivityAt: row.last_activity_at, clientImportant: row.client_important,
  };
}
