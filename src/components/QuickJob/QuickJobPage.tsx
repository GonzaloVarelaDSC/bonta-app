import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { JOB_TYPES, ASSIGN_ALSO_NAMES } from '../../data/catalog';
import { PRIORITY_META } from '../../lib/priority';
import { ProductsEditor } from '../Common/ProductsEditor';
import { Avatar } from '../Common/Badges';
import type { JobTypeId, Priority, Product } from '../../types';

function emptyProduct(): Product {
  return { id: crypto.randomUUID(), label: '', materialIds: [], sizeItems: [{ quantity: '', width: '', height: '' }], notes: '', checked: false };
}

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';
const LAST_TYPE_KEY = 'bonta-qj-last-type';

// Fecha local (no UTC) — con .toISOString() a secas la fecha puede correrse un
// día según la hora y el huso horario del navegador.
function addDaysLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DATE_PRESETS = [
  { label: 'Mañana', days: 1 },
  { label: '3 días', days: 3 },
  { label: 'Esta semana', days: 5 },
  { label: '+1 semana', days: 10 },
];

// Sugerencia automática al elegir la fecha — sigue siendo 100% editable
// después a mano, esto solo precarga un punto de partida razonable.
function suggestPriority(dateStr: string): Priority {
  if (!dateStr) return 'NORMAL';
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = dateStr.split('-').map(Number);
  const daysDiff = Math.round((new Date(y, m - 1, d).getTime() - todayOnly.getTime()) / 86_400_000);
  if (daysDiff <= 1) return 'CRITICO';
  if (daysDiff <= 3) return 'URGENTE';
  if (daysDiff <= 7) return 'NORMAL';
  return 'PLANIFICADO';
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {hint && <p className="text-xs text-ink-700 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// Carga de un solo tramo (sin pasos) para cargar un trabajo mientras el
// cliente está al teléfono o al lado nuestro — sin clicks de más, con las
// especificaciones técnicas a mano (a diferencia del wizard normal, que las
// deja para después porque asume que se van a completar con más tiempo).
export function QuickJobPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser)!;
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const createJob = useStore((s) => s.createJob);
  const findOrCreateClient = useStore((s) => s.findOrCreateClient);

  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [jobTypeId, setJobTypeId] = useState<JobTypeId>(() => {
    const saved = localStorage.getItem(LAST_TYPE_KEY);
    return JOB_TYPES.some((t) => t.id === saved) ? (saved as JobTypeId) : JOB_TYPES[0].id;
  });
  const [description, setDescription] = useState('');
  const [committedDate, setCommittedDate] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  // Una vez que se elige la prioridad a mano, la fecha no la vuelve a pisar — un
  // trabajo a 10 días puede ser crítico igual si es muy grande (Gonzalo, 07/09).
  const [priorityTouched, setPriorityTouched] = useState(false);

  const [products, setProducts] = useState<Product[]>([emptyProduct()]);
  const [observations, setObservations] = useState('');

  const [requiresInstallation, setRequiresInstallation] = useState(false);
  const [installAddress, setInstallAddress] = useState('');
  const [installContactPhone, setInstallContactPhone] = useState('');
  const [installDate, setInstallDate] = useState('');

  // "Asignado por" = siempre quien está logueado (Gonzalo, 07/09: "que esté
  // vinculado al usuario del login — si entro con la cuenta de Martín, que la
  // ficha diga «Asignado por Martín»"). Ya no es un desplegable editable.
  const createdByUserId = user.id;

  // Si quien crea el trabajo no es él mismo asignable (ej. Pancho, dueño), no
  // tiene sentido precargarlo a él como responsable — arranca en el primer
  // productor disponible en su lugar.
  const producers = users.filter((u) => u.active && u.isProducer);
  const [responsibleUserId, setResponsibleUserId] = useState(
    () => (producers.some((u) => u.id === user.id) ? user.id : producers[0]?.id ?? user.id)
  );
  // "Asignar también a" = gente del taller sin cuenta (lista fija de nombres).
  const [assignedNames, setAssignedNames] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const nameFieldRef = useRef<HTMLInputElement>(null);

  function selectJobType(id: JobTypeId) {
    setJobTypeId(id);
    localStorage.setItem(LAST_TYPE_KEY, id);
  }
  function changeDate(newDate: string) {
    setCommittedDate(newDate);
    if (!priorityTouched) setPriority(suggestPriority(newDate));
  }
  function changePriority(p: Priority) {
    setPriority(p);
    setPriorityTouched(true);
  }
  function toggleAssignedName(name: string) {
    setAssignedNames((a) => a.includes(name) ? a.filter((x) => x !== name) : [...a, name]);
  }

  // Única condición dura: sin al menos una medida cargada en algún producto,
  // no se puede crear el trabajo. El resto (cliente, nombre, descripción,
  // fecha, dirección) avisa pero no bloquea — se completa con un valor de
  // referencia y se termina de cargar después desde la ficha.
  const hasSizeData = products.some((p) => p.sizeItems.some((it) => it.quantity.trim() || it.width.trim() || it.height.trim()));
  const softWarnings: string[] = [];
  if (!clientName.trim()) softWarnings.push('cliente');
  if (!name.trim()) softWarnings.push('nombre del trabajo');
  if (!description.trim()) softWarnings.push('descripción');
  if (!committedDate) softWarnings.push('fecha de entrega');
  if (requiresInstallation && !installAddress.trim()) softWarnings.push('dirección de instalación');

  async function submit() {
    if (softWarnings.length > 0) {
      const ok = confirm(`Vas a crear el trabajo sin completar: ${softWarnings.join(', ')}. Se puede completar después desde la ficha — ¿confirmás igual?`);
      if (!ok) return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const jobType = JOB_TYPES.find((t) => t.id === jobTypeId)!;
      const finalName = name.trim() || description.trim().slice(0, 60) || 'Trabajo sin nombre';
      const finalClientName = clientName.trim() || 'Cliente sin especificar';
      const finalDate = committedDate || addDaysLocal(7);
      const clientId = await findOrCreateClient(finalClientName);
      const job = await createJob({
        name: finalName, clientId, contactName: '', contactPhone: '', jobTypeId, description,
        committedDate: new Date(`${finalDate}T18:00`).toISOString(),
        priorityManual: priority, clientImportant: false,
        products: products
          .map((p) => ({ ...p, sizeItems: p.sizeItems.filter((it) => it.quantity || it.width || it.height) }))
          .filter((p) => p.label.trim() || p.materialIds.length > 0 || p.sizeItems.length > 0 || p.notes.trim()),
        observations, specialRequirements: '', activeStageKeys: jobType.defaultStages,
        requiresInstallation, installAddress, installContactPhone, installDate,
        createdByUserId, responsibleUserId, assignedUserIds: [], assignedNames,
      });
      navigate(`/trabajos/${job.id}`);
    } catch (err: any) {
      setSubmitError(err.message ?? 'No se pudo crear el trabajo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-5 max-w-3xl mx-auto pb-28">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-100 text-brand-600 shrink-0"><Zap size={15} /></span>
        <h1 className="text-lg font-display font-bold text-ink-900">Carga rápida</h1>
      </div>
      <p className="text-sm text-ink-700 mb-4">Todo en una sola pantalla — pensada para cargar un trabajo mientras estás al teléfono o el cliente está al lado.</p>

      <div className="space-y-4">
        <Section title="Cliente y trabajo">
          <div>
            <label htmlFor="qj-client" className={labelCls}>Cliente</label>
            <input
              id="qj-client" className={inputCls} list="qj-clientes-existentes" value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente — si es nuevo y todavía no está en Copernico, no importa"
              autoFocus
            />
            <datalist id="qj-clientes-existentes">
              {clients.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div><label htmlFor="qj-name" className={labelCls}>Nombre del trabajo</label>
            <input ref={nameFieldRef} id="qj-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 20 carteles para sucursales" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="qj-type" className={labelCls}>Tipo de trabajo</label>
              <select id="qj-type" className={inputCls} value={jobTypeId} onChange={(e) => selectJobType(e.target.value as JobTypeId)}>
                {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label htmlFor="qj-date" className={labelCls}>Fecha de entrega</label>
              <input id="qj-date" type="date" className={inputCls} value={committedDate} onChange={(e) => changeDate(e.target.value)} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {DATE_PRESETS.map((p) => (
                  <button
                    type="button" key={p.label} onClick={() => changeDate(addDaysLocal(p.days))}
                    className={`text-[11px] px-2 py-1 rounded-full border ${committedDate === addDaysLocal(p.days) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-700 hover:border-ink-300'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div><label htmlFor="qj-description" className={labelCls}>Descripción — qué hay que producir</label>
            <textarea id="qj-description" className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><label htmlFor="qj-priority" className={labelCls}>Prioridad</label>
            <select id="qj-priority" className={inputCls} value={priority} onChange={(e) => changePriority(e.target.value as Priority)}>
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label} — {v.sla}</option>)}
            </select>
            <p className="text-[11px] text-ink-700 mt-1">
              {priorityTouched
                ? 'La elegiste a mano — la fecha ya no la cambia sola.'
                : 'Se sugiere sola según la fecha de entrega. Podés forzarla (un trabajo grande puede ser crítico aunque falten días).'}
            </p>
          </div>
        </Section>

        <Section title="Productos" hint="Un trabajo puede tener más de un producto (ej. Corpóreo 3D + Corpóreo en acrílico) — cada uno con su propio material y medidas.">
          <ProductsEditor products={products} onChange={setProducts} jobTypeId={jobTypeId} />
          <div><label htmlFor="qj-obs" className={labelCls}>Observaciones</label>
            <textarea id="qj-obs" className={inputCls} rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} /></div>
        </Section>

        <Section title="Instalación">
          <label className="flex items-center gap-2.5 text-sm text-ink-700 bg-ink-50 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={requiresInstallation} onChange={(e) => setRequiresInstallation(e.target.checked)} className="rounded" />
            Este trabajo requiere instalación en sitio
          </label>
          {requiresInstallation && (
            <div className="grid grid-cols-2 gap-4 bg-ink-50 rounded-lg p-3">
              <div className="col-span-2"><label htmlFor="qj-install-address" className={labelCls}>Dirección *</label>
                <input id="qj-install-address" className={inputCls} value={installAddress} onChange={(e) => setInstallAddress(e.target.value)} /></div>
              <div><label htmlFor="qj-install-phone" className={labelCls}>Teléfono de contacto</label>
                <input id="qj-install-phone" className={inputCls} value={installContactPhone} onChange={(e) => setInstallContactPhone(e.target.value)} /></div>
              <div><label htmlFor="qj-install-date" className={labelCls}>Fecha</label>
                <input id="qj-install-date" type="date" className={inputCls} value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></div>
            </div>
          )}
        </Section>

        <Section title="Asignación" hint="Queda registrado que este trabajo lo asignás vos. Elegí quién es el responsable de que avance.">
          <div className="rounded-xl border border-brand-300 bg-brand-100/50 p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Asigna</span>
                <span className="inline-flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 border border-brand-200">
                  <Avatar name={user.name} color={user.avatarColor} size={22} />
                  <span className="text-sm font-semibold text-ink-900">{user.name}</span>
                </span>
              </div>
              <ArrowRight size={18} className="text-brand-600 shrink-0 mb-2" aria-hidden />
              <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                <label htmlFor="qj-responsible" className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Responsable</label>
                <select
                  id="qj-responsible"
                  className="w-full border border-brand-200 bg-white rounded-full px-3.5 py-2 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}
                >
                  {producers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-ink-700 mt-2.5">
              El responsable ve el trabajo en el filtro <strong>«A mí»</strong> del Dashboard; vos lo ves en <strong>«Por mí»</strong>.
            </p>
          </div>
          <div>
            <span className={labelCls}>Asignar también a</span>
            <div className="flex flex-wrap gap-1.5">
              {ASSIGN_ALSO_NAMES.map((name) => (
                <button type="button" key={name} onClick={() => toggleAssignedName(name)} aria-pressed={assignedNames.includes(name)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${assignedNames.includes(name) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-700'}`}>
                  {name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-700 mt-1">Opcional — gente del taller / instaladores que también trabaja en este pedido.</p>
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white/95 backdrop-blur border-t border-ink-100 px-5 py-3 flex items-center justify-between gap-3 z-20">
        <span className="text-xs text-ink-700">
          {!hasSizeData
            ? 'Cargá al menos una medida (cantidad, ancho o alto) para poder crear el trabajo'
            : softWarnings.length > 0
              ? `Se puede crear igual — falta: ${softWarnings.join(', ')}`
              : 'Listo para crear'}
        </span>
        <div className="flex items-center gap-2">
          {submitError && <span className="text-xs text-crit-text">{submitError}</span>}
          <button
            disabled={!hasSizeData || submitting} onClick={submit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-500 text-white px-5 py-2.5 rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={15} /> {submitting ? 'Creando...' : 'Crear trabajo'}
          </button>
        </div>
      </div>
    </div>
  );
}
