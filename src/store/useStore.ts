import { create } from 'zustand';
import type {
  User, Job, Comment, ActivityLogEntry, Notification, Priority, JobStatus,
  BlockReason, JobType, Material, Quote, QuoteItem, QuoteStatus, StatusFlag,
} from '../types';
import { supabase } from '../lib/supabaseClient';
import { fetchAllJobs, fetchJobById } from '../lib/supabaseQueries';
import { mapProfile, mapClient, mapComment, mapActivity, mapNotification, mapJobType, mapMaterial, mapQuote, mapStatusEvent, mapMetricGoal, mapJobPrice } from '../lib/dbMappers';
import type { StatusEvent } from '../lib/metrics';
import { friendlyError } from '../lib/errors';
import { DEFAULT_JOB_TYPES, DEFAULT_MATERIALS, STATUS_LABELS } from '../data/catalog';
import type { Client, ProductionConfig, MetricGoal, JobPrice } from '../types';

// Slug simple para el id de un catálogo nuevo (job_types/materials.id es texto
// libre, no autonumérico) — sin tildes/espacios, y con un sufijo numérico si ya
// existe, para no chocar con la primary key.
function slugifyId(label: string, existingIds: string[]): string {
  const base = label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) { id = `${base}_${n}`; n += 1; }
  return id;
}

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
  jobTypes: JobType[];
  materials: Material[];
  jobs: Job[];
  comments: Comment[];
  activityLog: ActivityLogEntry[];
  notifications: Notification[];
  // Presupuestos — separados de `jobs` a propósito (ver types/index.ts, Quote).
  // No se cargan en get_loadAll junto con el resto: es una sección que no todos
  // visitan siempre, así que se trae sola cuando entra a /presupuestos.
  quotes: Quote[];
  quotesLoaded: boolean;
  // Último aviso para mostrar como toast (una ficha nueva que cayó, una
  // asignación, etc.). Lo pinta AppLayout y se limpia solo.
  toast: string | null;
  // Avisos flotantes de cambios de estado hechos por OTROS usuarios (el más
  // reciente primero). Mecanismo aparte de `notifications` (la campana) y de
  // `toast` — ver StatusFlag en types/index.ts.
  statusFlags: StatusFlag[];

  init: () => Promise<void>;
  clearToast: () => void;
  dismissStatusFlag: (id: string) => void;
  dismissAllStatusFlags: () => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Catálogos editables desde Configuración (admin) — ver lib/permissions.ts canManageCatalog.
  addJobType: (label: string) => Promise<void>;
  renameJobType: (id: string, label: string) => Promise<void>;
  addMaterial: (label: string) => Promise<void>;
  renameMaterial: (id: string, label: string) => Promise<void>;

  findOrCreateClient: (name: string) => Promise<string>;
  createJob: (input: NewJobInput) => Promise<Job>;
  setStatus: (jobId: string, status: JobStatus, movedByUserId: string) => Promise<void>;
  setJobCode: (jobId: string, code: string, byUserId: string) => Promise<void>;
  setPriority: (jobId: string, priority: Priority, byUserId: string) => Promise<void>;
  setSampleReview: (jobId: string, state: import('../types').SampleReview, byUserId: string) => Promise<void>;
  updateCommittedDate: (jobId: string, committedDate: string, byUserId: string) => Promise<void>;
  updateJobSpecs: (jobId: string, specs: JobSpecs, byUserId: string) => Promise<void>;
  toggleProductChecked: (jobId: string, productId: string, byUserId: string) => Promise<void>;
  saveProductionConfig: (jobId: string, config: ProductionConfig, byUserId: string) => Promise<void>;
  saveAssemblyProgress: (jobId: string, assemblyId: string, progress: { assembled: number; ready: Record<string, number> }, byUserId: string, detail: string) => Promise<void>;
  updateJobHeader: (jobId: string, fields: { name: string; clientName: string }, byUserId: string) => Promise<void>;
  changeResponsible: (jobId: string, newUserId: string, byUserId: string) => Promise<void>;
  uploadContactSheet: (jobId: string, image: Blob, byUserId: string) => Promise<void>;
  removeContactSheet: (jobId: string, byUserId: string) => Promise<void>;
  contactSheetUrl: (path: string) => Promise<string>;
  assignJob: (jobId: string, assignedUserIds: string[], responsibleUserId: string, byUserId: string) => Promise<void>;
  addComment: (jobId: string, userId: string, text: string, mentions: string[]) => Promise<void>;
  blockJob: (jobId: string, reason: BlockReason, description: string, byUserId: string) => Promise<void>;
  unblockJob: (jobId: string, byUserId: string) => Promise<void>;
  addFileVersion: (jobId: string, file: File, byUserId: string, targetFileId?: string) => Promise<void>;
  deleteFileVersion: (jobId: string, fileId: string, versionId: string, byUserId: string) => Promise<void>;
  approveFileVersion: (jobId: string, fileId: string, versionId: string, byUserId: string) => Promise<void>;
  toggleQualityCheck: (jobId: string, key: string, byUserId: string) => Promise<void>;
  completeInstallation: (jobId: string, notes: string, byUserId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  setUserActive: (userId: string, active: boolean) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  restoreJob: (jobId: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
  // AUDITORIA_UXUI_2026-09-15.md ítem #4 — expone get_loadAll() para el botón
  // "Reintentar" del banner de error de AppLayout.tsx (antes era una función
  // privada del módulo, sin forma de volver a dispararla desde un componente).
  refreshAll: () => Promise<void>;
  loadJobComments: (jobId: string) => Promise<void>;
  loadJobActivity: (jobId: string) => Promise<void>;

  // Presupuestos — ver lib/permissions.ts canManageQuotes/canSetQuoteValue.
  loadQuotes: () => Promise<void>;
  createQuote: (input: NewQuoteInput) => Promise<Quote>;
  updateQuote: (quoteId: string, patch: { name?: string; clientId?: string; items?: QuoteItem[] }) => Promise<void>;
  setQuoteStatus: (quoteId: string, status: QuoteStatus) => Promise<void>;
  setQuoteValue: (quoteId: string, price: number | null, priceIncludesIva: boolean | null) => Promise<void>;
  // Presupuesto confirmado → trabajo real (22/09). Ver JSDoc de la implementación.
  confirmQuote: (quoteId: string, extra: ConfirmQuoteExtra, byUserId: string) => Promise<Job>;

  // Métricas (19/10) — solo admin; la base lo exige (028_metrics.sql).
  metricsEvents: StatusEvent[];
  metricsLoadedAt: string | null;
  goals: MetricGoal[];
  loadMetrics: () => Promise<void>;
  saveGoal: (goal: Omit<MetricGoal, 'id' | 'createdAt' | 'archivedAt' | 'createdBy'>) => Promise<void>;
  archiveGoal: (goalId: string) => Promise<void>;

  // Importe final (029) — solo admin y administración (canSetQuoteValue); la base lo exige.
  jobPrices: Record<string, JobPrice>;
  jobPricesLoaded: boolean;
  jobPricesError: string | null;
  loadJobPrices: () => Promise<void>;
  setJobPrice: (jobId: string, input: { enteredAmount: number; withIva: boolean; note: string }) => Promise<void>;
  clearJobPrice: (jobId: string) => Promise<void>;
}

export interface JobSpecs {
  products: Job['products']; specialRequirements: string;
}

export interface NewJobInput {
  name: string; clientId: string; contactName: string; contactPhone: string;
  jobTypeId: Job['jobTypeId']; description: string;
  committedDate: string; priorityManual: Priority; clientImportant: boolean;
  products: Job['products']; specialRequirements: string;
  requiresInstallation: boolean; installAddress: string; installContactPhone: string; installDate: string;
  createdByUserId: string; responsibleUserId: string; assignedUserIds: string[]; assignedNames: string[];
  // Si este trabajo se genera al confirmar un presupuesto (ver `confirmQuote`
  // más abajo) — vínculo inverso, ver Job.sourceQuoteId en types/index.ts.
  sourceQuoteId?: string;
}

export interface NewQuoteInput {
  clientId: string; name: string; items: QuoteItem[]; createdByUserId: string;
}

// Datos que un presupuesto NUNCA tiene (no se piden al presupuestar, ver
// types/index.ts Quote) pero que un trabajo exige sí o sí a nivel de base
// (job_type_id/committed_date/responsible_user_id son NOT NULL en `jobs`,
// ver 001_schema.sql) — se piden recién al confirmar, en vez de inventarlos.
export interface ConfirmQuoteExtra {
  jobTypeId: string;
  committedDate: string; // fecha (sin hora) — se le agrega T18:00 igual que en Carga rápida
  responsibleUserId: string;
}

// Un ítem de presupuesto no tiene "procesado"/"tercerizado" (no aplica todavía
// a un trabajo en curso) ni campo `unit` en Product — la unidad, si estaba
// cargada, se conserva agregándola a las notas para no perder el dato.
function quoteItemToProduct(item: QuoteItem): Job['products'][number] {
  const notes = item.unit ? `Unidad: ${item.unit}${item.notes ? `\n${item.notes}` : ''}` : item.notes;
  return { id: crypto.randomUUID(), label: item.label, materialIds: item.materialIds, sizeItems: item.sizeItems, notes, checked: false };
}

// Historial de auditoría — best-effort, igual que `insertNotifications` de
// abajo. Antes tiraba (`throw error`) si el insert fallaba, y como en TODOS
// los call sites de este archivo va antes que el aviso al usuario
// (`insertNotifications`) dentro de la misma función `async`, un fallo acá
// (ej. drift de RLS en `activity_log`, mismo patrón ya visto en `notifications`
// — ver §12.8/§22/§27/§49 de CLAUDE.md) abortaba la función entera SIN llegar
// nunca a mandar la notificación real, aunque el cambio principal (crear el
// trabajo, cambiar el estado, etc.) ya se hubiera guardado bien. Ningún call
// site usa el valor de retorno, así que devolver `null` en vez de tirar es
// seguro en los 17 lugares que lo llaman.
async function insertActivity(
  set: (fn: (s: StoreState) => Partial<StoreState>) => void,
  jobId: string, userId: string, action: string, detail: string,
  // Solo para cambios de estado: de dónde a dónde. Es lo que dispara el aviso
  // flotante en las pantallas de los demás usuarios (ver canal 'status-flags').
  statusChange?: { from: JobStatus; to: JobStatus }
): Promise<ActivityLogEntry | null> {
  const base: Record<string, unknown> = { job_id: jobId, user_id: userId, action, detail };
  let { data, error } = await supabase.from('activity_log')
    .insert(statusChange ? { ...base, from_status: statusChange.from, to_status: statusChange.to } : base)
    .select().single();
  if (error && statusChange) {
    // Si todavía no se corrió la migración 025 (columnas from_status/to_status),
    // no perder el renglón del historial: reintenta sin los datos del aviso.
    ({ data, error } = await supabase.from('activity_log').insert(base).select().single());
  }
  if (error) {
    console.error('[historial] no se pudo registrar, se ignora y la acción principal sigue:', error);
    useStore.setState({ toast: `No se pudo registrar en el historial (${friendlyError(error)})` });
    return null;
  }
  const entry = mapActivity(data);
  set((s) => ({ activityLog: [entry, ...s.activityLog] }));
  return entry;
}

// --- Avisos de cambio de estado que pasaron mientras la app estaba cerrada ---
// (Gonzalo, 18/10: con la PC apagada se perdía todo lo que cambiaban los demás.)
// Se guarda en el navegador hasta cuándo ya se vieron los avisos y cuáles se
// cerraron sueltos; al abrir la app se traen del Historial los cambios de estado
// de otros posteriores a esa marca (tope 7 días / 50). Al cerrar todos, la marca
// avanza a "ahora". La primera vez no muestra nada viejo, arranca desde hoy.
const FLAGS_KEY = (uid: string) => `bonta-flags-${uid}`;
type FlagsSeen = { seenUntil: string; dismissed: string[] };

function readFlagsSeen(uid: string): FlagsSeen | null {
  try { const raw = localStorage.getItem(FLAGS_KEY(uid)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeFlagsSeen(uid: string, v: FlagsSeen) {
  try { localStorage.setItem(FLAGS_KEY(uid), JSON.stringify(v)); } catch { /* sin storage: solo se pierde el recordatorio */ }
}
/** `dismissedId` null = no queda ninguno abierto: la marca pasa a ahora. */
function markFlagsSeen(uid: string, dismissedId: string | null) {
  if (dismissedId === null) return writeFlagsSeen(uid, { seenUntil: new Date().toISOString(), dismissed: [] });
  const cur = readFlagsSeen(uid) ?? { seenUntil: new Date().toISOString(), dismissed: [] };
  writeFlagsSeen(uid, { ...cur, dismissed: [...cur.dismissed, dismissedId].slice(-200) });
}

async function loadMissedStatusFlags(set: (fn: (s: StoreState) => Partial<StoreState>) => void, get: () => StoreState) {
  const me = get().currentUser;
  if (!me) return;
  const seen = readFlagsSeen(me.id);
  if (!seen) { writeFlagsSeen(me.id, { seenUntil: new Date().toISOString(), dismissed: [] }); return; }
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const since = seen.seenUntil > weekAgo ? seen.seenUntil : weekAgo;
  const { data, error } = await supabase.from('activity_log').select('*')
    .eq('action', 'estado').neq('user_id', me.id).gt('created_at', since)
    .not('from_status', 'is', null).order('created_at', { ascending: false }).limit(50);
  if (error) { console.warn('[avisos de estado] no se pudieron traer los pendientes, se ignora:', error); return; }
  const flags: StatusFlag[] = [];
  for (const row of (data ?? []) as any[]) {
    if (seen.dismissed.includes(row.id)) continue;
    const job = get().jobs.find((j) => j.id === row.job_id);
    if (!job || job.deletedAt) continue;
    const author = get().users.find((u) => u.id === row.user_id);
    flags.push({ id: row.id, jobId: job.id, jobName: job.name, from: row.from_status, to: row.to_status, userName: author ? author.name.split(' ')[0] : 'Alguien', at: row.created_at });
  }
  if (flags.length === 0) return;
  set((s) => {
    const known = new Set(s.statusFlags.map((f) => f.id));
    const merged = [...s.statusFlags, ...flags.filter((f) => !known.has(f.id))].sort((a, b) => b.at.localeCompare(a.at));
    return { statusFlags: merged.slice(0, 50) };
  });
}

async function insertNotifications(userIds: string[], jobId: string, text: string): Promise<void> {
  const rows = userIds.filter((id, i, arr) => arr.indexOf(id) === i).map((userId) => ({ user_id: userId, job_id: jobId, text }));
  if (rows.length === 0) return;
  // CAUSA RAÍZ real (22/09, ver CLAUDE.md §50): esto encadenaba `.select()`
  // después del insert para devolver la fila creada — pero esa lectura de
  // vuelta TAMBIÉN pasa por la policy de SELECT de `notifications`
  // (`user_id = auth.uid()`). Como acá casi siempre se notifica a OTRA
  // persona (no a quien dispara la acción), `auth.uid()` nunca coincide con
  // el `user_id` insertado — PostgREST no puede devolver la fila y reporta
  // toda la operación como fallida (permission denied / RLS), aunque el
  // INSERT en sí era válido según `with_check(true)`. Nadie usaba el valor de
  // retorno en ningún call site, así que sacar el `.select()` alcanza: sin
  // pedir la fila de vuelta, no hay nada que la policy de SELECT tenga que
  // aprobar, y el insert pasa. Esto es lo que tenía en 0 la tabla
  // `notifications` para cualquier caso cruzado desde que existe la feature.
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    // Las notificaciones son un efecto secundario best-effort — que fallen no
    // tiene que tumbar la acción que las dispara. Antes esto quedaba 100%
    // invisible (solo console.warn); ahora también se ve como toast (§49).
    console.error('[notificaciones] no se pudieron crear, se ignora y la acción principal sigue:', error);
    useStore.setState({ toast: `No se pudo avisar a nadie de este cambio (${friendlyError(error)})` });
  }
}

// Guardo de módulo: init() puede correr dos veces (StrictMode en dev) o si algún
// componente lo vuelve a llamar — las suscripciones de realtime se arman una vez.
let realtimeStarted = false;

export const useStore = create<StoreState>()((set, get) => ({
  authReady: false,
  dataLoading: false,
  loadError: null,
  currentUser: null,
  users: [],
  clients: [],
  jobTypes: DEFAULT_JOB_TYPES,
  materials: DEFAULT_MATERIALS,
  jobs: [],
  comments: [],
  activityLog: [],
  notifications: [],
  quotes: [],
  quotesLoaded: false,
  metricsEvents: [],
  metricsLoadedAt: null,
  goals: [],
  jobPrices: {},
  jobPricesLoaded: false,
  jobPricesError: null,
  toast: null,
  statusFlags: [],

  clearToast: () => set(() => ({ toast: null })),
  dismissStatusFlag: (id) => {
    const rest = get().statusFlags.filter((f) => f.id !== id);
    set({ statusFlags: rest });
    const me = get().currentUser;
    if (me) markFlagsSeen(me.id, rest.length === 0 ? null : id);
  },
  dismissAllStatusFlags: () => {
    set({ statusFlags: [] });
    const me = get().currentUser;
    if (me) markFlagsSeen(me.id, null);
  },

  init: async () => {
    // En dev, React StrictMode invoca el efecto de init() dos veces — sin este
    // guardo se intenta registrar el mismo canal de realtime dos veces y
    // Supabase tira "cannot add postgres_changes callbacks after subscribe()".
    if (realtimeStarted) return;
    realtimeStarted = true;

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await loadCurrentUser(set);
      await get_loadAll(set, get);
      await loadMissedStatusFlags(set, get);
    }
    set({ authReady: true });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { set({ currentUser: null }); return; }
      await loadCurrentUser(set);
      await get_loadAll(set, get);
      await loadMissedStatusFlags(set, get);
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

    // Aviso en vivo cuando cae una notificación para mí (ficha nueva, me
    // asignaron, me mencionaron). RLS ya filtra a `user_id = auth.uid()`, pero
    // igual chequeamos por las dudas. Prepende a la lista y dispara el toast.
    supabase
      .channel('my-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const row = payload.new as any;
        const me = get().currentUser?.id;
        if (!row || !me || row.user_id !== me) return;
        const notif = mapNotification(row);
        set((s) => (s.notifications.some((n) => n.id === notif.id)
          ? {}
          : { notifications: [notif, ...s.notifications], toast: notif.text }));
      })
      .subscribe();

    // Aviso flotante cuando OTRA persona cambia el estado de un trabajo (07/10).
    // Escucha las filas de `activity_log` de tipo 'estado' (las que ya inserta
    // `setStatus` para el Historial) — RLS (`can_view_job`) ya limita qué trabajos
    // le llegan a cada usuario, y la propia fila trae `user_id` del autor, que se
    // descarta si soy yo. No toca `notifications` (la campana).
    supabase
      .channel('status-flags')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
        const row = payload.new as any;
        const me = get().currentUser;
        if (!row || !me || row.action !== 'estado' || !row.from_status || !row.to_status) return;
        if (row.user_id === me.id) return;
        if (get().statusFlags.some((f) => f.id === row.id)) return;
        try {
          const job = get().jobs.find((j) => j.id === row.job_id) ?? (await fetchJobById(row.job_id));
          if (!job || job.deletedAt) return;
          const author = get().users.find((u) => u.id === row.user_id);
          const flag: StatusFlag = {
            id: row.id, jobId: job.id, jobName: job.name,
            from: row.from_status, to: row.to_status,
            userName: author ? author.name.split(' ')[0] : 'Alguien',
            at: row.created_at,
          };
          set((s) => (s.statusFlags.some((f) => f.id === flag.id) ? {} : { statusFlags: [flag, ...s.statusFlags].slice(0, 50) }));
        } catch (err) {
          console.warn('[avisos de estado] no se pudo armar el aviso, se ignora:', err);
        }
      })
      .subscribe();

    // Red de contención del canal `my-notifications`: el broadcast de `postgres_changes`
    // depende de que la tabla `notifications` esté agregada a la publicación
    // `supabase_realtime` en Supabase (Database → Replication) — un paso manual
    // que no queda garantizado por las migraciones de este repo (no hay forma de
    // correr `alter publication` de forma verificable desde acá, ver migración
    // 021). Si ese paso nunca se hizo o se desconfiguró, el canal se suscribe
    // sin error pero nunca recibe nada — silencioso, igual que el resto de los
    // fallos de RLS que ya pasaron en este proyecto (§12.8/§22/§27). Este
    // polling asegura que la campana se actualice sola de todas formas, aunque
    // el usuario no recargue la página ni el realtime esté andando.
    setInterval(() => {
      if (get().currentUser) refreshMyNotifications(set, get);
    }, 30000);
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
    set({ currentUser: null, jobs: [], comments: [], activityLog: [], notifications: [], quotes: [], quotesLoaded: false, statusFlags: [], metricsEvents: [], metricsLoadedAt: null, goals: [], jobPrices: {}, jobPricesLoaded: false });
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

  addJobType: async (rawLabel) => {
    const label = rawLabel.trim();
    if (!label) throw new Error('Falta el nombre del tipo de trabajo.');
    const id = slugifyId(label, get().jobTypes.map((t) => t.id));
    const { data, error } = await supabase.from('job_types').insert({ id, label }).select().single();
    if (error) throw error;
    set((s) => ({ jobTypes: [...s.jobTypes, mapJobType(data)] }));
  },

  renameJobType: async (id, rawLabel) => {
    const label = rawLabel.trim();
    if (!label) throw new Error('Falta el nombre del tipo de trabajo.');
    const { error } = await supabase.from('job_types').update({ label }).eq('id', id);
    if (error) throw error;
    set((s) => ({ jobTypes: s.jobTypes.map((t) => t.id === id ? { ...t, label } : t) }));
  },

  addMaterial: async (rawLabel) => {
    const label = rawLabel.trim();
    if (!label) throw new Error('Falta el nombre del material.');
    const id = slugifyId(label, get().materials.map((m) => m.id));
    const { data, error } = await supabase.from('materials').insert({ id, label }).select().single();
    if (error) throw error;
    set((s) => ({ materials: [...s.materials, mapMaterial(data)] }));
  },

  renameMaterial: async (id, rawLabel) => {
    const label = rawLabel.trim();
    if (!label) throw new Error('Falta el nombre del material.');
    const { error } = await supabase.from('materials').update({ label }).eq('id', id);
    if (error) throw error;
    set((s) => ({ materials: s.materials.map((m) => m.id === id ? { ...m, label } : m) }));
  },

  createJob: async (input) => {
    // Falta dirección de instalación es lo único que de verdad bloquea un trabajo
    // recién creado — medidas/material/técnica se cargan después si hacen falta,
    // no ameritan nacer en "Falta información".
    const missingInstallAddress = input.requiresInstallation && !input.installAddress.trim();

    const { data: jobRow, error } = await supabase.from('jobs').insert({
      name: input.name, client_id: input.clientId, contact_name: input.contactName, contact_phone: input.contactPhone,
      created_by_user_id: input.createdByUserId,
      responsible_user_id: input.responsibleUserId, requested_date: input.committedDate, committed_date: input.committedDate,
      job_type_id: input.jobTypeId, description: input.description, products: input.products,
      assigned_names: input.assignedNames,
      special_requirements: input.specialRequirements,
      status: missingInstallAddress ? 'FALTA_INFORMACION' : 'PENDIENTE', priority_manual: input.priorityManual,
      requires_installation: input.requiresInstallation, client_important: input.clientImportant,
      source_quote_id: input.sourceQuoteId ?? null,
    }).select().single();
    if (error) throw error;
    const jobId = jobRow.id;

    if (input.assignedUserIds.length) {
      await supabase.from('job_assigned_users').insert(input.assignedUserIds.map((userId) => ({ job_id: jobId, user_id: userId })));
    }
    // El checklist de control de calidad se sacó (Gonzalo, 12/10: "muy específico, nadie lo va a usar") — ya no se siembra.
    if (input.requiresInstallation) {
      await supabase.from('installations').insert({
        job_id: jobId, address: input.installAddress, contact_name: input.contactName,
        contact_phone: input.installContactPhone, install_date: input.installDate || null,
      });
    }

    // El historial es una auditoría de quién apretó el botón de verdad (RLS exige
    // user_id = auth.uid()), que puede no coincidir con "Asignado por" — ese campo
    // es editable a propósito para acreditar el trabajo a otra persona (ej. Pancho
    // le dicta el pedido a Gonzalo y Gonzalo lo carga, pero el crédito es de Pancho).
    const actorId = get().currentUser?.id ?? input.createdByUserId;
    await insertActivity(set, jobId, actorId, 'crear', `Creó el trabajo — ${input.name}.`);
    // Aviso de "te asignaron un trabajo" (punto 1, 20/09) — hoy la creación es el
    // único momento real en que se fija responsable/asignados (no hay UI para
    // reasignar después, ver `assignJob` sin call sites), así que este es "el
    // evento real de asignación". Texto explícito ("Te asignaron...") en vez del
    // genérico "Nueva ficha" que tenía antes, para que quede claro que es una
    // asignación y no solo un aviso de que algo se cargó. Solo le llega a quien
    // quedó asignado — desde el 07/10 los admins que no son responsables ni
    // asignados YA NO reciben el aviso genérico "Nueva ficha" (Gonzalo: si Martín
    // le asigna un trabajo a Gastón, la campana es de Gastón, no de los demás).
    const assignedRecipients = [...new Set([input.responsibleUserId, ...input.assignedUserIds])].filter((id) => id && id !== actorId);
    await insertNotifications(assignedRecipients, jobId, `Te asignaron el trabajo "${input.name}".`);

    const job = await fetchJobById(jobId);
    if (!job) throw new Error('No se pudo leer el trabajo recién creado.');
    set((s) => ({ jobs: [job, ...s.jobs] }));
    await refreshMyNotifications(set, get);
    return job;
  },

  setStatus: async (jobId, status, byUserId) => {
    const before = get().jobs.find((j) => j.id === jobId);
    const nowIso = new Date().toISOString();
    // La fecha de "quedó listo" se graba de nuevo cada vez que el trabajo ENTRA a
    // Listo/Instalación viniendo de un estado que no lo era — así si un trabajo
    // vuelve para atrás (por ej. control de calidad lo rebota) y vuelve a llegar a
    // Listo otro día, la fecha se actualiza a ese día y no queda pisada con la
    // primera vez (antes no se pisaba nunca, y quedaba una fecha vieja).  No se
    // pisa al pasar DENTRO del mismo grupo (Listo → Instalación), para no perder
    // cuándo quedó listo la producción.
    const readyStatuses: JobStatus[] = ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION', 'EN_INSTALACION'];
    const stampReady = readyStatuses.includes(status) && !readyStatuses.includes(before?.status ?? 'PENDIENTE' as JobStatus);
    // Marca/limpia la fecha de terminado según el estado — así un admin que
    // revierte un "Terminado" puesto por error deja la ficha coherente.
    const finishedPatch = status === 'TERMINADO'
      ? (before?.finishedAt ? {} : { finished_at: nowIso })
      : (before?.status === 'TERMINADO' ? { finished_at: null } : {});
    // Optimista: refleja el cambio ya mismo (clave para que el drag&drop del kanban se sienta instantáneo)
    // y lo revierte si Supabase lo rechaza (por ejemplo, la regla de control de calidad obligatorio).
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, status, lastActivityAt: nowIso, ...(stampReady ? { readyAt: nowIso } : {}) } : j) }));
    const { error } = await supabase.from('jobs').update({ status, last_activity_at: nowIso, ...(stampReady ? { ready_at: nowIso } : {}), ...finishedPatch }).eq('id', jobId);
    if (error) {
      if (before) set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? before : j) }));
      throw error;
    }
    await insertActivity(
      set, jobId, byUserId, 'estado', `Cambió el estado a ${status}.`,
      before && before.status !== status ? { from: before.status, to: status } : undefined
    );
    if (before) await insertNotifications([before.responsibleUserId, ...before.assignedUserIds].filter((id) => id !== byUserId), jobId, `${jobLabel(before)} pasó a "${STATUS_LABELS[status]}".`);
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
    await insertActivity(set, jobId, byUserId, 'prioridad', `Cambió la prioridad de ${before.priorityManual ?? before.priorityAuto} a ${priority}.`);
    await insertNotifications([before.responsibleUserId, ...before.assignedUserIds].filter((id) => id !== byUserId), jobId, `Cambió la prioridad de ${jobLabel(before)}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  // Muestra/prueba al cliente. No pasa por el trigger `jobs_update_guard` (no es
  // un campo estructural), así que cualquier rol con acceso al trabajo lo puede
  // marcar — quien está produciendo suele ser el que se entera del OK del cliente.
  setSampleReview: async (jobId, state, byUserId) => {
    const before = get().jobs.find((j) => j.id === jobId);
    const nowIso = new Date().toISOString();
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, sampleReview: state, sampleReviewAt: nowIso } : j) }));
    const { error } = await supabase.from('jobs').update({ sample_review: state, sample_review_at: nowIso, last_activity_at: nowIso }).eq('id', jobId);
    if (error) {
      if (before) set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? before : j) }));
      throw error;
    }
    const label = {
      none: 'sin muestra',
      in_production: 'muestra en producción (OT emitida)',
      awaiting: 'muestra enviada, falta OK del cliente',
      approved: 'muestra aprobada por el cliente',
    }[state];
    await insertActivity(set, jobId, byUserId, 'muestra', `Marcó: ${label}.`);
    if (before) await insertNotifications([before.responsibleUserId, ...before.assignedUserIds].filter((id) => id !== byUserId), jobId, `${jobLabel(before)}: ${label}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  // committed_date es uno de los campos que el trigger `jobs_update_guard` (ver
  // 002_policies.sql) protege — solo admin/coordinador pueden tocarlo. La UI ya
  // gatea el botón con `canChangePriority`, esto es la segunda barrera real.
  updateCommittedDate: async (jobId, committedDate, byUserId) => {
    const before = get().jobs.find((j) => j.id === jobId);
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, committedDate } : j) }));
    const { error } = await supabase.from('jobs').update({ committed_date: committedDate, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) {
      if (before) set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? before : j) }));
      throw error;
    }
    await insertActivity(set, jobId, byUserId, 'fecha', 'Cambió la fecha de entrega comprometida.');
    await refreshJob(set, jobId);
  },

  // Corregir cliente y nombre de un trabajo ya creado (Gonzalo, 17/10). El
  // cliente se resuelve igual que en Carga rápida (findOrCreateClient): si el
  // nombre ya existe se reusa, si no se crea. client_id está protegido por
  // jobs_update_guard (solo admin/coordinador), igual que en la UI.
  updateJobHeader: async (jobId, fields, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) return;
    const name = fields.name.trim();
    if (!name) throw new Error('Falta el nombre del trabajo.');
    const clientId = await get().findOrCreateClient(fields.clientName);
    const { error } = await supabase.from('jobs').update({ name, client_id: clientId, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    const changes: string[] = [];
    if (name !== job.name) changes.push(`nombre: "${job.name}" → "${name}"`);
    if (clientId !== job.clientId) {
      const before = get().clients.find((c) => c.id === job.clientId)?.name ?? '—';
      const after = get().clients.find((c) => c.id === clientId)?.name ?? '—';
      changes.push(`cliente: ${before} → ${after}`);
    }
    if (changes.length) await insertActivity(set, jobId, byUserId, 'datos', `Corrigió ${changes.join(' · ')}.`);
    await refreshJob(set, jobId);
  },

  // Contact sheet (18/10): una imagen por OT en el bucket privado job-images.
  // Se sube con nombre nuevo cada vez (así nunca queda una versión vieja en caché)
  // y recién después de guardar la ruta nueva se borra la anterior.
  uploadContactSheet: async (jobId, image, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) return;
    const ext = image.type === 'image/png' ? 'png' : 'jpg';
    const path = `${jobId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from('job-images').upload(path, image, { contentType: image.type, upsert: false });
    if (up.error) throw up.error;
    const { error } = await supabase.from('jobs').update({ contact_sheet_path: path, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) { await supabase.storage.from('job-images').remove([path]); throw error; }
    if (job.contactSheetPath) await supabase.storage.from('job-images').remove([job.contactSheetPath]);
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, contactSheetPath: path } : j) }));
    await insertActivity(set, jobId, byUserId, 'contact_sheet', job.contactSheetPath ? 'Reemplazó la imagen del contact sheet.' : 'Subió la imagen del contact sheet.');
  },

  removeContactSheet: async (jobId, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job?.contactSheetPath) return;
    const { error } = await supabase.from('jobs').update({ contact_sheet_path: null }).eq('id', jobId);
    if (error) throw error;
    await supabase.storage.from('job-images').remove([job.contactSheetPath]);
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, contactSheetPath: null } : j) }));
    await insertActivity(set, jobId, byUserId, 'contact_sheet', 'Quitó la imagen del contact sheet.');
  },

  contactSheetUrl: async (path) => {
    const { data, error } = await supabase.storage.from('job-images').createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  },

  // Pasar un trabajo a otro responsable desde la ficha (Gonzalo, 18/10). Queda
  // en el Historial con el "de quién a quién" y le llega la campana al nuevo
  // responsable (y al anterior, para que sepa que ya no lo tiene).
  changeResponsible: async (jobId, newUserId, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job || job.responsibleUserId === newUserId) return;
    const { error } = await supabase.from('jobs').update({ responsible_user_id: newUserId, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    const nameOf = (id: string) => get().users.find((u) => u.id === id)?.name ?? '—';
    await insertActivity(set, jobId, byUserId, 'responsable', `Cambió el responsable: ${nameOf(job.responsibleUserId)} → ${nameOf(newUserId)}.`);
    if (newUserId !== byUserId) await insertNotifications([newUserId], jobId, `Te asignaron el trabajo "${jobLabel(job)}".`);
    if (job.responsibleUserId && job.responsibleUserId !== byUserId && job.responsibleUserId !== newUserId) {
      await insertNotifications([job.responsibleUserId], jobId, `El trabajo "${jobLabel(job)}" pasó a ${nameOf(newUserId)}.`);
    }
    await refreshJob(set, jobId);
  },

  updateJobSpecs: async (jobId, specs, byUserId) => {
    const { error } = await supabase.from('jobs').update({
      products: specs.products,
      special_requirements: specs.specialRequirements, last_activity_at: new Date().toISOString(),
    }).eq('id', jobId);
    if (error) throw error;
    await insertActivity(set, jobId, byUserId, 'especificaciones', 'Actualizó el detalle del trabajo.');
    await refreshJob(set, jobId);
  },

  // Pestaña "Producción": guarda solo jobs.production_config, nunca products ni
  // ningún otro campo de la OT (ver ProductionConfig en types/index.ts).
  saveProductionConfig: async (jobId, config, byUserId) => {
    const { error } = await supabase.from('jobs').update({ production_config: config, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, productionConfig: config } : j) }));
    await insertActivity(set, jobId, byUserId, 'produccion', 'Actualizó la configuración de producción.');
  },

  // Avance de armado (§75): solo toca los contadores de UNA composición, sobre la
  // configuración vigente en el store (no sobre un borrador), así no pisa cambios
  // de composición sin guardar. Queda en el Historial con el detalle del conteo.
  saveAssemblyProgress: async (jobId, assemblyId, progress, byUserId, detail) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('No se encontró el trabajo.');
    const assemblies = (job.productionConfig.assemblies ?? []).map((a) => a.id !== assemblyId ? a : {
      ...a, assembled: progress.assembled,
      components: a.components.map((c) => ({ ...c, ready: progress.ready[c.pieceKey] ?? c.ready })),
    });
    const config = { ...job.productionConfig, assemblies };
    const { error } = await supabase.from('jobs').update({ production_config: config, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, productionConfig: config } : j) }));
    await insertActivity(set, jobId, byUserId, 'armado', detail);
  },

  // Tildar un producto es informativo, nunca bloquea nada — por eso es una
  // acción propia y liviana en vez de pasar por el modo "Editar" del resto de
  // los productos (que sí guarda todo junto).
  toggleProductChecked: async (jobId, productId, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) return;
    const product = job.products.find((p) => p.id === productId);
    const products = job.products.map((p) => p.id === productId ? { ...p, checked: !p.checked } : p);
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, products } : j) }));
    const { error } = await supabase.from('jobs').update({ products, last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) {
      set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? job : j) }));
      throw error;
    }
    await insertActivity(set, jobId, byUserId, 'producto', `Marcó "${product?.label}" como ${product?.checked ? 'pendiente' : 'procesado'}.`);
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
    const job = get().jobs.find((j) => j.id === jobId);
    // Defensa extra además del filtro que ya hace CommentsPanel antes de llamar
    // acá — nunca notificarse a sí mismo, mismo criterio que el resto de las
    // acciones del store (blockJob, addFileVersion, etc.).
    await insertNotifications(mentions.filter((id) => id !== userId), jobId, `Te mencionaron en un comentario — ${job ? jobLabel(job) : 'un trabajo'}.`);
    await refreshComments(set, jobId);
    await refreshMyNotifications(set, get);
  },

  // "Bloqueado" ya no pisa `status` (Fase 3, 17/09) — antes esta acción mandaba
  // `status: 'BLOQUEADO'`, así que un trabajo bloqueado en, por ej., Control de
  // calidad "perdía" esa etapa real: al desbloquear, `unblockJob` lo devolvía
  // siempre a `EN_PRODUCCION` sin importar dónde estuviera de verdad. Ahora
  // bloquear solo abre un `block_records` y toca `last_activity_at` — el estado
  // real del trabajo queda intacto todo el tiempo que dure el bloqueo.
  // `isBlocked()`/`BlockedBadge` son quienes derivan "está bloqueado" a partir de
  // `blockRecords`, no de `status`.
  blockJob: async (jobId, reason, description, byUserId) => {
    const { error: blockError } = await supabase.from('block_records').insert({ job_id: jobId, reason, description, opened_by: byUserId });
    if (blockError) throw blockError;
    const { error } = await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    const job = await fetchJobById(jobId);
    await insertActivity(set, jobId, byUserId, 'bloqueo', `Bloqueó el trabajo — ${description}`);
    if (job) await insertNotifications([job.responsibleUserId, ...job.assignedUserIds].filter((id) => id !== byUserId), jobId, `${jobLabel(job)} está bloqueado.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  unblockJob: async (jobId, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    const openBlock = job?.blockRecords.find((b) => !b.closedAt);
    if (openBlock) {
      const { error: closeError } = await supabase.from('block_records').update({ closed_at: new Date().toISOString() }).eq('id', openBlock.id);
      if (closeError) throw closeError;
    }
    const { error } = await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
    await insertActivity(set, jobId, byUserId, 'desbloqueo', 'Desbloqueó el trabajo.');
    await refreshJob(set, jobId);
  },

  // Sin `targetFileId` crea un archivo lógico nuevo (caso normal: cada archivo
  // que se arrastra al dropzone es un documento distinto, no una versión del
  // mismo). Con `targetFileId` agrega una versión nueva a un archivo existente
  // (re-subir la misma pieza corregida). El tamaño es el real del archivo — no
  // se sube el binario todavía (Fase 2), solo nombre y tamaño reales.
  addFileVersion: async (jobId, file, byUserId, targetFileId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    let fileId = targetFileId;
    if (!fileId) {
      const dot = file.name.lastIndexOf('.');
      const logicalName = dot > 0 ? file.name.slice(0, dot) : file.name;
      const kind = dot > 0 ? file.name.slice(dot + 1).toUpperCase() : 'Archivo';
      const { data, error } = await supabase.from('job_files').insert({ job_id: jobId, logical_name: logicalName, kind }).select().single();
      if (error) throw error;
      fileId = data.id;
    }
    const existing = job?.files.find((f) => f.id === fileId);
    const nextVersion = (existing?.versions.length ?? 0) + 1;
    const { error: versionError } = await supabase.from('file_versions').insert({
      file_id: fileId, version: nextVersion, file_name: file.name,
      size_kb: Math.max(1, Math.round(file.size / 1024)), uploaded_by: byUserId,
    });
    if (versionError) throw versionError;
    await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await insertActivity(set, jobId, byUserId, 'archivo', `Subió ${file.name}.`);
    if (job) await insertNotifications([job.responsibleUserId, ...job.assignedUserIds].filter((id) => id !== byUserId), jobId, `Se cargó un nuevo archivo en ${jobLabel(job)}.`);
    await refreshJob(set, jobId);
    await refreshMyNotifications(set, get);
  },

  deleteFileVersion: async (jobId, fileId, versionId, byUserId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    const file = job?.files.find((f) => f.id === fileId);
    const versionName = file?.versions.find((v) => v.id === versionId)?.fileName ?? 'un archivo';
    const { error } = await supabase.from('file_versions').delete().eq('id', versionId);
    if (error) throw error;
    // Si era la última versión de ese archivo, no dejar el grupo vacío colgado.
    if (file && file.versions.length <= 1) {
      const { error: groupError } = await supabase.from('job_files').delete().eq('id', fileId);
      if (groupError) throw groupError;
    }
    await supabase.from('jobs').update({ last_activity_at: new Date().toISOString() }).eq('id', jobId);
    await insertActivity(set, jobId, byUserId, 'archivo', `Eliminó ${versionName}.`);
    await refreshJob(set, jobId);
  },

  approveFileVersion: async (jobId, fileId, versionId, byUserId) => {
    const { error: unsetError } = await supabase.from('file_versions').update({ approved: false }).eq('file_id', fileId);
    if (unsetError) throw unsetError;
    const { error } = await supabase.from('file_versions').update({ approved: true }).eq('id', versionId);
    if (error) throw error;
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
    const { error } = await supabase.from('quality_checks').update({ checked: !item?.checked }).eq('job_id', jobId).eq('key', key);
    if (error) throw error;
    await insertActivity(set, jobId, byUserId, 'control_calidad', 'Actualizó el checklist de control de calidad.');
    await refreshJob(set, jobId);
  },

  completeInstallation: async (jobId, notes, byUserId) => {
    const { error: instError } = await supabase.from('installations').update({ completed: true, completed_at: new Date().toISOString(), completed_notes: notes }).eq('job_id', jobId);
    if (instError) throw instError;
    const { error } = await supabase.from('jobs').update({ status: 'TERMINADO', finished_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }).eq('id', jobId);
    if (error) throw error;
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
    const { error } = await supabase.from('profiles').update({ active }).eq('id', userId);
    if (error) throw error;
    set((s) => ({ users: s.users.map((u) => u.id === userId ? { ...u, active } : u) }));
  },

  // Borrado lógico (Fase 4, 17/09) — antes era un DELETE físico con cascade real
  // (sin rastro ni forma de deshacer). "Eliminar" ahora solo marca deleted_at/
  // deleted_by: el trabajo desaparece de Dashboard/Trabajos/Kanban pero sigue
  // entero (archivos, comentarios, historial) y es consultable/restaurable desde
  // Histórico. El trigger jobs_update_guard (002_policies.sql) exige admin/
  // coordinador para tocar estos dos campos, espejo de canDeleteJob en la UI.
  deleteJob: async (jobId) => {
    const before = get().jobs.find((j) => j.id === jobId);
    const nowIso = new Date().toISOString();
    const byUserId = get().currentUser?.id ?? null;
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, deletedAt: nowIso, deletedBy: byUserId } : j) }));
    const { error } = await supabase.from('jobs').update({ deleted_at: nowIso, deleted_by: byUserId }).eq('id', jobId);
    if (error) {
      if (before) set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? before : j) }));
      throw error;
    }
    if (byUserId) await insertActivity(set, jobId, byUserId, 'eliminar', 'Eliminó el trabajo.');
  },

  restoreJob: async (jobId) => {
    const before = get().jobs.find((j) => j.id === jobId);
    set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? { ...j, deletedAt: undefined, deletedBy: undefined } : j) }));
    const { error } = await supabase.from('jobs').update({ deleted_at: null, deleted_by: null }).eq('id', jobId);
    if (error) {
      if (before) set((s) => ({ jobs: s.jobs.map((j) => j.id === jobId ? before : j) }));
      throw error;
    }
    const byUserId = get().currentUser?.id;
    if (byUserId) await insertActivity(set, jobId, byUserId, 'restaurar', 'Restauró el trabajo eliminado.');
  },

  resetDemoData: async () => { await get_loadAll(set, get); },
  refreshAll: async () => { await get_loadAll(set, get); },

  loadJobComments: async (jobId) => { await refreshComments(set, jobId); },
  loadJobActivity: async (jobId) => {
    const { data, error } = await supabase.from('activity_log').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map(mapActivity);
    set((s) => ({ activityLog: [...rows, ...s.activityLog.filter((a) => a.jobId !== jobId)] }));
  },

  // ============ Métricas ============
  // Trae la cronología de estados de todos los trabajos (paginada: Supabase
  // devuelve hasta 1000 filas por pedido) + los objetivos. Trabajos, clientes y
  // presupuestos ya están en el store; los cálculos viven en lib/metrics.ts.
  loadMetrics: async () => {
    const PAGE = 1000;
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.rpc('metrics_status_events').range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const { data: goals, error: gErr } = await supabase.from('metric_goals').select('*').order('created_at', { ascending: false });
    if (gErr) throw gErr;
    // Los importes no frenan el resto de Métricas (ej. si falta correr la 029).
    try { await get().loadJobPrices(); set({ jobPricesError: null }); }
    catch (e) { console.warn('[métricas] no se pudieron leer los importes:', e); set({ jobPricesError: friendlyError(e) }); }
    set({ metricsEvents: rows.map(mapStatusEvent), goals: (goals ?? []).map(mapMetricGoal), metricsLoadedAt: new Date().toISOString() });
  },

  loadJobPrices: async () => {
    const PAGE = 1000;
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('job_prices').select('*').range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    set({ jobPrices: Object.fromEntries(rows.map((r) => [r.job_id, mapJobPrice(r)])), jobPricesLoaded: true });
  },

  // El historial solo dice que se cargó, nunca el monto: el Historial de la ficha
  // lo ve cualquiera que vea el trabajo, el importe no.
  setJobPrice: async (jobId, { enteredAmount, withIva, note }) => {
    const me = get().currentUser;
    if (!me) throw new Error('Tenés que iniciar sesión.');
    if (!Number.isFinite(enteredAmount) || enteredAmount < 0) throw new Error('El importe tiene que ser un número positivo.');
    const ivaRate = 0.21;
    const had = !!get().jobPrices[jobId];
    const { data, error } = await supabase.from('job_prices').upsert({
      job_id: jobId, amount_net: withIva ? Math.round((enteredAmount / (1 + ivaRate)) * 100) / 100 : enteredAmount,
      entered_amount: enteredAmount, entered_with_iva: withIva, iva_rate: ivaRate, note, updated_by: me.id, updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    set((s) => ({ jobPrices: { ...s.jobPrices, [jobId]: mapJobPrice(data) } }));
    await insertActivity(set, jobId, me.id, 'importe', had ? 'Actualizó el importe final.' : 'Cargó el importe final.');
  },

  clearJobPrice: async (jobId) => {
    const me = get().currentUser;
    if (!me) throw new Error('Tenés que iniciar sesión.');
    const { error } = await supabase.from('job_prices').delete().eq('job_id', jobId);
    if (error) throw error;
    set((s) => { const next = { ...s.jobPrices }; delete next[jobId]; return { jobPrices: next }; });
    await insertActivity(set, jobId, me.id, 'importe', 'Quitó el importe final.');
  },

  saveGoal: async (g) => {
    const me = get().currentUser;
    if (!me) throw new Error('Tenés que iniciar sesión.');
    const { data, error } = await supabase.from('metric_goals').insert({
      title: g.title, metric_key: g.metricKey, baseline_from: g.baselineFrom, baseline_to: g.baselineTo,
      baseline_value: g.baselineValue, baseline_n: g.baselineN, target_value: g.targetValue,
      start_date: g.startDate, end_date: g.endDate, owner_user_id: g.ownerUserId, notes: g.notes, created_by: me.id,
    }).select().single();
    if (error) throw error;
    set((s) => ({ goals: [mapMetricGoal(data), ...s.goals] }));
  },

  archiveGoal: async (goalId) => {
    const at = new Date().toISOString();
    const { error } = await supabase.from('metric_goals').update({ archived_at: at }).eq('id', goalId);
    if (error) throw error;
    set((s) => ({ goals: s.goals.map((g) => g.id === goalId ? { ...g, archivedAt: at } : g) }));
  },

  // ============ Presupuestos ============
  // Un presupuesto NUNCA toca la tabla `jobs` — es su propia tabla, con su
  // propio `code` autogenerado (PRE-2026-XXXXX, nunca un N° de Copernico/TRB).
  // Mientras no se implemente el paso de "confirmar → convertir en trabajo"
  // (a propósito, todavía no — ver types/index.ts), un presupuesto no puede
  // aparecer en Trabajos/Kanban/Dashboard porque ni siquiera comparten tabla.
  loadQuotes: async () => {
    const { data, error } = await supabase.from('quotes').select('*').order('last_activity_at', { ascending: false });
    if (error) throw error;
    set({ quotes: (data ?? []).map(mapQuote), quotesLoaded: true });
  },

  createQuote: async (input) => {
    const { data, error } = await supabase.from('quotes').insert({
      client_id: input.clientId, name: input.name, items: input.items, created_by_user_id: input.createdByUserId,
    }).select().single();
    if (error) throw error;
    const quote = mapQuote(data);
    set((s) => ({ quotes: [quote, ...s.quotes] }));
    return quote;
  },

  updateQuote: async (quoteId, patch) => {
    const before = get().quotes.find((q) => q.id === quoteId);
    const nowIso = new Date().toISOString();
    set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? { ...q, ...patch, lastActivityAt: nowIso } : q) }));
    const dbPatch: Record<string, unknown> = { last_activity_at: nowIso };
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.clientId !== undefined) dbPatch.client_id = patch.clientId;
    if (patch.items !== undefined) dbPatch.items = patch.items;
    const { error } = await supabase.from('quotes').update(dbPatch).eq('id', quoteId);
    if (error) {
      if (before) set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? before : q) }));
      throw error;
    }
  },

  setQuoteStatus: async (quoteId, status) => {
    const before = get().quotes.find((q) => q.id === quoteId);
    const nowIso = new Date().toISOString();
    set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? { ...q, status, lastActivityAt: nowIso } : q) }));
    const { error } = await supabase.from('quotes').update({ status, last_activity_at: nowIso }).eq('id', quoteId);
    if (error) {
      if (before) set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? before : q) }));
      throw error;
    }
  },

  // El permiso real se exige en la UI (canSetQuoteValue) Y en la base (trigger
  // quotes_price_guard en 002_policies.sql) — si alguien sin permiso llega a
  // llamar esto igual, la base lo rechaza.
  setQuoteValue: async (quoteId, price, priceIncludesIva) => {
    const before = get().quotes.find((q) => q.id === quoteId);
    const nowIso = new Date().toISOString();
    set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? { ...q, price, priceIncludesIva, lastActivityAt: nowIso } : q) }));
    const { error } = await supabase.from('quotes').update({ price, price_includes_iva: priceIncludesIva, last_activity_at: nowIso }).eq('id', quoteId);
    if (error) {
      if (before) set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? before : q) }));
      throw error;
    }
  },

  // Presupuesto confirmado por el cliente → se convierte en un trabajo real.
  // Reusa `createJob` entero (mismo insert, mismo historial, mismas
  // notificaciones — "Te asignaron el trabajo..." al responsable y "Nueva
  // ficha" a los demás admins, sin sistema paralelo) para no duplicar nada de
  // lo que ya existe. El trabajo nace en PENDIENTE (createJob decide el estado
  // inicial igual que siempre) y sin N° de Copernico/TRB (mismo mecanismo de
  // siempre: nace en null, se carga a mano después — ver decisión 4, CLAUDE.md
  // sección 4).
  confirmQuote: async (quoteId, extra, byUserId) => {
    const quote = get().quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('No se encontró el presupuesto.');
    if (quote.status === 'CONFIRMADO' || quote.convertedJobId) {
      throw new Error('Este presupuesto ya fue confirmado — no se puede volver a convertir.');
    }
    if (!extra.jobTypeId || !extra.committedDate || !extra.responsibleUserId) {
      throw new Error('Faltan datos para poder generar el trabajo.');
    }

    // "Reserva" la confirmación con un update condicional (solo si sigue sin
    // confirmar) antes de crear nada — si dos personas confirman casi al mismo
    // tiempo, la segunda encuentra `status` ya en CONFIRMADO, el `.neq` no
    // matchea ninguna fila, `locked` vuelve vacío, y se aborta sin generar un
    // segundo trabajo (Caso C del pedido: prevenir duplicados).
    const nowIso = new Date().toISOString();
    const { data: locked, error: lockError } = await supabase
      .from('quotes')
      .update({ status: 'CONFIRMADO', last_activity_at: nowIso })
      .eq('id', quoteId)
      .neq('status', 'CONFIRMADO')
      .select()
      .maybeSingle();
    if (lockError) throw lockError;
    if (!locked) throw new Error('Este presupuesto ya fue confirmado — no se puede volver a convertir.');

    let job: Job | undefined;
    try {
      // Copia lo que ya está cargado en el presupuesto — nada se vuelve a
      // pedir. `unit` (que Product no tiene) se conserva dentro de las notas.
      const products = quote.items.map(quoteItemToProduct);
      const description = quote.items.map((it) => it.label).filter(Boolean).join(' + ');

      job = await get().createJob({
        name: quote.name, clientId: quote.clientId, contactName: '', contactPhone: '',
        jobTypeId: extra.jobTypeId, description,
        committedDate: new Date(`${extra.committedDate}T18:00`).toISOString(),
        priorityManual: 'NORMAL', clientImportant: false,
        products, specialRequirements: '',
        requiresInstallation: false, installAddress: '', installContactPhone: '', installDate: '',
        createdByUserId: byUserId, responsibleUserId: extra.responsibleUserId,
        assignedUserIds: [], assignedNames: [],
        sourceQuoteId: quote.id,
      });

      const { error } = await supabase.from('quotes').update({ converted_job_id: job.id }).eq('id', quoteId);
      if (error) throw error;
      set((s) => ({ quotes: s.quotes.map((q) => q.id === quoteId ? { ...q, status: 'CONFIRMADO', convertedJobId: job!.id, lastActivityAt: nowIso } : q) }));
      return job;
    } catch (err) {
      if (!job) {
        // Todavía no se llegó a crear ningún trabajo — deshacemos el "lock" de
        // arriba para que se pueda reintentar sin riesgo de duplicar nada.
        await supabase.from('quotes').update({ status: quote.status }).eq('id', quoteId);
      } else {
        // El trabajo YA se creó pero falló guardar el vínculo de vuelta en el
        // presupuesto — a propósito NO revertimos el status acá: reintentar
        // desde este mismo estado arriesgaría crear un SEGUNDO trabajo
        // (justo lo que hay que prevenir). Queda un presupuesto Confirmado
        // sin `convertedJobId` — se completa a mano (ver el error abajo).
        console.error('[presupuestos] el trabajo se creó pero no se pudo guardar el vínculo de vuelta:', err);
      }
      throw err;
    }
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
    const [
      { data: profiles, error: e1 }, { data: clients, error: e2 }, jobs,
      { data: jobTypes, error: e3 }, { data: materials, error: e4 },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('clients').select('*, client_contacts(*)').order('name'),
      fetchAllJobs(),
      supabase.from('job_types').select('*').order('label'),
      supabase.from('materials').select('*').order('label'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    // Catálogos: si el fetch falla (ej. tabla sin migrar todavía en una base
    // vieja) no tumba la carga entera — se sigue con los valores semilla en
    // memoria (DEFAULT_JOB_TYPES/DEFAULT_MATERIALS) en vez de dejar la app sin cargar.
    if (e3) console.warn('[catálogos] no se pudieron leer job_types, se usa el valor semilla:', e3.message);
    if (e4) console.warn('[catálogos] no se pudieron leer materials, se usa el valor semilla:', e4.message);
    set(() => ({
      users: (profiles ?? []).map(mapProfile), clients: (clients ?? []).map(mapClient), jobs,
      ...(e3 ? {} : { jobTypes: (jobTypes ?? []).map(mapJobType) }),
      ...(e4 ? {} : { materials: (materials ?? []).map(mapMaterial) }),
    }));
    await refreshMyNotifications(set, get);
  } catch (err: any) {
    set(() => ({ loadError: friendlyError(err) }));
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
