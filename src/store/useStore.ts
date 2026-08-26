import { create } from 'zustand';
import type {
  User, Job, Comment, ActivityLogEntry, Notification, Priority, JobStatus,
  BlockReason, StageKey, StageStatus,
} from '../types';
import { supabase } from '../lib/supabaseClient';
import { fetchAllJobs, fetchJobById } from '../lib/supabaseQueries';
import { mapProfile, mapClient, mapComment, mapActivity, mapNotification } from '../lib/dbMappers';
import { JOB_TYPES, QC_TEMPLATE, STAGE_LABELS } from '../data/catalog';
import type { Client } from '../types';

/** El número de trabajo puede no estar cargado todavía — para mensajes/logs mostramos el nombre igual. */
function jobLabel(job: Pick<Job, 'code' | 'name'>): string {
  return job.code ? `${job.code} — ${job.name}` : job.name;
}

interface StoreState {
  authReady: boolean;
  dataLoading: boolean;
  loadError: string | null;
  currentUser: User | null;
  users: User[];
  clients: Client[];
  jobs: Job[];
  comments: Comment[];
  activityLog: ActivityLogEntry[];
  notifications: Notification[];

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  findOrCreateClient: (name: string) => Promise<string>;
  createJob: (input: NewJobInput) => Promise<Job>;
  setStatus: (jobId: string, status: JobStatus, movedByUserId: string) => Promise<void>;
  setJobCode: (jobId: string, code: string, byUserId: string) => Promise<void>;
  setPriority: (jobId: string, priority: Priority | null, byUserId: string) => Promise<void>;
  assignJob: (jobId: string, assignedUserIds: string[], responsibleUserId: string, byUserId: string) => Promise<void>;
  addComment: (jobId: string, userId: string, text: string, mentions: string[]) => Promise<void>;
  blockJob: (jobId: string, reason: BlockReason, description: string, byUserId: string) => Promise<void>;
  unblockJob: (jobId: string, byUserId: string) => Promise<void>;
  setStageStatus: (jobId: string, stageKey: StageKey, status: StageStatus, byUserId: string) => Promise<void>;
  addFileVersion: (jobId: string, fileName: string, byUserId: string) => Promise<void>;
  approveFileVersion: (jobId: string, fileId: string, versionId: string, byUserId: string) => Promise<void>;
  toggleQualityCheck: (jobId: string, key: string, byUserId: string) => Promise<void>;
  completeInstallation: (jobId: string, notes: string, byUserId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  setUserActive: (userId: string, active: boolean) => Promise<void>;
  resetDemoData: () => Promise<void>;
  loadJobComments: (jobId: string) => Promise<void>;
  loadJobActivity: (jobId: string) => Promise<void>;
}

export interface NewJobInput {
  name: string; clientId: string; contactName: string; contactPhone: string;
  jobTypeId: Job['jobTypeId']; description: string;
  committedDate: string; priorityManual: Priority | null; clientImportant: boolean;
  quantity: string; measurements: string; materialIds: Job['materialIds'];
  technique: string; finish: string; color: string; observations: string; specialRequirements: string;
  activeStageKeys: StageKey[];
  requiresInstallation: boolean; installAddress: string; installContactPhone: string; installDate: string;
  createdByUserId: string; responsibleUserId: string; assignedUserIds: string[];
}

async function insertActivity(
  set: (fn: (s: StoreState) => Partial<StoreState>) => void,
  jobId: string, userId: string, action: string, detail: string
): Promise<ActivityLogEntry> {
  const { data, error } = await supabase.from('activity_log').insert({ job_id: jobId, user_id: userId, action, detail }).select().single();
  if (error) throw error;
  const entry = mapActivity(data);
  set((s) => ({ activityLog: [entry, ...s.activityLog] }));
  return entry;
}

async function insertNotifications(userIds: string[], jobId: string, text: string): Promise<Notification[]> {
  const rows = userIds.filter((id, i, arr) => arr.indexOf(id) === i).map((userId) => ({ user_id: userId, job_id: jobId, text }));
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from('notifications').insert(rows).select();
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export const useStore = create<StoreState>()((set, get) => ({
  authReady: false,
  dataLoading: false,
  loadError: null,
  currentUser: null,
  users: [],
  clients: [],
  jobs: [],
  comments: [],
  activityLog: [],
  notifications: [],

  init: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await loadCurrentUser(set);
      await get_loadAll(set, get);
    }
    set({ authReady: true });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { set({ currentUser: null }); return; }
      await loadCurrentUser(set);
      await get_loadAll(set, get);
    });

    // Actualización en vivo: cualquier cambio en "jobs" (propio o de otro usuario) refresca esa ficha.
    supabase
      .channel('jobs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, async (payload) => {
        const id = (payload.new as any)?.id ?? (payload.old as any)?.id;
        if (!id) return;
        const job = await fetchJobById(id);
        set((s) => ({ jobs: job ? [job, ...s.jobs.filter((j) => j.id !== id)] : s.jobs.filter((j) => j.id !== id) }));
      })
      .subscribe();
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const msg = error.message.includes('Invalid login') ? 'Email o contraseña incorrectos.' : error.message;
      return { ok: false, error: msg };
    }
    await loadCurrentUser(set);
    await get_loadAll(set, get);
    const user = get().currentUser;
    if (user && !user.active) {
      await supabase.auth.signOut();
      set({ currentUser: null });
      return { ok: false, error: 'Este usuario está desactivado. Consultá con un administrador.' };
    }
    return { ok: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null, jobs: [], comments: [], activityLog: [], notifications: [] });
  },

  // Busca un cliente por nombre (tal cual está tipeado, sin distinguir mayúsculas/espacios)
  // y si no existe lo crea al vuelo. Pensado para el paso 1 del wizard: el nombre real de
  // referencia vive en Copernico, acá solo evitamos que quede duplicado por variaciones de tipeo.
  findOrCreateClient: async (rawName) => {
    const name = rawName.trim();
    if (!name) throw new Error('Falta el nombre del cliente.');
    const existing = get().clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const { data, error } = await supabase.from('clients').insert({ name }).select().single();
    if (error) throw error;
    const client = mapClient(data);
    set((s) => ({ clients: [...s.clients, client].sort((a, b) => a.name.localeCompare(b.name)) }));
    return client.id;
  },

  createJob: async (input) => {
    const jobType = JOB_TYPES.find((t) => t.id === input.jobTypeId)!;
    // Falta dirección de instalación es lo único que de verdad bloquea un trabajo
    // recién creado — medidas/material/técnica se cargan después si hacen falta,
    // no ameritan nacer en "Falta información".
    const missingInstallAddress = input.requiresInstallation && !input.installAddress.trim();

    const { data: jobRow, error } = await supabase.from('jobs').insert({
      name: input.name, client_id: input.clientId, contact_name: input.contactName, contact_phone: input.contactPhone,
      created_by_user_id: input.createdByUserId,
      responsible_user_id: input.responsibleUserId, requested_date: input.committedDate, committed_date: input.committedDate,
      job_type_id: input.jobTypeId, description: input.description, quantity: input.quantity, measurements: input.measurements,
      material_ids: input.materialIds, technique: input.technique, finish: input.finish, color: input.color,
      observations: input.observations, special_requirements: input.specialRequirements,
      status: missingInstallAddress ? 'FALTA_INFORMACION' : 'PENDIENTE', priority_manual: input.priorityManual,
      requires_installation: input.requiresInstallation, client_important: input.clientImportant,
    }).select().single();
    if (error) throw error;
    const jobId = jobRow.id;

    if (input.assignedUserIds.length) {
      await supabase.from('job_assigned_users').insert(input.assignedUserIds.map((userId) => ({ job_id: jobId, user_id: userId })));
    }
    const stages = jobType.defaultStages.filter((k) => input.activeStageKeys.includes(k));
    if (stages.length) {
      await supabase.from('job_stages').insert(stages.map((k) => ({ job_id: jobId, key: k, label: STAGE_LABELS[k], active: true, status: 'pendiente' })));
    }
    await supabase.from('quality_checks').insert(QC_TEMPLATE.map((q) => ({ job_id: jobId, key: q.key, label: q.label, required: q.required, checked: false })));
    if (input.requiresInstallation) {
      await supabase.from('installations').insert({
        job_id: jobId, address: input.installAddress, contact_name: input.contactName,
        contact_phone: input.installContactPhone, install_date: input.installDate || null,
      });
    }

    await insertActivity(set, jobId, input.createdByUserId, 'crear', `Creó el trabajo — ${input.name}.`);
    await insertNotifications(input.assignedUserIds.filter((id) => id !== input.responsibleUserId), jobId, `Nuevo trabajo asignado: ${input.name}.`);

    const job = await fetchJobById(jobId);
    if (!job) throw new Error('No se pudo leer el trabajo recién creado.');
    set((s) => ({ jobs: [job, ...s.jobs] }));
    await refreshMyNotifications(set, get);
    return job;
  },

  setStatus: async (jobId, status, byUserId) => {
    const before = get().jobs.find((j) => j.id === jobId);
    const nowIso = new Date().toISOString();
    // La fecha de "quedó listo" se graba una sola vez, la primera vez que el trabajo
    // llega a Listo/Instalación — no se pisa si ya la tenía (ver tipo Job.readyAt).
    const readyStatuses: JobStatus[] = ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION', 'EN_INSTALACION'];
    const stampReady = readyStatuses.includes(status) && !before?.readyAt;
    // Optimista: refleja el cambio ya mismo (clave para que el drag&drop del kanban se sienta instantáneo)
    // y lo revierte si Supabase lo rechaza (por ejemplo, la regla de control de calidad obligatorio).
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, status, lastActivityAt: nowIso, ...(stampReady ? { readyAt: nowIso } : {}) } : j) }));
    const { error } = await supabase.from('jobs').update({ status, last_activity_at: nowIso, ...(stampReady ? { ready_at: nowIso } : {}) }).eq('id', jobId);
    if (error) {
      if (before) set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? before : j) }));
      throw error;
    }
    await insertActivity(set, jobId, byUserId, 'estado', `Cambió el estado a ${status}.`);
    if (before) await insertNotifications([before.responsibleUserId, ...before.assignedUserIds].filter((id) => id !== byUserId), jobId, `${jobLabel(before)} pasó a ${status}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  setJobCode: async (jobId, code, byUserId) => {
    const before = get().jobs.find((j) => j.id === jobId)!;
    const trimmed = code.trim();
    if (!trimmed || trimmed === before.code) return;
    const { error } = await supabase.from('jobs').update({ code: trimmed, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error.code === '23505' ? new Error('Ya existe otro trabajo con ese número.') : error;
    await insertActivity(set, jobId, byUserId, 'numero', `Cambió el número de trabajo de "${before.code ?? 'sin número'}" a "${trimmed}".`);
    await refreshJob(set, jobId);
  },

  setPriority: async (jobId, priority, byUserId) => {
    const before = get().jobs.find((j) => j.id === jobId)!;
    const { error } = await supabase.from('jobs').update({ priority_manual: priority, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    await insertActivity(set, jobId, byUserId, 'prioridad', priority
      ? `Cambió prioridad manual de ${before.priorityManual ?? before.priorityAuto} a ${priority}.`
      : `Volvió a prioridad automática (${before.priorityAuto}).`);
    await insertNotifications([before.responsibleUserId, ...before.assignedUserIds].filter((id) => id !== byUserId), jobId, `Cambió la prioridad de ${jobLabel(before)}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  assignJob: async (jobId, assignedUserIds, responsibleUserId, byUserId) => {
    await supabase.from('jobs').update({ responsible_user_id: responsibleUserId, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await supabase.from('job_assigned_users').delete().eq('job_id', jobId);
    if (assignedUserIds.length) await supabase.from('job_assigned_users').insert(assignedUserIds.map((userId) => ({ job_id: jobId, user_id: userId })));
    const job = await fetchJobById(jobId);
    await insertActivity(set, jobId, byUserId, 'asignacion', 'Actualizó los usuarios asignados.');
    await insertNotifications(assignedUserIds.filter((id) => id !== byUserId), jobId, `Te asignaron a ${job ? jobLabel(job) : 'un trabajo'}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  addComment: async (jobId, userId, text, mentions) => {
    const { error } = await supabase.from('comments').insert({ job_id: jobId, user_id: userId, text, mentions });
    if (error) throw error;
    await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await insertNotifications(mentions, jobId, 'Te mencionaron en un comentario.');
    await refreshComments(set, jobId);
    await refreshMyNotifications(set, get);
  },

  blockJob: async (jobId, reason, description, byUserId) => {
    await supabase.from('block_records').insert({ job_id: jobId, reason, description, opened_by: byUserId });
    await supabase.from('jobs').update({ status: 'BLOQUEADO', last_activity_at: new Date().toISOString() }).eq('id', jobId);
    const job = await fetchJobById(jobId);
    await insertActivity(set, jobId, byUserId, 'bloqueo', `Bloqueó el trabajo — ${description}`);
    if (job) await insertNotifications([job.responsibleUserId, ...job.assignedUserIds].filter((id) => id !== byUserId), jobId, `${jobLabel(job)} está bloqueado.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  unblockJob: async (jobId, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    const openBlock = job?.blockRecords.find((b) => !b.closedAt);
    if (openBlock) await supabase.from('block_records').update({ closed_at: new Date().toISOString() }).eq('id', openBlock.id);
    await supabase.from('jobs').update({ status: 'EN_PRODUCCION', last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await insertActivity(set, jobId, byUserId, 'desbloqueo', 'Desbloqueó el trabajo.');
    await refreshJob(set, jobId);
  },

  setStageStatus: async (jobId, stageKey, status, byUserId) => {
    await supabase.from('job_stages').update({ status }).eq('job_id', jobId).eq('key', stageKey);
    await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await insertActivity(set, jobId, byUserId, 'etapa', `Marcó la etapa "${STAGE_LABELS[stageKey]}" como ${status.replace('_', ' ')}.`);
    await refreshJob(set, jobId);
  },

  addFileVersion: async (jobId, fileName, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    let fileId = job?.files[0]?.id;
    if (!fileId) {
      const { data, error } = await supabase.from('job_files').insert({ job_id: jobId, logical_name: fileName.split('.')[0], kind: fileName.split('.').pop() ?? 'archivo' }).select().single();
      if (error) throw error;
      fileId = data.id;
    }
    const nextVersion = (job?.files[0]?.versions.length ?? 0) + 1;
    await supabase.from('file_versions').insert({
      file_id: fileId, version: nextVersion, file_name: fileName,
      size_kb: 1200 + Math.round(Math.random() * 4000), uploaded_by: byUserId,
    });
    await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await insertActivity(set, jobId, byUserId, 'archivo', `Subió ${fileName}.`);
    if (job) await insertNotifications([job.responsibleUserId, ...job.assignedUserIds].filter((id) => id !== byUserId), jobId, `Se cargó un nuevo archivo en ${jobLabel(job)}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  approveFileVersion: async (jobId, fileId, versionId, byUserId) => {
    await supabase.from('file_versions').update({ approved: false }).eq('file_id', fileId);
    await supabase.from('file_versions').update({ approved: true }).eq('id', versionId);
    const job = await fetchJobById(jobId);
    const v = job?.files.find((f) => f.id === fileId)?.versions.find((vv) => vv.id === versionId);
    await insertActivity(set, jobId, byUserId, 'aprobacion', `Aprobó ${v?.fileName} para producción.`);
    if (job) await insertNotifications([job.responsibleUserId, ...job.assignedUserIds].filter((id) => id !== byUserId), jobId, `Se aprobó un archivo en ${jobLabel(job)}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  toggleQualityCheck: async (jobId, key, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    const item = job?.qualityChecks.find((q) => q.key === key);
    await supabase.from('quality_checks').update({ checked: !item?.checked }).eq('job_id', jobId).eq('key', key);
    await insertActivity(set, jobId, byUserId, 'control_calidad', 'Actualizó el checklist de control de calidad.');
    await refreshJob(set, jobId);
  },

  completeInstallation: async (jobId, notes, byUserId) => {
    await supabase.from('installations').update({ completed: true, completed_at: new Date().toISOString(), completed_notes: notes }).eq('job_id', jobId);
    await supabase.from('jobs').update({ status: 'TERMINADO', finished_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }).eq('id', jobId);
    const job = await fetchJobById(jobId);
    await insertActivity(set, jobId, byUserId, 'instalacion', 'Registró la instalación como completada.');
    if (job) await insertNotifications([job.responsibleUserId].filter((id) => id !== byUserId), jobId, `${jobLabel(job)} — instalación completada.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  markNotificationRead: async (id) => {
    set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) }));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  },
  markAllNotificationsRead: async (userId) => {
    set((s) => ({ notifications: s.notifications.map((n) => n.userId === userId ? { ...n, read: true } : n) }));
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  },

  setUserActive: async (userId, active) => {
    await supabase.from('profiles').update({ active }).eq('id', userId);
    set((s) => ({ users: s.users.map((u) => u.id === userId ? { ...u, active } : u) }));
  },

  resetDemoData: async () => { await get_loadAll(set, get); },

  loadJobComments: async (jobId) => { await refreshComments(set, jobId); },
  loadJobActivity: async (jobId) => {
    const { data, error } = await supabase.from('activity_log').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map(mapActivity);
    set((s) => ({ activityLog: [...rows, ...s.activityLog.filter((a) => a.jobId !== jobId)] }));
  },
}));

async function loadCurrentUser(set: (fn: (s: StoreState) => Partial<StoreState>) => void) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) { set(() => ({ currentUser: null })); return; }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (error || !data) { set(() => ({ currentUser: null })); return; }
  set(() => ({ currentUser: mapProfile(data) }));
}

async function get_loadAll(set: (fn: (s: StoreState) => Partial<StoreState>) => void, get: () => StoreState) {
  set(() => ({ dataLoading: true, loadError: null }));
  try {
    const [{ data: profiles, error: e1 }, { data: clients, error: e2 }, jobs] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('clients').select('*, client_contacts(*)').order('name'),
      fetchAllJobs(),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    set(() => ({ users: (profiles ?? []).map(mapProfile), clients: (clients ?? []).map(mapClient), jobs }));
    await refreshMyNotifications(set, get);
  } catch (err: any) {
    set(() => ({ loadError: err.message ?? 'No se pudieron cargar los datos.' }));
  } finally {
    set(() => ({ dataLoading: false }));
  }
}

async function refreshJob(set: (fn: (s: StoreState) => Partial<StoreState>) => void, jobId: string) {
  const job = await fetchJobById(jobId);
  set((s) => ({ jobs: job ? s.jobs.map((j) => j.id === jobId ? job : j) : s.jobs }));
}

async function refreshComments(set: (fn: (s: StoreState) => Partial<StoreState>) => void, jobId: string) {
  const { data } = await supabase.from('comments').select('*').eq('job_id', jobId).order('created_at');
  set((s) => ({ comments: [...s.comments.filter((c) => c.jobId !== jobId), ...(data ?? []).map(mapComment)] }));
}

async function refreshMyNotifications(set: (fn: (s: StoreState) => Partial<StoreState>) => void, get: () => StoreState) {
  const user = get().currentUser;
  if (!user) return;
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  set(() => ({ notifications: (data ?? []).map(mapNotification) }));
}
