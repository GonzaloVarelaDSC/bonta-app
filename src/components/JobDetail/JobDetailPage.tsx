import { useEffect, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Lock, Unlock, AlertTriangle, UploadCloud, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { JobSpecs } from '../../store/useStore';
import { canViewJob, canChangePriority, canBlock } from '../../lib/permissions';
import { effectivePriority, PRIORITY_META } from '../../lib/priority';
import { calculateRisk } from '../../lib/risk';
import { PriorityBadge, StatusBadge, CountdownBadge, RiskBadge, Avatar } from '../Common/Badges';
import { JOB_TYPES, MATERIALS, STATUS_LABELS, BLOCK_REASON_LABELS } from '../../data/catalog';
import { fmtDateTime, fmtDate } from '../../lib/dates';
import { missingFields } from '../../lib/selectors';
import { CommentsPanel } from './CommentsPanel';
import { BlockModal } from './BlockModal';
import type { BlockReason, JobStatus, MaterialId, Priority } from '../../types';

const TABS = ['General', 'Especificaciones', 'Control de calidad', 'Archivos', 'Instalación', 'Historial', 'Comentarios'] as const;

export function JobDetailPage() {
  const { id } = useParams();
  const user = useStore((s) => s.currentUser)!;
  const job = useStore((s) => s.jobs).find((j) => j.id === id);
  const client = useStore((s) => s.clients).find((c) => c.id === job?.clientId);
  const users = useStore((s) => s.users);
  const activityLog = useStore((s) => s.activityLog).filter((a) => a.jobId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const setStatus = useStore((s) => s.setStatus);
  const setPriority = useStore((s) => s.setPriority);
  const updateJobSpecs = useStore((s) => s.updateJobSpecs);
  const blockJob = useStore((s) => s.blockJob);
  const unblockJob = useStore((s) => s.unblockJob);
  const addFileVersion = useStore((s) => s.addFileVersion);
  const deleteFileVersion = useStore((s) => s.deleteFileVersion);
  const approveFileVersion = useStore((s) => s.approveFileVersion);
  const toggleQualityCheck = useStore((s) => s.toggleQualityCheck);
  const completeInstallation = useStore((s) => s.completeInstallation);
  const loadJobComments = useStore((s) => s.loadJobComments);
  const loadJobActivity = useStore((s) => s.loadJobActivity);

  const [tab, setTab] = useState<(typeof TABS)[number]>('General');
  const [showBlock, setShowBlock] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadJobComments(id);
    loadJobActivity(id);
  }, [id, loadJobComments, loadJobActivity]);

  if (!job) return <Navigate to="/trabajos" replace />;
  if (!canViewJob(user, job)) {
    return <div className="p-10 text-center text-ink-500">No tenés acceso a este trabajo — no está asignado a vos.</div>;
  }

  const activeBlock = job.blockRecords.find((b) => !b.closedAt);
  const missing = missingFields(job);
  const requiredPending = job.qualityChecks.filter((q) => q.required && !q.checked);
  const responsible = users.find((u) => u.id === job.responsibleUserId);
  const creator = users.find((u) => u.id === job.createdByUserId);

  const visibleTabs = TABS.filter((t) => t !== 'Instalación' || job.requiresInstallation);
  const desktopOnlyTab = (t: string) => t !== 'Comentarios';

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Cabecera fija */}
        <div className="sticky top-0 z-10 bg-white border-b border-ink-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-mono text-xs text-ink-400 mb-1">{job.code ?? 'Sin N° de trabajo'}</div>
              <h1 className="text-lg font-display font-bold text-ink-900 leading-snug">{job.name}</h1>
              <div className="text-sm text-ink-500 mt-0.5">{client?.name} {job.clientImportant && <span title="Cliente prioritario">⭐</span>}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={effectivePriority(job)} />
              <StatusBadge status={job.status} />
              <CountdownBadge iso={job.committedDate} />
              <RiskBadge risk={calculateRisk(job)} />
            </div>
          </div>

          {missing.length > 0 && job.status !== 'TERMINADO' && job.status !== 'CANCELADO' && (
            <div className="mt-3 flex items-start gap-2 bg-wait-bg text-wait-text text-xs rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Faltan datos para producción: <strong>{missing.join(', ')}</strong>.</span>
            </div>
          )}

          {activeBlock && (
            <div className="mt-3 flex items-start justify-between gap-3 bg-crit-bg text-crit-text text-sm rounded-lg px-3 py-2.5">
              <div>
                <div className="font-semibold">🔴 BLOQUEADO — {BLOCK_REASON_LABELS[activeBlock.reason as BlockReason]}</div>
                <div className="text-xs mt-0.5">{activeBlock.description}</div>
              </div>
              {(canBlock() || user.role === 'coordinador' || user.role === 'admin') && (
                <button onClick={() => unblockJob(job.id, user.id)} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-white/70 hover:bg-white rounded-md px-2.5 py-1.5">
                  <Unlock size={13} /> Desbloquear
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {canChangePriority(user.role) && (
              <select
                value={effectivePriority(job)}
                onChange={(e) => setPriority(job.id, e.target.value as Priority, user.id)}
                className="text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white"
              >
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            )}
            <select
              value={job.status}
              onChange={(e) => setStatus(job.id, e.target.value as JobStatus, user.id)}
              className="text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {!activeBlock && (
              <button onClick={() => setShowBlock(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-crit-text bg-crit-bg rounded-md px-2.5 py-1.5 hover:brightness-95">
                <Lock size={13} /> Bloquear trabajo
              </button>
            )}
          </div>

          <div className="flex gap-1 mt-4 -mb-4 border-b border-ink-100 overflow-x-auto">
            {visibleTabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${desktopOnlyTab(t) ? '' : 'lg:hidden'} ${tab === t ? 'border-ink-950 text-ink-900' : 'border-transparent text-ink-400 hover:text-ink-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === 'General' && (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm max-w-3xl">
              <Field label="Cliente" value={client?.name} />
              <Field label="Contacto" value={job.contactPhone ? `${job.contactName} · ${job.contactPhone}` : job.contactName} />
              <Field label="Generado por" value={creator?.name ?? '—'} />
              <Field label="Responsable interno" value={responsible?.name} />
              <Field label="Asignados" value={job.assignedUserIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean).join(', ') || '—'} />
              <Field label="Fecha de creación" value={fmtDate(job.createdAt)} />
              <Field label="Fecha solicitada por cliente" value={fmtDate(job.requestedDate)} />
              <Field label="Fecha comprometida" value={fmtDate(job.committedDate)} />
              <Field label="Tipo de trabajo" value={JOB_TYPES.find((t) => t.id === job.jobTypeId)?.label} />
              <div className="sm:col-span-2">
                <Field label="Descripción" value={job.description} block />
              </div>
              {job.observations && <div className="sm:col-span-2"><Field label="Observaciones" value={job.observations} block /></div>}
            </div>
          )}

          {tab === 'Especificaciones' && (
            <SpecsTab job={job} onSave={(specs) => updateJobSpecs(job.id, specs, user.id)} />
          )}

          {tab === 'Control de calidad' && (
            <div className="max-w-2xl space-y-2">
              {requiredPending.length > 0 && (
                <div className="text-xs text-wait-text bg-wait-bg rounded-md px-3 py-2 mb-2">
                  No puede pasar a "Listo para entrega" hasta completar los {requiredPending.length} ítems obligatorios marcados con *.
                </div>
              )}
              <div className="bg-white border border-ink-100 rounded-lg divide-y divide-ink-50">
                {job.qualityChecks.map((q) => (
                  <label key={q.key} className="flex items-center gap-2.5 px-4 py-2.5 text-sm cursor-pointer hover:bg-ink-50/50">
                    <input type="checkbox" checked={q.checked} onChange={() => toggleQualityCheck(job.id, q.key, user.id)} className="rounded" />
                    <span className={q.checked ? 'text-ink-700 line-through decoration-ink-300' : 'text-ink-800'}>{q.label}{q.required && ' *'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === 'Archivos' && (
            <FilesTab
              job={job}
              onUpload={(file, targetFileId) => addFileVersion(job.id, file, user.id, targetFileId)}
              onApprove={(fid, vid) => approveFileVersion(job.id, fid, vid, user.id)}
              onDelete={(fid, vid) => deleteFileVersion(job.id, fid, vid, user.id)}
            />
          )}

          {tab === 'Instalación' && job.installation && (
            <InstallationTab job={job} onComplete={(notes) => completeInstallation(job.id, notes, user.id)} />
          )}

          {tab === 'Comentarios' && (
            <div className="lg:hidden -mx-6 -mb-6 h-[calc(100vh-260px)] border-t border-ink-100">
              <CommentsPanel job={job} />
            </div>
          )}

          {tab === 'Historial' && (
            <div className="max-w-2xl space-y-3">
              {activityLog.length === 0 && <div className="text-sm text-ink-400">Sin actividad registrada.</div>}
              {activityLog.map((a) => {
                const actor = users.find((u) => u.id === a.userId);
                return (
                  <div key={a.id} className="flex gap-3">
                    <Avatar name={actor?.name ?? '?'} color={actor?.avatarColor ?? '#999'} size={26} />
                    <div>
                      <div className="text-sm text-ink-800"><strong>{actor?.name}</strong> — {a.detail}</div>
                      <div className="text-xs text-ink-400">{fmtDateTime(a.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="w-[340px] shrink-0 border-l border-ink-100 bg-white hidden lg:block">
        <CommentsPanel job={job} />
      </div>

      {showBlock && (
        <BlockModal onClose={() => setShowBlock(false)} onConfirm={(reason, desc) => { blockJob(job.id, reason, desc, user.id); setShowBlock(false); }} />
      )}
    </div>
  );
}

function Field({ label, value, block, highlightMissing }: { label: string; value?: string; block?: boolean; highlightMissing?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400 font-medium mb-0.5">{label}</div>
      <div className={`text-ink-800 ${block ? 'leading-relaxed' : ''} ${highlightMissing ? 'text-wait-text italic' : ''}`}>
        {value || (highlightMissing ? 'Falta completar' : '—')}
      </div>
    </div>
  );
}

function fmtFileSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// Cada archivo distinto que se arrastra crea su propio grupo (antes todo se
// amontonaba como "versión" de un único archivo, sin importar si eran
// documentos distintos). "+ nueva versión" por grupo sigue existiendo para
// re-subir la misma pieza corregida, y cada versión se puede borrar.
function FilesTab({ job, onUpload, onApprove, onDelete }: {
  job: import('../../types').Job;
  onUpload: (file: File, targetFileId?: string) => void;
  onApprove: (fileId: string, versionId: string) => void;
  onDelete: (fileId: string, versionId: string) => void;
}) {
  const users = useStore((s) => s.users);
  const nameOf = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId;
  const [dragOver, setDragOver] = useState(false);
  const [versionTarget, setVersionTarget] = useState<string | undefined>(undefined);
  const dropInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null, targetFileId?: string) {
    if (!fileList) return;
    Array.from(fileList).forEach((f) => onUpload(f, targetFileId));
  }

  return (
    <div className="max-w-2xl space-y-4">
      <input ref={dropInputRef} type="file" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      <input ref={versionInputRef} type="file" className="hidden" onChange={(e) => { handleFiles(e.target.files, versionTarget); e.target.value = ''; }} />
      <div
        onClick={() => dropInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-1.5 text-center border border-dashed rounded-lg px-4 py-8 cursor-pointer transition-colors ${dragOver ? 'bg-brand-100 border-brand-400' : 'border-brand-300 hover:bg-brand-50'}`}
      >
        <UploadCloud size={22} className="text-brand-500" />
        <span className="text-sm font-medium text-brand-600">Arrastrá archivos acá, o hacé click para elegirlos</span>
      </div>

      {job.files.length === 0 && <div className="text-sm text-ink-400 text-center">Todavía no se subieron archivos.</div>}
      {job.files.map((f) => (
        <div key={f.id} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-ink-100 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink-800">{f.logicalName} · {f.kind}</span>
            <button
              onClick={() => { setVersionTarget(f.id); versionInputRef.current?.click(); }}
              className="text-xs font-medium text-brand-600 hover:underline shrink-0"
            >
              + Nueva versión
            </button>
          </div>
          <div className="divide-y divide-ink-50">
            {[...f.versions].reverse().map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-ink-800 font-medium truncate">{v.fileName} <span className="text-xs text-ink-400">v{v.version}</span></div>
                  <div className="text-xs text-ink-400">{fmtFileSize(v.sizeKb)} · subido por {nameOf(v.uploadedBy)} · {fmtDate(v.uploadedAt)}</div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {v.approved ? (
                    <span className="text-xs font-semibold text-plan-text bg-plan-bg rounded-md px-2 py-1">✅ Aprobado</span>
                  ) : (
                    <button onClick={() => onApprove(f.id, v.id)} className="text-xs font-medium text-brand-600 hover:underline">Marcar aprobado</button>
                  )}
                  <button
                    onClick={() => { if (confirm(`¿Eliminar "${v.fileName}"?`)) onDelete(f.id, v.id); }}
                    className="text-ink-400 hover:text-crit-text" title="Eliminar archivo" aria-label={`Eliminar ${v.fileName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SpecsTab({ job, onSave }: { job: import('../../types').Job; onSave: (specs: JobSpecs) => Promise<void> }) {
  const [quantity, setQuantity] = useState(job.quantity);
  const [measurements, setMeasurements] = useState(job.measurements);
  const [materialIds, setMaterialIds] = useState<MaterialId[]>(job.materialIds);
  const [technique, setTechnique] = useState(job.technique);
  const [finish, setFinish] = useState(job.finish);
  const [color, setColor] = useState(job.color);
  const [specialRequirements, setSpecialRequirements] = useState(job.specialRequirements);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantity(job.quantity); setMeasurements(job.measurements); setMaterialIds(job.materialIds);
    setTechnique(job.technique); setFinish(job.finish); setColor(job.color); setSpecialRequirements(job.specialRequirements);
  }, [job.id]);

  const dirty = quantity !== job.quantity || measurements !== job.measurements || technique !== job.technique
    || finish !== job.finish || color !== job.color || specialRequirements !== job.specialRequirements
    || materialIds.length !== job.materialIds.length || materialIds.some((m) => !job.materialIds.includes(m));

  async function save() {
    setSaving(true);
    try { await onSave({ quantity, measurements, materialIds, technique, finish, color, specialRequirements }); }
    finally { setSaving(false); }
  }

  const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30';
  const labelCls = 'block text-xs font-medium text-ink-600 mb-1.5';

  return (
    <div className="max-w-3xl space-y-4 text-sm">
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        <div><label htmlFor="specs-quantity" className={labelCls}>Cantidad</label>
          <input id="specs-quantity" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        <div><label htmlFor="specs-measurements" className={labelCls}>Medidas</label>
          <input id="specs-measurements" className={inputCls} value={measurements} onChange={(e) => setMeasurements(e.target.value)} /></div>
        <div><label htmlFor="specs-technique" className={labelCls}>Técnica</label>
          <input id="specs-technique" className={inputCls} value={technique} onChange={(e) => setTechnique(e.target.value)} /></div>
        <div><label htmlFor="specs-finish" className={labelCls}>Terminación</label>
          <input id="specs-finish" className={inputCls} value={finish} onChange={(e) => setFinish(e.target.value)} /></div>
        <div><label htmlFor="specs-color" className={labelCls}>Color</label>
          <input id="specs-color" className={inputCls} value={color} onChange={(e) => setColor(e.target.value)} /></div>
      </div>
      <div>
        <span className={labelCls}>Material</span>
        <div className="flex flex-wrap gap-1.5">
          {MATERIALS.map((m) => (
            <button type="button" key={m.id} onClick={() => setMaterialIds((ids) => ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id])}
              className={`text-xs px-2.5 py-1.5 rounded-full border ${materialIds.includes(m.id) ? 'bg-ink-950 text-white border-ink-950' : 'border-ink-200 text-ink-600'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div><label htmlFor="specs-special" className={labelCls}>Requisitos especiales</label>
        <textarea id="specs-special" className={inputCls} rows={2} value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} /></div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save} disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {!dirty && <span className="text-xs text-ink-400">Sin cambios sin guardar</span>}
      </div>
    </div>
  );
}

function InstallationTab({ job, onComplete }: { job: import('../../types').Job; onComplete: (notes: string) => void }) {
  const inst = job.installation!;
  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm bg-white border border-ink-100 rounded-lg p-4">
        <Field label="Dirección" value={inst.address} highlightMissing={!inst.address} />
        <Field label="Contacto" value={`${inst.contactName} · ${inst.contactPhone}`} />
        <Field label="Fecha" value={inst.date ? fmtDate(inst.date) : '—'} />
      </div>
      {inst.completed ? (
        <div className="bg-plan-bg text-plan-text rounded-lg p-4 text-sm">
          <div className="font-semibold mb-1">✅ Instalación completada</div>
          <div>{inst.completedAt && fmtDateTime(inst.completedAt)}</div>
          {inst.completedNotes && <div className="mt-1">{inst.completedNotes}</div>}
        </div>
      ) : (
        <button
          onClick={() => { const n = prompt('Observaciones de la instalación (opcional):') ?? ''; onComplete(n); }}
          className="bg-ink-950 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-ink-800"
        >
          Marcar instalación completada
        </button>
      )}
    </div>
  );
}
