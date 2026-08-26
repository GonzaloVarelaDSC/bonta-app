import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, UploadCloud, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { JOB_TYPES } from '../../data/catalog';
import { PRIORITY_META } from '../../lib/priority';
import type { JobTypeId, MaterialId, Priority } from '../../types';

const STEPS = ['Cliente y descripción', 'Entrega y prioridad', 'Instalación', 'Archivos', 'Confirmación'];

function fmtFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
  const [contactPhone, setContactPhone] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobTypeId, setJobTypeId] = useState<JobTypeId>('carteleria');
  const [committedDate, setCommittedDate] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
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
  const [requiresInstallation, setRequiresInstallation] = useState(false);
  const [installAddress, setInstallAddress] = useState('');
  const [installContactPhone, setInstallContactPhone] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState(user.id);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleAssigned(id: string) {
    setAssignedUserIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  }
  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPendingFiles((f) => [...f, ...Array.from(fileList)]);
  }
  function removeFile(i: number) {
    setPendingFiles((f) => f.filter((_, idx) => idx !== i));
  }

  const canNext = [
    !!clientName.trim() && !!name.trim() && !!description.trim(),
    !!committedDate,
    requiresInstallation ? !!installAddress.trim() : true,
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
      name, clientId, contactName, contactPhone, jobTypeId, description,
      // Solo se pide la fecha (no hora) — se completa con las 18:00 (cierre del día
      // de trabajo) para que el cálculo de urgencia siga teniendo sentido por hora.
      committedDate: new Date(`${committedDate}T18:00`).toISOString(),
      priorityManual: priority, clientImportant, quantity, measurements, materialIds, technique, finish, color,
      observations, specialRequirements, activeStageKeys: jobType.defaultStages,
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

  const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h1 className="text-lg font-display font-bold text-ink-900 mb-1">Nuevo trabajo</h1>
      <p className="text-sm text-ink-700 mb-3">Paso {step + 1} de {STEPS.length}: {STEPS[step]}</p>

      <div className="flex gap-1.5 mb-4">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-ink-950' : 'bg-ink-200'}`} />
        ))}
      </div>

      <div className="bg-white border border-ink-100 rounded-xl shadow-card p-5 space-y-3">
        {step === 0 && (
          <>
            <div><label htmlFor="nj-client" className={labelCls}>Cliente</label>
              <input
                id="nj-client" className={inputCls} list="clientes-existentes" value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Escribí el nombre tal cual figura en Copernico"
              />
              <datalist id="clientes-existentes">
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
              <p className="text-[11px] text-ink-700 mt-1">
                Si ya lo cargaste antes te lo va a sugerir. Si es nuevo, se crea solo al guardar el trabajo.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="nj-contact-name" className={labelCls}>Contacto del cliente</label>
                <input id="nj-contact-name" className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre de quien pidió el trabajo" /></div>
              <div><label htmlFor="nj-contact-phone" className={labelCls}>Tel. / WhatsApp del contacto</label>
                <input id="nj-contact-phone" className={inputCls} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="11 2345 6789" /></div>
            </div>
            <div><label htmlFor="nj-name" className={labelCls}>Nombre del trabajo</label>
              <input id="nj-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 20 carteles para sucursales" /></div>
            <div><label htmlFor="nj-type" className={labelCls}>Tipo de trabajo</label>
              <select id="nj-type" className={inputCls} value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value as JobTypeId)}>
                {JOB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label htmlFor="nj-description" className={labelCls}>Descripción — qué hay que producir</label>
              <textarea id="nj-description" className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </>
        )}

        {step === 1 && (
          <>
            <div><label htmlFor="nj-date" className={labelCls}>Fecha de entrega comprometida</label>
              <input id="nj-date" type="date" className={inputCls} value={committedDate} onChange={(e) => setCommittedDate(e.target.value)} /></div>
            <div><label htmlFor="nj-priority" className={labelCls}>Prioridad</label>
              <select id="nj-priority" className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
              <p className="text-[11px] text-ink-700 mt-1">Vos elegís la urgencia — ya no se calcula sola por la fecha de entrega.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={clientImportant} onChange={(e) => setClientImportant(e.target.checked)} className="rounded" />
              Cliente prioritario (solo para tenerlo marcado en la ficha)
            </label>
            <div><label htmlFor="nj-responsible" className={labelCls}>Responsable interno</label>
              <select id="nj-responsible" className={inputCls} value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}>
                {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <p className="text-[11px] text-ink-700 mt-1">
                La persona principal a cargo de que este trabajo avance — quien lo va a ver en "Solo asignados a mí" del Dashboard.
                {users.filter((u) => u.active).length === 1 && ' Por ahora solo aparecés vos porque el resto del equipo todavía no tiene cuenta creada.'}
              </p>
            </div>
            <div><label className={labelCls}>Asignar a</label>
              <p className="text-[11px] text-ink-700 mb-1.5">Gente que también puede ver y trabajar en este trabajo, además del responsable.</p>
              <div className="flex flex-wrap gap-1.5">
                {users.filter((u) => u.active).map((u) => (
                  <button type="button" key={u.id} onClick={() => toggleAssigned(u.id)} aria-pressed={assignedUserIds.includes(u.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border ${assignedUserIds.includes(u.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-700'}`}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="flex items-center gap-2.5 text-sm text-ink-700 bg-ink-50 rounded-lg px-3 py-2.5">
              <input type="checkbox" checked={requiresInstallation} onChange={(e) => setRequiresInstallation(e.target.checked)} className="rounded" />
              Este trabajo requiere instalación en sitio
            </label>
            {requiresInstallation ? (
              <div className="grid grid-cols-2 gap-4 bg-ink-50 rounded-lg p-3">
                <div className="col-span-2"><label htmlFor="nj-install-address" className={labelCls}>Dirección *</label><input id="nj-install-address" className={inputCls} value={installAddress} onChange={(e) => setInstallAddress(e.target.value)} /></div>
                <div><label htmlFor="nj-install-phone" className={labelCls}>Teléfono de contacto</label><input id="nj-install-phone" className={inputCls} value={installContactPhone} onChange={(e) => setInstallContactPhone(e.target.value)} /></div>
                <div className="col-span-2"><label htmlFor="nj-install-date" className={labelCls}>Fecha</label><input id="nj-install-date" type="date" className={inputCls} value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></div>
              </div>
            ) : (
              <p className="text-sm text-ink-700">Este trabajo se entrega en el estudio — no hace falta cargar ningún dato de instalación.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-ink-700">Los archivos de referencia se pueden adjuntar ahora o después desde la ficha del trabajo.</p>
            <input
              ref={fileInputRef} type="file" multiple className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center gap-1.5 text-center border border-dashed rounded-lg px-4 py-8 w-full cursor-pointer transition-colors ${dragOver ? 'bg-brand-100 border-brand-400' : 'border-brand-300 hover:bg-brand-50'}`}
            >
              <UploadCloud size={22} className="text-brand-500" />
              <span className="text-sm font-medium text-brand-600">Arrastrá archivos acá, o hacé click para elegirlos</span>
            </div>
            {pendingFiles.length > 0 && (
              <ul className="text-sm text-ink-700 space-y-1">
                {pendingFiles.map((f, i) => (
                  <li key={i} className="bg-ink-50 rounded-md px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="truncate">{f.name} <span className="text-xs text-ink-700">({fmtFileSize(f.size)})</span></span>
                    <button type="button" onClick={() => removeFile(i)} className="text-ink-700 hover:text-crit-text shrink-0"><X size={14} /></button>
                  </li>
                ))}
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
            <SummaryRow label="Entrega" value={committedDate ? new Date(`${committedDate}T18:00`).toLocaleDateString('es-AR') : '—'} />
            <SummaryRow label="Prioridad" value={PRIORITY_META[priority].label} />
            <SummaryRow label="Instalación" value={requiresInstallation ? installAddress : 'No'} />
            <SummaryRow label="Archivos" value={pendingFiles.length ? `${pendingFiles.length} adjunto${pendingFiles.length !== 1 ? 's' : ''}` : '—'} />
            <div className="bg-ink-50 text-ink-700 rounded-md px-3 py-2 text-xs">
              Esto es normal, no es un error: el trabajo arranca en estado "Pendiente" (nadie lo procesó todavía). Si en algún momento necesitás cargar medidas, material o técnica, se hace después desde la ficha — no hace falta ahora.
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-5">
        <button onClick={() => step === 0 ? navigate('/trabajos') : setStep((s) => s - 1)} className="inline-flex items-center gap-1 text-sm text-ink-700 px-3 py-2 rounded-lg hover:bg-ink-100">
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
      <span className="text-ink-700">{label}</span>
      <span className="text-ink-800 font-medium text-right max-w-[60%]">{value || '—'}</span>
    </div>
  );
}
