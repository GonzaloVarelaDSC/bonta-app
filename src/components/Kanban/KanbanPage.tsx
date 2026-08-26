import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { KANBAN_COLUMNS, type ColumnTone } from '../../data/catalog';
import { CountdownBadge } from '../Common/Badges';
import type { Job, JobStatus } from '../../types';
import { tryChangeJobStatus } from '../../lib/statusChange';

// Mismo lenguaje de color que los badges de estado — cada columna se pinta con
// el color de la etapa que representa, para que el estudio se lea de un vistazo.
const COLUMN_TONE_CLASSES: Record<ColumnTone, { header: string; body: string; count: string }> = {
  wait: { header: 'bg-wait-bg text-wait-text', body: 'bg-wait-bg/40', count: 'bg-wait text-white' },
  info: { header: 'bg-info-bg text-info-text', body: 'bg-info-bg/40', count: 'bg-info text-white' },
  plan: { header: 'bg-plan-bg text-plan-text', body: 'bg-plan-bg/40', count: 'bg-plan text-white' },
};

// Ficha compacta: solo lo que hace falta para reconocer un trabajo de un
// vistazo — el estado ya lo dice la columna, no hace falta repetirlo acá.
function KanbanCard({ job }: { job: Job }) {
  const navigate = useNavigate();
  const clients = useStore((s) => s.clients);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const client = clients.find((c) => c.id === job.clientId);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => {
        if (isDragging) return;
        navigate(`/trabajos/${job.id}`);
      }}
      className="bg-white rounded-lg border border-ink-100 shadow-card px-3 py-2.5 cursor-grab active:cursor-grabbing hover:shadow-pop hover:border-ink-200 transition-shadow"
    >
      <div className="text-[13px] font-semibold text-ink-900 leading-snug line-clamp-2">{job.name}</div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-xs text-ink-400 truncate">{client?.name ?? 'Sin cliente'}</span>
        <span className="text-[11px] font-mono text-ink-300 shrink-0">{job.code ?? 'Sin N°'}</span>
      </div>
      <div className="mt-2">
        <CountdownBadge iso={job.committedDate} />
      </div>
    </div>
  );
}

function KanbanColumnView({ colKey, label, tone, jobs }: { colKey: string; label: string; tone: ColumnTone; jobs: Job[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  const toneCls = COLUMN_TONE_CLASSES[tone];
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={clsx('flex items-start justify-between gap-2 rounded-lg px-2.5 py-1.5 mb-2', toneCls.header)}>
        <span className="text-[13px] font-semibold leading-tight">{label}</span>
        <span className={clsx('text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center tabular shrink-0', toneCls.count)}>
          {jobs.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 min-h-0 overflow-y-auto rounded-xl p-2 space-y-2 border-2 transition-colors',
          isOver ? 'bg-brand-100/60 border-brand-300' : `${toneCls.body} border-transparent`
        )}
      >
        {jobs.map((j) => <KanbanCard key={j.id} job={j} />)}
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

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-display font-bold text-ink-900">Kanban</h1>
          <span className="text-xs font-semibold text-ink-500 bg-ink-100 rounded-full px-2 py-0.5 tabular">{jobs.length} trabajos activos</span>
        </div>
        <span className="text-xs text-ink-400">Arrastrá una tarjeta para cambiar el estado</span>
      </div>
      <div className="flex-1 min-h-0 mt-4 overflow-x-auto">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-6 gap-3 h-full min-w-[960px]">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumnView
                key={col.key} colKey={col.key} label={col.label} tone={col.tone}
                jobs={jobs.filter((j) => columnOf(j) === col.key)}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
