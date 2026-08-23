import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { KANBAN_COLUMNS, type ColumnTone } from '../../data/catalog';
import { effectivePriority } from '../../lib/priority';
import { PriorityBadge, Avatar, CountdownBadge, StatusSelect } from '../Common/Badges';
import type { Job, JobStatus } from '../../types';
import { isSilent } from '../../lib/risk';
import { SELECTABLE_STATUSES, tryChangeJobStatus } from '../../lib/statusChange';

// Mismo lenguaje de color que los badges de estado — cada columna se pinta con
// el color de la etapa que representa, para que el estudio se lea de un vistazo.
const COLUMN_TONE_CLASSES: Record<ColumnTone, { header: string; body: string; count: string }> = {
  wait: { header: 'bg-wait-bg text-wait-text', body: 'bg-wait-bg/50', count: 'bg-wait text-white' },
  info: { header: 'bg-info-bg text-info-text', body: 'bg-info-bg/50', count: 'bg-info text-white' },
  plan: { header: 'bg-plan-bg text-plan-text', body: 'bg-plan-bg/50', count: 'bg-plan text-white' },
};

function KanbanCard({ job, onStatusChange }: { job: Job; onStatusChange: (job: Job, status: JobStatus) => void }) {
  const navigate = useNavigate();
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const client = clients.find((c) => c.id === job.clientId);
  const resp = users.find((u) => u.id === job.responsibleUserId);
  const creator = users.find((u) => u.id === job.createdByUserId);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={(e) => {
        if (isDragging) return;
        // No navegar si el click fue sobre el select de estado.
        if ((e.target as HTMLElement).closest('select')) return;
        navigate(`/trabajos/${job.id}`);
      }}
      className={`bg-white rounded-lg border border-ink-100 shadow-card p-3 cursor-grab active:cursor-grabbing hover:shadow-pop transition-shadow ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <PriorityBadge priority={effectivePriority(job)} manual={!!job.priorityManual} size="sm" />
        {isSilent(job) && <span title="Sin movimiento hace más de 48h">💤</span>}
      </div>
      <div className="text-xs text-ink-500 font-mono font-medium">{job.code ?? 'Sin N°'}</div>
      <div className="text-sm font-medium text-ink-900 leading-snug mt-0.5 mb-2">{job.name}</div>
      <div className="text-xs text-ink-500 mb-2">{client?.name}</div>
      <div className="mb-2">
        <StatusSelect status={job.status} options={SELECTABLE_STATUSES} onChange={(s) => onStatusChange(job, s)} />
      </div>
      {creator && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-400 mb-2">
          <Avatar name={creator.name} color={creator.avatarColor} size={16} />
          <span>Generado por {creator.name.split(' ')[0]}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <CountdownBadge iso={job.committedDate} />
        {resp && <Avatar name={resp.name} color={resp.avatarColor} size={22} />}
      </div>
    </div>
  );
}

function KanbanColumnView({ colKey, label, tone, jobs, onStatusChange }: { colKey: string; label: string; tone: ColumnTone; jobs: Job[]; onStatusChange: (job: Job, status: JobStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  const toneCls = COLUMN_TONE_CLASSES[tone];
  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className={clsx('flex items-center justify-between rounded-lg px-3 py-2 mb-2', toneCls.header)}>
        <span className="text-sm font-semibold">{label}</span>
        <span className={clsx('text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center tabular', toneCls.count)}>
          {jobs.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors border-2',
          isOver ? 'bg-brand-100/60 border-brand-300' : `${toneCls.body} border-transparent`
        )}
      >
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
    return KANBAN_COLUMNS.find((c) => c.statuses.includes(job.status))?.key ?? 'pendiente';
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
    tryChangeJobStatus(job, finalStatus, setStatus, user.id);
  }

  function handleCardStatusChange(job: Job, status: JobStatus) {
    tryChangeJobStatus(job, status, setStatus, user.id);
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-display font-bold text-ink-900">Kanban</h1>
          <span className="text-xs font-semibold text-ink-500 bg-ink-100 rounded-full px-2 py-0.5 tabular">{jobs.length} trabajos activos</span>
        </div>
        <span className="text-xs text-ink-400">Arrastrá una tarjeta para cambiar el estado</span>
      </div>
      <div className="flex-1 overflow-x-auto mt-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full pb-4" style={{ minWidth: KANBAN_COLUMNS.length * 336 }}>
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumnView
                key={col.key} colKey={col.key} label={col.label} tone={col.tone}
                jobs={jobs.filter((j) => columnOf(j) === col.key)} onStatusChange={handleCardStatusChange}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
