import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canViewJob, canChangePriority, canBlock } from '../../lib/permissions';
import { effectivePriority, PRIORITY_META } from '../../lib/priority';
import { calculateRisk } from '../../lib/risk';
import { PriorityBadge, StatusBadge, CountdownBadge, RiskBadge, Avatar } from '../Common/Badges';
import { JOB_TYPES, MATERIALS, STATUS_LABELS, BLOCK_REASON_LABELS, STAGE_LABELS } from '../../data/catalog';
import { fmtDateTime, fmtDate } from '../../lib/dates';
import { missingFields } from '../../lib/selectors';
import { CommentsPanel } from './CommentsPanel';
import { BlockModal } from './BlockModal';
import type { BlockReason, JobStatus, StageStatus } from '../../types';

const TABS = ['General', 'Especificaciones', 'Producción', 'Archivos', 'Instalación', 'Historial', 'Comentarios'] as const;

export function JobDetailPage() {
  const { id } = useParams();
  const user = useStore((s) => s.currentUser)!;
  const job = useStore((s) => s.jobs).find((j) => j.id === id);
  const client = useStore((s) => s.clients).find((c) => c.id === job?.clientId);
  const users = useStore((s) => s.users);
  const activityLog = useStore((s) => s.activityLog).filter((a) => a.jobId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const setStatus = useStore((s) => s.setStatus);
  const setPriority = useStore((s) => s.setPriority);
  const blockJob = useStore((s) => s.blockJob);
  const unblockJob = useStore((s) => s.unblockJob);
  const setStageStatus = useStore((s) => s.setStageStatus);
  const addFileVersion = useStore((s) => s.addFileVersion);
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
              <PriorityBadge priority={effectivePriority(job)} manual={!!job.priorityManual} />
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
                value={job.priorityManual ?? ''}
                onChange={(e) => setPriority(job.id, e.target.value ? (e.target.value as any) : null, user.id)}
                className="text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Prioridad automática ({PRIORITY_META[job.priorityAuto].label})</option>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>Forzar: {v.label}</option>)}
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
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm max-w-3xl">
              <Field label="Cantidad" value={job.quantity || '—'} />
              <Field label="Medidas" value={job.measurements || '—'} highlightMissing={!job.measurements} />
              <Field label="Material" value={job.materialIds.map((m) => MATERIALS.find((mm) => mm.id === m)?.label).join(', ') || '—'} highlightMissing={job.materialIds.length === 0} />
              <Field label="Técnica" value={job.technique || '—'} highlightMissing={!job.technique} />
              <Field label="Terminación" value={job.finish || '—'} />
              <Field label="Color" value={job.color || '—'} />
              {job.specialRequirements && <div className="sm:col-span-2"><Field label="Requisitos especiales" value={job.specialRequirements} block /></div>}
            </div>
          )}

          {tab === 'Producción' && (
            <div className="max-w-2xl space-y-2">
              {job.stages.map((st) => (
                <div key={st.key} className="flex items-center justify-between bg-white border border-ink-100 rounded-lg px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink-800">{STAGE_LABELS[st.key]}</div>
                    <div className="text-xs text-ink-400">{st.status.replace('_', ' ')}</div>
                  </div>
                  <select
                    value={st.status}
                    onChange={(e) => setStageStatus(job.id, st.key, e.target.value as StageStatus, user.id)}
                    className="text-xs border border-ink-200 rounded-md px-2 py-1.5"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="terminado">Terminado</option>
                  </select>
                </div>
              ))}

              <div className="pt-4">
                <div className="text-sm font-semibold text-ink-800 mb-2">Control de calidad</div>
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
            </div>
          )}

          {tab === 'Archivos' && (
            <FilesTab job={job} onUpload={(name) => addFileVersion(job.id, name, user.id)} onApprove={(fid, vid) => approveFileVersion(job.id, fid, vid, user.id)} />
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

function FilesTab({ job, onUpload, onApprove }: { job: import('../../types').Job; onUpload: (name: string) => void; onApprove: (fileId: string, versionId: string) => void }) {
  const users = useStore((s) => s.users);
  const nameOf = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId;
  return (
    <div className="max-w-2xl space-y-4">
      {job.files.length === 0 && <div className="text-sm text-ink-400">Todavía no se subieron archivos.</div>}
      {job.files.map((f) => (
        <div key={f.id} className="bg-white border border-ink-100 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-ink-100 text-sm font-semibold text-ink-800">{f.logicalName} · {f.kind}</div>
          <div className="divide-y divide-ink-50">
            {[...f.versions].reverse().map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-sm text-ink-800 font-medium">{v.fileName} <span className="text-xs text-ink-400">v{v.version}</span></div>
                  <div className="text-xs text-ink-400">{(v.sizeKb / 1024).toFixed(1)} MB · subido por {nameOf(v.uploadedBy)} · {fmtDate(v.uploadedAt)}</div>
                </div>
                {v.approved ? (
                  <span className="text-xs font-semibold text-plan-text bg-plan-bg rounded-md px-2 py-1">✅ Aprobado para producción</span>
                ) : (
                  <button onClick={() => onApprove(f.id, v.id)} className="text-xs font-medium text-brand-600 hover:underline">Marcar aprobado</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => { const n = prompt('Nombre del archivo (ej: archivo_final_v3.pdf)'); if (n) onUpload(n); }}
        className="text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-4 py-3 w-full hover:bg-brand-50"
      >
        + Subir nueva versión
      </button>
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
        <Field label="Hora" value={inst.time || '—'} />
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
