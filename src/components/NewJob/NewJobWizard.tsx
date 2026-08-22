import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { JOB_TYPES, STAGE_LABELS } from '../../data/catalog';
import { PRIORITY_META } from '../../lib/priority';
import type { JobTypeId, MaterialId, Priority, StageKey } from '../../types';

const STEPS = ['Cliente y descripción', 'Entrega y prioridad', 'Producción', 'Archivos', 'Confirmación'];

export function NewJobWizard() {
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser)!;
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const createJob = useStore((s) => s.createJob);
  const findOrCreateClient = useStore((s) => s.findOrCreateClient);

  const [step, setStep] = useState(0);
  const [clientName, setClientName] = useState('');
  const [contactName, setContactName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobTypeId, setJobTypeId] = useState<JobTypeId>('carteleria');
  const [committedDate, setCommittedDate] = useState('');
  const [priorityManual, setPriorityManual] = useState<Priority | null>(null);
  const [clientImportant, setClientImportant] = useState(false);
  // Estas características técnicas ya no se cargan en el alta: el trabajo se crea con
  // estado "Falta información" y se completan después desde la ficha, si hace falta —
  // la fuente real es el mail o WhatsApp del cliente, no este formulario.
  const quantity = '';
  const measurements = '';
  const materialIds: MaterialId[] = [];
  const technique = '';
  const finish = '';
  const color = '';
  const observations = '';
  const specialRequirements = '';
  const jobType = JOB_TYPES.find((t) => t.id === jobTypeId)!;
  const [activeStages, setActiveStages] = useState<StageKey[]>(jobType.defaultStages);
  const [requiresInstallation, setRequiresInstallation] = useState(false);
  const [installAddress, setInstallAddress] = useState('');
  const [installContactPhone, setInstallContactPhone] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [installTime, setInstallTime] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState(user.id);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);

  function selectJobType(id: JobTypeId) {
    setJobTypeId(id);
    setActiveStages(JOB_TYPES.find((t) => t.id === id)!.defaultStages);
  }
  function toggleStage(k: StageKey) {
    setActiveStages((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  }
  function toggleAssigned(id: string) {
    setAssignedUserIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  }

  const canNext = [
    !!clientName.trim() && !!name.trim() && !!description.trim(),
    !!committedDate,
    activeStages.length > 0,
    true,
    true,
  ][step];

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
    const clientId = await findOrCreateClient(clientName);
    const job = await createJob({
      name, clientId, contactName, jobTypeId, description,
      committedDate: new Date(committedDate).toISOString(),
      priorityManual, clientImportant, quantity, measurements, materialIds, technique, finish, color,
      observations, specialRequirements, activeStageKeys: activeStages,
      requiresInstallation, installAddress, installContactPhone, installDate, installTime,
      responsibleUserId, assignedUserIds,
    });
    navigate(`/trabajos/${job.id}`);
    } catch (err: any) {
      setSubmitError(err.message ?? 'No se pudo crear el trabajo.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30';
  const labelCls = 'block text-xs font-medium text-ink-600 mb-1.5';

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h1 className="text-lg font-display font-bold text-ink-900 mb-1">Nuevo trabajo</h1>
      <p className="text-sm text-ink-500 mb-3">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>

      <div className="flex gap-1.5 mb-4">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-ink-950' : 'bg-ink-200'}`} />
        ))}
      </div>

      <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
        {step === 0 && (
          <>
            <div><label className={labelCls}>Cliente</label>
              <input
                className={inputCls} list="clientes-existentes" value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Escribí el nombre tal cual figura en Copernico"
              />
              <datalist id="clientes-existentes">
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
              <p className="text-[11px] text-ink-400 mt-1">
                Si ya lo cargaste antes te lo va a sugerir. Si es nuevo, se crea solo al guardar el trabajo.
              </p>
            </div>
            <div><label className={labelCls}>Contacto del cliente</label>
              <input className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre de quien pidió el trabajo" /></div>
            <div><label className={labelCls}>Nombre del trabajo</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 20 carteles para sucursales" /></div>
            <div><label className={labelCls}>Tipo de trabajo</label>
              <select className={inputCls} value={jobTypeId} onChange={(e) => selectJobType(e.target.value as JobTypeId)}>
                {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Descripción — qué hay que producir</label>
              <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </>
        )}

        {step === 1 && (
          <>
            <div><label className={labelCls}>Fecha y hora de entrega comprometida</label>
              <input type="datetime-local" className={inputCls} value={committedDate} onChange={(e) => setCommittedDate(e.target.value)} /></div>
            <div><label className={labelCls}>Prioridad</label>
              <select className={inputCls} value={priorityManual ?? ''} onChange={(e) => setPriorityManual(e.target.value ? e.target.value as Priority : null)}>
                <option value="">Calcular automáticamente según la fecha</option>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>Forzar: {v.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={clientImportant} onChange={(e) => setClientImportant(e.target.checked)} className="rounded" />
              Cliente prioritario (sube la prioridad automática de manera preventiva)
            </label>
            <div><label className={labelCls}>Responsable interno</label>
              <select className={inputCls} value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}>
                {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Asignar a</label>
              <div className="flex flex-wrap gap-1.5">
                {users.filter((u) => u.active).map((u) => (
                  <button type="button" key={u.id} onClick={() => toggleAssigned(u.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border ${assignedUserIds.includes(u.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-600'}`}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div><label className={labelCls}>Etapas que incluye este trabajo</label>
              <div className="space-y-1.5">
                {jobType.defaultStages.concat(activeStages.includes('instalacion') ? [] : []).filter((v, i, a) => a.indexOf(v) === i).map((k) => (
                  <label key={k} className="flex items-center gap-2.5 text-sm text-ink-700 bg-ink-50 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={activeStages.includes(k)} onChange={() => toggleStage(k)} className="rounded" />
                    {STAGE_LABELS[k]}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700 pt-2 border-t border-ink-100">
              <input type="checkbox" checked={requiresInstallation} onChange={(e) => { setRequiresInstallation(e.target.checked); if (e.target.checked) toggleStage('instalacion'); }} className="rounded" />
              Este trabajo requiere instalación en sitio
            </label>
            {requiresInstallation && (
              <div className="grid grid-cols-2 gap-4 bg-ink-50 rounded-lg p-3">
                <div className="col-span-2"><label className={labelCls}>Dirección</label><input className={inputCls} value={installAddress} onChange={(e) => setInstallAddress(e.target.value)} /></div>
                <div><label className={labelCls}>Teléfono de contacto</label><input className={inputCls} value={installContactPhone} onChange={(e) => setInstallContactPhone(e.target.value)} /></div>
                <div><label className={labelCls}>Fecha</label><input type="date" className={inputCls} value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></div>
                <div><label className={labelCls}>Hora</label><input type="time" className={inputCls} value={installTime} onChange={(e) => setInstallTime(e.target.value)} /></div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-ink-500">Los archivos de referencia se pueden adjuntar ahora (simulado) o después desde la ficha del trabajo.</p>
            <button type="button" onClick={() => { const n = prompt('Nombre del archivo:'); if (n) setPendingFiles((f) => [...f, n]); }}
              className="text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-4 py-3 w-full hover:bg-brand-50">
              + Adjuntar archivo
            </button>
            {pendingFiles.length > 0 && (
              <ul className="text-sm text-ink-700 space-y-1">
                {pendingFiles.map((f, i) => <li key={i} className="bg-ink-50 rounded-md px-3 py-1.5">{f}</li>)}
              </ul>
            )}
          </>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="text-ink-900 font-semibold">¿Todo correcto?</div>
            <SummaryRow label="Cliente" value={clientName} />
            <SummaryRow label="Trabajo" value={name} />
            <SummaryRow label="Tipo" value={jobType.label} />
            <SummaryRow label="Entrega" value={committedDate ? new Date(committedDate).toLocaleString('es-AR') : '—'} />
            <SummaryRow label="Prioridad" value={priorityManual ? PRIORITY_META[priorityManual].label : 'Automática'} />
            <SummaryRow label="Etapas" value={activeStages.map((k) => STAGE_LABELS[k]).join(', ')} />
            <SummaryRow label="Instalación" value={requiresInstallation ? installAddress || 'Sí (sin dirección aún)' : 'No'} />
            <div className="bg-wait-bg text-wait-text rounded-md px-3 py-2 text-xs">
              ⚠️ El trabajo se va a crear con el estado "Falta información" — medidas, material y técnica se cargan después desde la ficha, si hacen falta.
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-5">
        <button onClick={() => step === 0 ? navigate('/trabajos') : setStep((s) => s - 1)} className="inline-flex items-center gap-1 text-sm text-ink-600 px-3 py-2 rounded-lg hover:bg-ink-100">
          <ChevronLeft size={16} /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {step < STEPS.length - 1 ? (
          <button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-1 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed">
            Siguiente <ChevronRight size={16} />
          </button>
        ) : (
          <button disabled={submitting} onClick={submit} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50">
            <Check size={16} /> {submitting ? 'Creando...' : 'Crear trabajo'}
          </button>
        )}
      </div>
      {submitError && <div className="mt-3 text-xs text-crit-text bg-crit-bg rounded-md px-3 py-2">{submitError}</div>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-ink-50 pb-2">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-800 font-medium text-right max-w-[60%]">{value || '—'}</span>
    </div>
  );
}
