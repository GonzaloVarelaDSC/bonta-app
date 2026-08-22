import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { KANBAN_COLUMNS, STATUS_LABELS } from '../../data/catalog';
import { effectivePriority } from '../../lib/priority';
import { PriorityBadge, Avatar, CountdownBadge, StatusSelect } from '../Common/Badges';
import type { Job, JobStatus } from '../../types';
import { isSilent } from '../../lib/risk';

// Estados que se pueden elegir a mano desde la tarjeta — bloqueado y cancelado quedan
// afuera porque tienen su propio flujo (motivo de bloqueo, etc.) y no son un simple cambio de estado.
const SELECTABLE_STATUSES: JobStatus[] = [
  'NUEVO', 'FALTA_INFORMACION', 'APROBADO', 'EN_DISENO', 'DISENO_LISTO',
  'EN_PRODUCCION', 'EN_CONTROL_CALIDAD', 'LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION',
  'EN_INSTALACION', 'TERMINADO',
];

function KanbanCard({ job, onStatusChange }: { job: Job; onStatusChange: (job: Job, status: JobStatus) => void }) {
  const navigate = useNavigate();
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const client = clients.find((c) => c.id === job.clientId);
  const resp = users.find((u) => u.id === job.responsibleUserId);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => !isDragging && navigate(`/trabajos/${job.id}`)}
      className={`bg-white rounded-lg border border-ink-100 shadow-card p-3 cursor-grab active:cursor-grabbing hover:shadow-pop transition-shadow ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <PriorityBadge priority={effectivePriority(job)} manual={!!job.priorityManual} size="sm" />
        {isSilent(job) && <span title="Sin movimiento hace más de 48h">💤</span>}
      </div>
      <div className="text-xs text-ink-400 font-mono">{job.code}</div>
      <div className="text-sm font-medium text-ink-900 leading-snug mt-0.5 mb-2">{job.name}</div>
      <div className="text-xs text-ink-500 mb-2">{client?.name}</div>
      <div className="mb-2">
        <StatusSelect status={job.status} options={SELECTABLE_STATUSES} onChange={(s) => onStatusChange(job, s)} />
      </div>
      <div className="flex items-center justify-between">
        <CountdownBadge iso={job.committedDate} />
        {resp && <Avatar name={resp.name} color={resp.avatarColor} size={22} />}
      </div>
    </div>
  );
}

function KanbanColumnView({ colKey, label, jobs, onStatusChange }: { colKey: string; label: string; jobs: Job[]; onStatusChange: (job: Job, status: JobStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-sm font-semibold text-ink-700">{label}</span>
        <span className="text-xs text-ink-400 bg-ink-100 rounded-full px-1.5 py-0.5 tabular">{jobs.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors ${isOver ? 'bg-brand-100/60' : 'bg-ink-100/50'}`}>
        {jobs.map((j) => <KanbanCard key={j.id} job={j} onStatusChange={onStatusChange} />)}
        {jobs.length === 0 && <div className="text-xs text-ink-300 text-center py-6">Sin trabajos</div>}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const setStatus = useStore((s) => s.setStatus);
  const jobs = useMemo(() => visibleJobs(user, allJobs).filter((j) => j.status !== 'CANCELADO'), [user, allJobs]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function columnOf(job: Job) {
    return KANBAN_COLUMNS.find((c) => c.statuses.includes(job.status))?.key ?? 'nuevo';
  }

  /** Bloquea el pase a "listo" si faltan ítems obligatorios del control de calidad — vale tanto para drag&drop como para el selector de la tarjeta. */
  function tryChangeStatus(job: Job, targetStatus: JobStatus, targetLabel: string) {
    if (targetStatus === 'LISTO_PARA_ENTREGA' || targetStatus === 'LISTO_PARA_INSTALACION') {
      const requiredPending = job.qualityChecks.filter((q) => q.required && !q.checked);
      if (requiredPending.length > 0) {
        alert(`No se puede pasar a "${targetLabel}": faltan ${requiredPending.length} ítems obligatorios del control de calidad. Completalos desde la ficha del trabajo.`);
        return;
      }
    }
    setStatus(job.id, targetStatus, user.id);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job) return;
    const targetCol = KANBAN_COLUMNS.find((c) => c.key === over.id);
    if (!targetCol || targetCol.key === columnOf(job)) return;
    const targetStatus: JobStatus = targetCol.statuses[0];
    const finalStatus = job.requiresInstallation && targetCol.key === 'listo' ? 'LISTO_PARA_INSTALACION' : targetStatus;
    tryChangeStatus(job, finalStatus, targetCol.label);
  }

  function handleCardStatusChange(job: Job, status: JobStatus) {
    tryChangeStatus(job, status, STATUS_LABELS[status]);
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-display font-bold text-ink-900">Kanban</h1>
        <span className="text-xs text-ink-400">Arrastrá una tarjeta para cambiar el estado</span>
      </div>
      <div className="flex-1 overflow-x-auto mt-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full pb-4" style={{ minWidth: KANBAN_COLUMNS.length * 300 }}>
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumnView key={col.key} colKey={col.key} label={col.label} jobs={jobs.filter((j) => columnOf(j) === col.key)} onStatusChange={handleCardStatusChange} />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
