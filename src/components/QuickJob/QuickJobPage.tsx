import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { JOB_TYPES, MATERIALS } from '../../data/catalog';
import { PRIORITY_META } from '../../lib/priority';
import type { JobTypeId, MaterialId, Priority } from '../../types';

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30';
const labelCls = 'block text-xs font-medium text-ink-600 mb-1.5';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {hint && <p className="text-xs text-ink-400 mt-0.5">{hint}</p>}
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
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [name, setName] = useState('');
  const [jobTypeId, setJobTypeId] = useState<JobTypeId>('carteleria');
  const [description, setDescription] = useState('');
  const [committedDate, setCommittedDate] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');

  const [quantity, setQuantity] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [materialIds, setMaterialIds] = useState<MaterialId[]>([]);
  const [technique, setTechnique] = useState('');
  const [finish, setFinish] = useState('');
  const [color, setColor] = useState('');
  const [observations, setObservations] = useState('');

  const [requiresInstallation, setRequiresInstallation] = useState(false);
  const [installAddress, setInstallAddress] = useState('');
  const [installContactPhone, setInstallContactPhone] = useState('');
  const [installDate, setInstallDate] = useState('');

  const [responsibleUserId, setResponsibleUserId] = useState(user.id);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const nameFieldRef = useRef<HTMLInputElement>(null);

  function toggleMaterial(id: MaterialId) {
    setMaterialIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }
  function toggleAssigned(id: string) {
    setAssignedUserIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  }

  const canSubmit = !!clientName.trim() && !!name.trim() && !!description.trim() && !!committedDate
    && (!requiresInstallation || !!installAddress.trim());

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const jobType = JOB_TYPES.find((t) => t.id === jobTypeId)!;
      const clientId = await findOrCreateClient(clientName);
      const job = await createJob({
        name, clientId, contactName, contactPhone, jobTypeId, description,
        committedDate: new Date(`${committedDate}T18:00`).toISOString(),
        priorityManual: priority, clientImportant: false,
        quantity, measurements, materialIds, technique, finish, color,
        observations, specialRequirements: '', activeStageKeys: jobType.defaultStages,
        requiresInstallation, installAddress, installContactPhone, installDate,
        createdByUserId: user.id, responsibleUserId, assignedUserIds,
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
      <p className="text-sm text-ink-500 mb-4">Todo en una sola pantalla — pensada para cargar un trabajo mientras estás al teléfono o el cliente está al lado.</p>

      <div className="space-y-4">
        <Section title="Cliente y trabajo">
          <div>
            <label htmlFor="qj-client" className={labelCls}>Cliente</label>
            <input
              id="qj-client" className={inputCls} list="qj-clientes-existentes" value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre tal cual figura en Copernico (o nuevo, se crea solo)"
              autoFocus
            />
            <datalist id="qj-clientes-existentes">
              {clients.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="qj-contact-name" className={labelCls}>Contacto</label>
              <input id="qj-contact-name" className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Quién pide el trabajo" /></div>
            <div><label htmlFor="qj-contact-phone" className={labelCls}>Tel. / WhatsApp</label>
              <input id="qj-contact-phone" className={inputCls} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="11 2345 6789" /></div>
          </div>
          <div><label htmlFor="qj-name" className={labelCls}>Nombre del trabajo</label>
            <input ref={nameFieldRef} id="qj-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 20 carteles para sucursales" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="qj-type" className={labelCls}>Tipo de trabajo</label>
              <select id="qj-type" className={inputCls} value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value as JobTypeId)}>
                {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label htmlFor="qj-date" className={labelCls}>Fecha de entrega</label>
              <input id="qj-date" type="date" className={inputCls} value={committedDate} onChange={(e) => setCommittedDate(e.target.value)} /></div>
          </div>
          <div><label htmlFor="qj-description" className={labelCls}>Descripción — qué hay que producir</label>
            <textarea id="qj-description" className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><label htmlFor="qj-priority" className={labelCls}>Prioridad</label>
            <select id="qj-priority" className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>
        </Section>

        <Section title="Especificaciones" hint="Opcional — cargalas ahora si el cliente te las está dando, si no se completan después desde la ficha.">
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="qj-quantity" className={labelCls}>Cantidad</label>
              <input id="qj-quantity" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <div><label htmlFor="qj-measurements" className={labelCls}>Medidas</label>
              <input id="qj-measurements" className={inputCls} value={measurements} onChange={(e) => setMeasurements(e.target.value)} /></div>
          </div>
          <div>
            <span className={labelCls}>Material</span>
            <div className="flex flex-wrap gap-1.5">
              {MATERIALS.map((m) => (
                <button type="button" key={m.id} onClick={() => toggleMaterial(m.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${materialIds.includes(m.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-600'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="qj-technique" className={labelCls}>Técnica</label>
              <input id="qj-technique" className={inputCls} value={technique} onChange={(e) => setTechnique(e.target.value)} /></div>
            <div><label htmlFor="qj-finish" className={labelCls}>Terminación</label>
              <input id="qj-finish" className={inputCls} value={finish} onChange={(e) => setFinish(e.target.value)} /></div>
          </div>
          <div><label htmlFor="qj-color" className={labelCls}>Color</label>
            <input id="qj-color" className={inputCls} value={color} onChange={(e) => setColor(e.target.value)} /></div>
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

        <Section title="Asignación">
          <div><label htmlFor="qj-responsible" className={labelCls}>Responsable interno</label>
            <select id="qj-responsible" className={inputCls} value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}>
              {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <span className={labelCls}>Asignar a</span>
            <div className="flex flex-wrap gap-1.5">
              {users.filter((u) => u.active).map((u) => (
                <button type="button" key={u.id} onClick={() => toggleAssigned(u.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${assignedUserIds.includes(u.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-600'}`}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white/95 backdrop-blur border-t border-ink-100 px-5 py-3 flex items-center justify-between gap-3 z-20">
        <span className="text-xs text-ink-400">{canSubmit ? 'Listo para crear' : 'Completá cliente, nombre, descripción y fecha de entrega'}</span>
        <div className="flex items-center gap-2">
          {submitError && <span className="text-xs text-crit-text">{submitError}</span>}
          <button
            disabled={!canSubmit || submitting} onClick={submit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-500 text-white px-5 py-2.5 rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={15} /> {submitting ? 'Creando...' : 'Crear trabajo'}
          </button>
        </div>
      </div>
    </div>
  );
}
