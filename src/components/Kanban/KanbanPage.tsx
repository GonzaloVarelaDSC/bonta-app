import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { KANBAN_COLUMNS, type ColumnTone } from '../../data/catalog';
import { CountdownBadge } from '../Common/Badges';
import type { Client, Job, JobStatus } from '../../types';
import { tryChangeJobStatus } from '../../lib/statusChange';
import { fmtDate } from '../../lib/dates';

// Mismo lenguaje de color que los badges de estado, más dos tonos nuevos
// (review, site) para que cada columna tenga su propia identidad — ver
// comentario en data/catalog.ts sobre el mapeo completo.
const COLUMN_TONE_CLASSES: Record<ColumnTone, { header: string; body: string; count: string }> = {
  wait: { header: 'bg-wait-bg text-wait-text', body: 'bg-wait-bg/40', count: 'bg-wait text-white' },
  info: { header: 'bg-info-bg text-info-text', body: 'bg-info-bg/40', count: 'bg-info text-white' },
  norm: { header: 'bg-norm-bg text-norm-text', body: 'bg-norm-bg/40', count: 'bg-norm text-white' },
  review: { header: 'bg-review-bg text-review-text', body: 'bg-review-bg/40', count: 'bg-review text-white' },
  plan: { header: 'bg-plan-bg text-plan-text', body: 'bg-plan-bg/40', count: 'bg-plan text-white' },
  site: { header: 'bg-site-bg text-site-text', body: 'bg-site-bg/40', count: 'bg-site text-white' },
  done: { header: 'bg-ink-100 text-ink-700', body: 'bg-ink-100/50', count: 'bg-ink-600 text-white' },
};

const READY_STATUSES: JobStatus[] = ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION', 'EN_INSTALACION'];

// En Listo/Instalación importa más "hace cuánto está terminado" que "hace cuánto
// se asignó" — en el resto de las columnas es al revés (Gonzalo, 25/08).
function dateLabel(job: Job): string {
  if (READY_STATUSES.includes(job.status) && job.readyAt) return `Listo ${fmtDate(job.readyAt)}`;
  return `Asignado ${fmtDate(job.createdAt)}`;
}

// Fila 1: código + countdown (dos "chips" en los extremos). Fila 2: cliente y
// nombre del trabajo en una sola línea horizontal (el cliente pesa más:
// negrita y oscuro; el nombre es de apoyo, gris). Fila 3: fecha, sola y
// contenida en su propia línea para que nunca empuje el ancho de la ficha.
function CardBody({ job, client }: { job: Job; client?: Client }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className={clsx(
          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight shrink-0',
          job.code ? 'bg-brand-100 text-brand-600 border border-brand-300/60' : 'bg-ink-100 text-ink-400 border border-ink-200'
        )}>
          {job.code ?? 'Sin N°'}
        </span>
        <CountdownBadge iso={job.committedDate} />
      </div>
      <div className="mt-2 text-sm leading-snug truncate">
        <span className="font-bold text-ink-900">{client?.name ?? 'Sin cliente'}</span>
        <span className="text-ink-300 mx-1">·</span>
        <span className="text-ink-500 font-normal">{job.name}</span>
      </div>
      <div className="mt-1 text-[10px] text-ink-300 text-right truncate">{dateLabel(job)}</div>
    </>
  );
}

// Ficha compacta: código, cliente y nombre son lo que hace falta para reconocer
// un trabajo de un vistazo — el estado ya lo dice la columna, no hace falta
// repetirlo acá. Cliente y N° de Copernico llevan más peso visual que el
// nombre del trabajo, a pedido de Gonzalo (25/08).
function KanbanCard({ job }: { job: Job }) {
  const navigate = useNavigate();
  const clients = useStore((s) => s.clients);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const client = clients.find((c) => c.id === job.clientId);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => {
        if (isDragging) return;
        navigate(`/trabajos/${job.id}`);
      }}
      className={clsx(
        'bg-white rounded-lg border border-ink-100 shadow-card px-3 py-2 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-pop hover:border-ink-200 transition-shadow',
        isDragging && 'opacity-30'
      )}
    >
      <CardBody job={job} client={client} />
    </div>
  );
}

// Copia visual que se muestra en un portal fuera del árbol de las columnas
// mientras se arrastra — así pasa por ENCIMA del resto del board en vez de
// quedar recortada por el overflow-y-auto de su columna de origen.
function KanbanCardOverlay({ job, client }: { job: Job; client?: Client }) {
  return (
    <div className="bg-white rounded-lg border border-ink-200 shadow-pop px-3 py-2 w-60 overflow-hidden scale-105 cursor-grabbing">
      <CardBody job={job} client={client} />
    </div>
  );
}

function KanbanColumnView({ colKey, label, tone, jobs }: { colKey: string; label: string; tone: ColumnTone; jobs: Job[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  const toneCls = COLUMN_TONE_CLASSES[tone];
  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
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
  const clients = useStore((s) => s.clients);
  const setStatus = useStore((s) => s.setStatus);
  const jobs = useMemo(() => visibleJobs(user, allJobs).filter((j) => j.status !== 'CANCELADO'), [user, allJobs]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  function columnOf(job: Job) {
    return KANBAN_COLUMNS.find((c) => c.statuses.includes(job.status))?.key ?? 'pendiente';
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveJob(jobs.find((j) => j.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveJob(null);
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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveJob(null)}>
          <div className="grid grid-cols-7 gap-3 h-full min-w-[1120px]">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumnView
                key={col.key} colKey={col.key} label={col.label} tone={col.tone}
                jobs={jobs.filter((j) => columnOf(j) === col.key)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeJob && <KanbanCardOverlay job={activeJob} client={clients.find((c) => c.id === activeJob.clientId)} />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
