import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { KANBAN_COLUMNS, type ColumnTone } from '../../data/catalog';
import { CountdownBadge } from '../Common/Badges';
import type { Client, Job, JobStatus, Priority } from '../../types';
import { tryChangeJobStatus } from '../../lib/statusChange';
import { effectivePriority, PRIORITY_META } from '../../lib/priority';
import { fmtDate } from '../../lib/dates';

// Mismo lenguaje de color que los badges de estado, más dos tonos nuevos
// (review, site) para que cada columna tenga su propia identidad — ver
// comentario en data/catalog.ts sobre el mapeo completo.
// El contador usa el mismo par fondo-pastel/texto-oscuro que ya prueba tener
// contraste de sobra en los badges de estado (5.6-7.8:1) — antes era texto
// blanco sobre el tono sólido, que en 4 de los 6 tonos no llegaba a 4.5:1.
const COLUMN_TONE_CLASSES: Record<ColumnTone, { header: string; body: string; count: string }> = {
  wait: { header: 'bg-wait-bg text-wait-text', body: 'bg-wait-bg/40', count: 'bg-wait-bg text-wait-text border border-wait/30' },
  info: { header: 'bg-info-bg text-info-text', body: 'bg-info-bg/40', count: 'bg-info-bg text-info-text border border-info/30' },
  norm: { header: 'bg-norm-bg text-norm-text', body: 'bg-norm-bg/40', count: 'bg-norm-bg text-norm-text border border-norm/30' },
  review: { header: 'bg-review-bg text-review-text', body: 'bg-review-bg/40', count: 'bg-review-bg text-review-text border border-review/30' },
  plan: { header: 'bg-plan-bg text-plan-text', body: 'bg-plan-bg/40', count: 'bg-plan-bg text-plan-text border border-plan/30' },
  site: { header: 'bg-site-bg text-site-text', body: 'bg-site-bg/40', count: 'bg-site-bg text-site-text border border-site/30' },
  done: { header: 'bg-ink-100 text-ink-700', body: 'bg-ink-100/50', count: 'bg-ink-200 text-ink-700 border border-ink-300' },
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
          job.code ? 'bg-brand-100 text-brand-600 border border-brand-300/60' : 'bg-ink-100 text-ink-700 border border-ink-200'
        )}>
          {job.code ?? 'Sin N°'}
        </span>
        <CountdownBadge iso={job.committedDate} />
      </div>
      <div className="mt-2 text-sm leading-snug truncate">
        <span className="font-bold text-ink-900">{client?.name ?? 'Sin cliente'}</span>
        <span className="text-ink-700 mx-1">·</span>
        <span className="text-ink-700 font-normal">{job.name}</span>
      </div>
      <div className="mt-1 text-[10px] text-ink-700 text-right truncate">{dateLabel(job)}</div>
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
      // dnd-kit ya deja el div focuseable (tabIndex vía `attributes`), pero sin esto
      // Enter/Espacio no hacían nada — solo el mouse podía abrir una ficha o
      // arrastrarla. El cambio de columna sigue siendo por mouse (no hay
      // KeyboardSensor configurado), pero desde teclado ahora se puede al menos
      // abrir la ficha y cambiar el estado desde ahí.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/trabajos/${job.id}`);
        }
      }}
      aria-label={`Abrir ficha — ${client?.name ?? 'Sin cliente'}, ${job.name}`}
      className={clsx(
        'bg-white rounded-lg border border-ink-100 shadow-card px-3 py-2 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-pop hover:border-ink-200 transition-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
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
        {jobs.length === 0 && <div className="text-xs text-ink-700 text-center py-6">Sin trabajos</div>}
      </div>
    </div>
  );
}

// Botón "Filtros" con un desplegable de prioridad + responsable — antes el
// Kanban no tenía forma de acotar la vista más que mirando columna por columna.
function FiltersButton({
  priorityFilter, setPriorityFilter, respFilter, setRespFilter, users,
}: {
  priorityFilter: Priority | 'all'; setPriorityFilter: (p: Priority | 'all') => void;
  respFilter: string | 'all'; setRespFilter: (r: string) => void;
  users: { id: string; name: string; active: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = (priorityFilter !== 'all' ? 1 : 0) + (respFilter !== 'all' ? 1 : 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors',
          activeCount > 0 ? 'bg-brand-100 text-brand-600 border-brand-300' : 'bg-white text-ink-700 border-ink-200 hover:border-ink-300'
        )}
      >
        <SlidersHorizontal size={13} /> Filtros
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold tabular">{activeCount}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-pop border border-ink-100 z-30 p-3 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-ink-700 mb-1">Prioridad</label>
            <select
              value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
              className="w-full text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Toda prioridad</option>
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-ink-700 mb-1">Responsable</label>
            <select
              value={respFilter} onChange={(e) => setRespFilter(e.target.value)}
              className="w-full text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Todo responsable</option>
              {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {activeCount > 0 && (
            <button
              type="button" onClick={() => { setPriorityFilter('all'); setRespFilter('all'); }}
              className="w-full inline-flex items-center justify-center gap-1 text-xs font-medium text-ink-700 hover:text-crit-text py-1"
            >
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function KanbanPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const setStatus = useStore((s) => s.setStatus);
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [respFilter, setRespFilter] = useState<string>('all');
  const jobs = useMemo(() => {
    return visibleJobs(user, allJobs)
      .filter((j) => j.status !== 'CANCELADO')
      .filter((j) => priorityFilter === 'all' || effectivePriority(j) === priorityFilter)
      .filter((j) => respFilter === 'all' || j.responsibleUserId === respFilter);
  }, [user, allJobs, priorityFilter, respFilter]);
  // "Trabajos activos" no cuenta los Terminados — quedan en el board (columna
  // Terminado) pero no son trabajo pendiente, así que no tienen que sumar acá.
  const activeCount = useMemo(() => jobs.filter((j) => j.status !== 'TERMINADO').length, [jobs]);
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
          <span className="text-xs font-semibold text-ink-700 bg-ink-100 rounded-full px-2 py-0.5 tabular">{activeCount} trabajos activos</span>
          <FiltersButton
            priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            respFilter={respFilter} setRespFilter={setRespFilter} users={users}
          />
        </div>
        <span className="text-xs text-ink-700 hidden lg:inline">Arrastrá una tarjeta para cambiar el estado</span>
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
