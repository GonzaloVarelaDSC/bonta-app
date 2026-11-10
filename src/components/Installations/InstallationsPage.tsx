import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Printer, RotateCcw, CalendarClock } from 'lucide-react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from '../../store/useStore';
import { canScheduleInstallations, visibleJobs } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import {
  addDaysKey, fmtDay, fmtDayLong, fmtPeriod, fmtTime, monthWeeks, overlaps, parseDay, scheduledInstallations,
  todayKey, toDayKey, unscheduledInstallations, durationDays, type ScheduledInstallation, type WeekBar,
} from '../../lib/installations';
import { btn } from '../Common/ui';
import { ConfirmDialog } from '../Common/Modal';
import { InstallationPanel } from './InstallationPanel';
import { ExportDialog, PickJobDialog } from './InstallationDialogs';
import type { Job } from '../../types';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const LANE_H = 26; // alto de cada franja (px)

/**
 * Calendario de instalaciones: reemplaza el pizarrón. Mes en escritorio (con
 * franjas continuas para las que duran varios días y arrastre para mover), lista
 * por día en el celular. Los datos salen de la OT (`job.installation`): no hay
 * otra tabla de instalaciones.
 */
export function InstallationsPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const moveInstallation = useStore((s) => s.moveInstallation);
  const [params, setParams] = useSearchParams();
  const canEdit = canScheduleInstallations(user);

  const month = useMemo(() => {
    const m = params.get('mes');
    return m && /^\d{4}-\d{2}$/.test(m) ? parseDay(`${m}-01`) : startOfMonth(new Date());
  }, [params]);
  const openJobId = params.get('ot');

  const jobs = useMemo(() => visibleJobs(user, allJobs), [user, allJobs]);
  const items = useMemo(() => scheduledInstallations(jobs), [jobs]);
  const unscheduled = useMemo(() => unscheduledInstallations(jobs), [jobs]);
  const weeks = useMemo(() => monthWeeks(month, items), [month, items]);
  const monthFrom = toDayKey(startOfMonth(month));
  const monthTo = toDayKey(addMonths(startOfMonth(month), 1)).slice(0, 10);
  const monthItems = items.filter((it) => overlaps(it, monthFrom, addDaysKey(monthTo, -1)));
  const today = todayKey();
  const upcoming = items.filter((it) => !it.inst.completed && overlaps(it, today, addDaysKey(today, 6)));

  const [newFor, setNewFor] = useState<{ date: string | null } | null>(null);
  const [draft, setDraft] = useState<{ job: Job; date: string | null } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ job: Job; to: string } | null>(null);
  const [dragging, setDragging] = useState<Job | null>(null);
  const [error, setError] = useState('');

  const clientName = (job: Job) => clients.find((c) => c.id === job.clientId)?.name ?? 'Cliente';
  const openJob = allJobs.find((j) => j.id === openJobId);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: key === 'ot' });
  }
  function goMonth(d: Date) { setParam('mes', format(d, 'yyyy-MM')); }
  function openOrders(ids: string[]) {
    if (!ids.length) return;
    window.open(`/instalaciones/orden?ids=${ids.join(',')}`, '_blank', 'noopener');
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  );
  const grabOffset = useRef(0);
  function onDragStart(e: DragStartEvent) {
    const job = allJobs.find((j) => j.id === e.active.id) ?? null;
    setDragging(job);
    grabOffset.current = 0;
    const ev = e.activatorEvent as MouseEvent | TouchEvent;
    const pt = 'touches' in ev ? ev.touches[0] : ev;
    const start = job?.installation?.date;
    if (!pt || !start) return;
    const cell = document.elementsFromPoint(pt.clientX, pt.clientY)
      .find((el) => el instanceof HTMLElement && el.dataset.day) as HTMLElement | undefined;
    if (cell?.dataset.day) grabOffset.current = Math.max(0, durationDays(start, cell.dataset.day) - 1);
  }
  async function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const job = allJobs.find((j) => j.id === e.active.id);
    const over = typeof e.over?.id === 'string' && e.over.id.startsWith('day:') ? e.over.id.slice(4) : null;
    if (!job || !over) return;
    // Si se agarró una franja de varios días por el medio, se corre todo lo que
    // se movió el puntero (no se pone el inicio donde se soltó).
    const to = addDaysKey(over, -grabOffset.current);
    if (job.installation?.date === to) return;
    // Poner la primera fecha no es reprogramar: va directo. Mover una ya puesta pide confirmación.
    if (job.installation?.date) setPendingMove({ job, to });
    else await doMove(job, to);
  }
  async function doMove(job: Job, to: string) {
    setError('');
    try { await moveInstallation(job.id, to); } catch (err) { setError(friendlyError(err)); }
  }

  const monthLabel = format(month, 'MMMM yyyy', { locale: es });

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-ink-900 tracking-tight">Instalaciones</h1>
          <p className="text-sm text-ink-700 mt-0.5">
            {monthItems.length} {monthItems.length === 1 ? 'instalación' : 'instalaciones'} en {format(month, 'MMMM', { locale: es })}
            {unscheduled.length > 0 && <> · {unscheduled.length} sin fecha</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setExporting(true)} className={btn('secondary')}><Printer size={15} aria-hidden /> Exportar</button>
          {canEdit && <button onClick={() => setNewFor({ date: null })} className={btn('primary')}><Plus size={16} aria-hidden /> Nueva instalación</button>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => goMonth(addMonths(month, -1))} aria-label="Mes anterior" className={btn('secondary', 'sm')}><ChevronLeft size={16} aria-hidden /></button>
        <button onClick={() => goMonth(addMonths(month, 1))} aria-label="Mes siguiente" className={btn('secondary', 'sm')}><ChevronRight size={16} aria-hidden /></button>
        <h2 className="text-base font-semibold text-ink-900 capitalize min-w-[9.5rem]" aria-live="polite">{monthLabel}</h2>
        {!isSameMonth(month, new Date()) && (
          <button onClick={() => setParam('mes', null)} className={btn('ghost', 'sm')}>Hoy</button>
        )}
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-crit-text bg-crit-bg border border-crit/30 rounded-ctl px-3 py-2">{error}</p>}

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {unscheduled.length > 0 && (
          <section aria-label="Instalaciones sin fecha" className="mb-3 rounded-card border border-dashed border-ink-300 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock size={15} className="text-urg-text" aria-hidden />
              <h2 className="text-xs font-semibold text-ink-900">Sin fecha ({unscheduled.length})</h2>
              {canEdit && <span className="hidden md:inline text-2xs text-ink-700">Arrastralas a un día para programarlas.</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unscheduled.map((job) => (
                <DraggableChip
                  key={job.id} job={job} label={`${job.code ?? 'Sin N°'} · ${clientName(job)}`} disabled={!canEdit}
                  onOpen={() => (job.installation ? setParam('ot', job.id) : setDraft({ job, date: null }))}
                />
              ))}
            </div>
          </section>
        )}

        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
          <section aria-label={`Calendario de ${monthLabel}`} className="select-none bg-white rounded-card border border-ink-200/80 shadow-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50">
              {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-700">{d}</div>)}
            </div>
            {weeks.map((w) => (
              <div
                key={w.days[0]} className="relative grid grid-cols-7 border-b border-ink-200 last:border-b-0"
                style={{ gridTemplateRows: `28px repeat(${w.lanes}, ${LANE_H}px) minmax(18px, 1fr)`, minHeight: 112 }}
              >
                {w.days.map((d, i) => (
                  <DayCell
                    key={d} day={d} col={i} inMonth={isSameMonth(parseDay(d), month)} isToday={d === today}
                    onEmptyClick={canEdit ? () => setNewFor({ date: d }) : undefined}
                  />
                ))}
                {w.bars.map((b) => (
                  <Bar key={b.item.job.id} bar={b} label={clientName(b.item.job)} canDrag={canEdit} onOpen={() => setParam('ot', b.item.job.id)} />
                ))}
              </div>
            ))}
          </section>

          <aside aria-label="Próximos 7 días" className="bg-white rounded-card border border-ink-200/80 shadow-card">
            <h2 className="px-4 pt-3 pb-2 text-xs font-semibold text-ink-900 border-b border-ink-100">Próximos 7 días</h2>
            {upcoming.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-700">No hay instalaciones esta semana.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {upcoming.map((it) => (
                  <li key={it.job.id}>
                    <button onClick={() => setParam('ot', it.job.id)} className="w-full text-left px-4 py-2.5 hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
                      <div className="text-2xs font-semibold uppercase tracking-wide text-ink-700">{relDay(it.start, it.end, today)} · {fmtTime(it.inst.time)}</div>
                      <div className="text-sm text-ink-900 truncate"><span className="font-semibold tabular-nums">{it.job.code ?? 'Sin N°'}</span> · {clientName(it.job)}</div>
                      {(it.inst.locality || it.inst.installerNames.length > 0) && (
                        <div className="text-xs text-ink-700 truncate">{[it.inst.locality, it.inst.installerNames.join(', ')].filter(Boolean).join(' · ')}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="h-[22px] px-2 rounded-ctl bg-white border border-site shadow-lift text-xs flex items-center gap-1.5 max-w-[220px]">
              <span className="font-semibold tabular-nums">{dragging.code ?? 'Sin N°'}</span>
              <span className="truncate">{clientName(dragging)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <MobileAgenda month={month} items={items} today={today} clientName={clientName} onOpen={(id) => setParam('ot', id)} />

      {openJob && (
        <InstallationPanel
          key={openJob.id} job={openJob} onClose={() => setParam('ot', null)} onExport={(id) => openOrders([id])}
          startEditing={!openJob.installation}
        />
      )}
      {draft && (
        <InstallationPanel
          key={`new-${draft.job.id}`} job={draft.job} startEditing initialDate={draft.date}
          onClose={() => setDraft(null)} onExport={(id) => openOrders([id])}
        />
      )}
      {newFor && (
        <PickJobDialog
          date={newFor.date} onClose={() => setNewFor(null)}
          onPick={(job) => { setNewFor(null); setDraft({ job, date: newFor.date }); }}
        />
      )}
      {exporting && <ExportDialog items={items} onClose={() => setExporting(false)} onExport={(ids) => { setExporting(false); openOrders(ids); }} />}
      {pendingMove && (
        <ConfirmDialog
          title="Reprogramar instalación"
          message={(() => {
            const inst = pendingMove.job.installation!;
            const days = durationDays(inst.date!, inst.endDate ?? inst.date!);
            const newEnd = addDaysKey(pendingMove.to, days - 1);
            return (
              <>
                <strong>{pendingMove.job.code ?? 'Sin N°'} · {clientName(pendingMove.job)}</strong><br />
                De {fmtPeriod(inst.date!, inst.endDate ?? inst.date!)} a <strong>{fmtPeriod(pendingMove.to, newEnd)}</strong>, a las {fmtTime(inst.time)}.
                <br /><span className="text-ink-700">Va a quedar marcada como reprogramada.</span>
              </>
            );
          })()}
          confirmLabel="Reprogramar" cancelLabel="Volver"
          onClose={() => setPendingMove(null)}
          onConfirm={() => { const m = pendingMove; setPendingMove(null); void doMove(m.job, m.to); }}
        />
      )}
    </div>
  );
}

function relDay(start: string, end: string, today: string): string {
  if (start <= today && end >= today) return start === end ? 'Hoy' : `Hoy (hasta ${fmtDay(end)})`;
  if (start === addDaysKey(today, 1)) return 'Mañana';
  return format(parseDay(start), 'EEE d', { locale: es });
}

function DayCell({ day, col, inMonth, isToday, onEmptyClick }: {
  day: string; col: number; inMonth: boolean; isToday: boolean; onEmptyClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  return (
    <div
      ref={setNodeRef} data-day={day}
      style={{ gridColumn: col + 1, gridRow: '1 / -1' }}
      onClick={onEmptyClick}
      className={clsx(
        'border-r border-ink-100 last:border-r-0 transition-colors',
        !inMonth && 'bg-ink-50/70',
        isOver && 'bg-site-bg',
        onEmptyClick && 'cursor-pointer hover:bg-ink-50',
      )}
      aria-label={onEmptyClick ? `Programar instalación el ${fmtDayLong(day)}` : undefined}
    >
      <div className="px-2 pt-1.5 flex justify-end">
        <span className={clsx(
          'text-xs tabular-nums w-6 h-6 inline-flex items-center justify-center rounded-full',
          isToday ? 'bg-ink-900 text-white font-semibold' : inMonth ? 'text-ink-800' : 'text-ink-500',
        )}>
          {parseDay(day).getDate()}
        </span>
      </div>
    </div>
  );
}

function Bar({ bar, label, canDrag, onOpen }: { bar: WeekBar; label: string; canDrag: boolean; onOpen: () => void }) {
  const { job, inst, start, end } = bar.item;
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: job.id, disabled: !canDrag || inst.completed });
  const title = `${job.code ?? 'Sin N°'} · ${label} — ${fmtPeriod(start, end)} · ${fmtTime(inst.time)}${inst.rescheduled ? ' · reprogramada' : ''}${inst.completed ? ' · completada' : ''}`;
  return (
    <button
      ref={setNodeRef} {...attributes} {...listeners}
      type="button" onClick={onOpen} title={title} aria-label={title}
      style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }}
      className={clsx(
        'relative z-10 my-[2px] h-[22px] flex items-center gap-1.5 px-2 text-xs text-left min-w-0 overflow-hidden',
        'border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        bar.startsHere ? 'ml-1 rounded-l-ctl border-l-[3px]' : 'rounded-l-none border-l-0',
        bar.endsHere ? 'mr-1 rounded-r-ctl' : 'rounded-r-none border-r-0',
        inst.completed
          ? 'bg-ink-50 border-ink-200 text-ink-700 line-through decoration-ink-500'
          : 'bg-site-bg border-site/40 border-l-site text-ink-900 hover:brightness-95',
        isDragging && 'opacity-40',
        canDrag && !inst.completed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
    >
      {!bar.startsHere && <span aria-hidden className="text-ink-700">‹</span>}
      <span className="font-semibold tabular-nums shrink-0">{job.code ?? 'Sin N°'}</span>
      <span className="truncate min-w-0">{label}</span>
      {inst.rescheduled && !inst.completed && <RotateCcw size={11} className="shrink-0 ml-auto text-urg-text" aria-hidden />}
      {!bar.endsHere && <span aria-hidden className={clsx('text-ink-700', !inst.rescheduled && 'ml-auto')}>›</span>}
    </button>
  );
}

function DraggableChip({ job, label, disabled, onOpen }: { job: Job; label: string; disabled: boolean; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: job.id, disabled });
  return (
    <button
      ref={setNodeRef} {...attributes} {...listeners} type="button" onClick={onOpen}
      className={clsx(
        'h-7 max-md:min-h-touch px-2.5 rounded-ctl border border-ink-300 bg-white text-xs text-ink-900 max-w-[260px] truncate',
        'hover:border-ink-450 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        !disabled && 'md:cursor-grab', isDragging && 'opacity-40',
      )}
    >
      {label}
    </button>
  );
}

/** Celular: lista por día del mes elegido. Una instalación de varios días aparece en cada uno. */
function MobileAgenda({ month, items, today, clientName, onOpen }: {
  month: Date; items: ScheduledInstallation[]; today: string; clientName: (j: Job) => string; onOpen: (id: string) => void;
}) {
  const first = startOfMonth(month);
  const days: string[] = [];
  for (let d = first; isSameMonth(d, month); d = parseDay(addDaysKey(toDayKey(d), 1))) days.push(toDayKey(d));
  const isCurrent = isSameMonth(month, new Date());
  const [showPast, setShowPast] = useState(false);
  const visibleDays = days.filter((d) => !isCurrent || showPast || d >= today);
  const groups = visibleDays
    .map((d) => ({ day: d, list: items.filter((it) => overlaps(it, d, d)) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="md:hidden">
      {isCurrent && days[0] < today && (
        <button onClick={() => setShowPast((v) => !v)} className={clsx(btn('ghost', 'sm'), 'mb-2')}>
          {showPast ? 'Ocultar días pasados' : 'Ver días pasados del mes'}
        </button>
      )}
      {groups.length === 0 ? (
        <p className="text-sm text-ink-700 bg-white border border-ink-200 rounded-card px-4 py-6 text-center">No hay instalaciones {isCurrent && !showPast ? 'de acá a fin de mes' : 'este mes'}.</p>
      ) : (
        <ol className="space-y-3">
          {groups.map((g) => (
            <li key={g.day}>
              <h3 className={clsx('text-xs font-semibold uppercase tracking-wide mb-1.5 first-letter:uppercase', g.day === today ? 'text-ink-900' : 'text-ink-700')}>
                {g.day === today ? 'Hoy · ' : ''}{fmtDayLong(g.day)}
              </h3>
              <ul className="bg-white rounded-card border border-ink-200/80 shadow-card divide-y divide-ink-100">
                {g.list.map((it) => {
                  const multi = it.start !== it.end;
                  return (
                    <li key={it.job.id}>
                      <button onClick={() => onOpen(it.job.id)} className="w-full text-left px-4 py-3 min-h-touch focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
                        <div className={clsx('flex items-baseline gap-2', it.inst.completed && 'line-through text-ink-700')}>
                          <span className="text-sm font-semibold tabular-nums">{fmtTime(it.inst.time)}</span>
                          <span className="text-sm min-w-0 truncate"><span className="font-semibold tabular-nums">{it.job.code ?? 'Sin N°'}</span> · {clientName(it.job)}</span>
                        </div>
                        <div className="text-xs text-ink-700 mt-0.5 truncate">
                          {[
                            multi ? `Día ${durationDays(it.start, g.day)} de ${durationDays(it.start, it.end)}` : '',
                            it.inst.address, it.inst.locality, it.inst.installerNames.join(', '),
                            it.inst.rescheduled ? 'reprogramada' : '',
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
