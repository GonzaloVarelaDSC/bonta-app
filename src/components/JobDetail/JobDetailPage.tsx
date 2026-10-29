import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { Lock, Unlock, AlertTriangle, Pencil, FileOutput, ArrowLeft, MessageCircle, XCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { JobSpecs } from '../../store/useStore';
import { canViewJob, canChangePriority, canBlock, canDeleteJob, canEditAnyJob, canAssign, canSetQuoteValue } from '../../lib/permissions';
import { statusOptionsFor, tryChangeJobStatus } from '../../lib/statusChange';
import { effectivePriority, PRIORITY_META } from '../../lib/priority';
import { calculateRisk } from '../../lib/risk';
import { friendlyError } from '../../lib/errors';
import { PriorityBadge, StatusBadge, CountdownBadge, RiskBadge, Avatar, SampleReviewBadge, BlockedBadge } from '../Common/Badges';
import { ProductsEditor, ProductsView } from '../Common/ProductsEditor';
import { STATUS_LABELS, BLOCK_REASON_LABELS, SAMPLE_REVIEW_META } from '../../data/catalog';
import { fmtDateTime, fmtDate } from '../../lib/dates';
import { missingFields } from '../../lib/selectors';
import { CommentsPanel } from './CommentsPanel';
import { BlockModal } from './BlockModal';
import { ClientMessageModal } from './ClientMessageModal';
import { PromptDialog, ConfirmDialog } from '../Common/Modal';
import { ProductionTab } from './ProductionTab';
import { EditJobHeaderModal } from './EditJobHeaderModal';
import { JobPriceSection } from './JobPriceSection';
import type { BlockReason, JobStatus, Priority, Product, SampleReview } from '../../types';

const TABS = ['General', 'Detalle', 'Producción', 'Instalación', 'Historial', 'Comentarios'] as const;

// Estados en los que el trabajo ya está a disposición del cliente — acá tiene
// sentido ofrecer el mensaje de "está listo" (Gonzalo, tintero de §19).
const CLIENT_MSG_STATUSES: JobStatus[] = ['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION'];

function emptyProduct(): Product {
  return { id: crypto.randomUUID(), label: '', materialIds: [], sizeItems: [{ quantity: '', width: '', height: '' }], notes: '', checked: false };
}

export function JobDetailPage() {
  const { id } = useParams();
  const user = useStore((s) => s.currentUser)!;
  const job = useStore((s) => s.jobs).find((j) => j.id === id);
  const client = useStore((s) => s.clients).find((c) => c.id === job?.clientId);
  const users = useStore((s) => s.users);
  const jobTypes = useStore((s) => s.jobTypes);
  const activityLog = useStore((s) => s.activityLog).filter((a) => a.jobId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const setStatus = useStore((s) => s.setStatus);
  const setPriority = useStore((s) => s.setPriority);
  const setSampleReview = useStore((s) => s.setSampleReview);
  const updateCommittedDate = useStore((s) => s.updateCommittedDate);
  const updateJobSpecs = useStore((s) => s.updateJobSpecs);
  const toggleProductChecked = useStore((s) => s.toggleProductChecked);
  const blockJob = useStore((s) => s.blockJob);
  const unblockJob = useStore((s) => s.unblockJob);
  const completeInstallation = useStore((s) => s.completeInstallation);
  const restoreJob = useStore((s) => s.restoreJob);
  const loadJobComments = useStore((s) => s.loadJobComments);
  const loadJobActivity = useStore((s) => s.loadJobActivity);
  const [restoring, setRestoring] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const changeResponsible = useStore((s) => s.changeResponsible);
  const navigate = useNavigate();
  // `key === 'default'` = esta es la primera pantalla de la sesión (link directo,
  // recarga, pestaña nueva): no hay "atrás" dentro de la app a donde volver.
  const location = useLocation();
  const canGoBack = location.key !== 'default';

  // El aviso de una mención abre directo en Comentarios (en escritorio la
  // conversación ya está siempre a la derecha, así que solo aplica en celular).
  const [tab, setTab] = useState<(typeof TABS)[number]>(() =>
    (location.state as { tab?: string } | null)?.tab === 'Comentarios' && window.matchMedia('(max-width: 1023px)').matches ? 'Comentarios' : 'General');
  const [showBlock, setShowBlock] = useState(false);
  const [showClientMsg, setShowClientMsg] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // En el celular la cabecera no queda fija (ocupaba media pantalla), solo las
  // pestañas. En Comentarios se baja hasta las pestañas para que el cuadro de
  // escribir quede a la vista sin tener que buscarlo.
  const scrollToTabs = useRef(false);
  function selectTab(t: (typeof TABS)[number]) {
    scrollToTabs.current = t === 'Comentarios' && window.matchMedia('(max-width: 1023px)').matches;
    setTab(t);
  }
  // Después de renderizar la pestaña (antes el panel todavía no tenía alto y no había adónde bajar).
  useEffect(() => {
    if (!scrollToTabs.current) return;
    scrollToTabs.current = false;
    const box = scrollRef.current, head = headerRef.current;
    if (box && head && box.scrollTop < head.offsetHeight) box.scrollTo({ top: head.offsetHeight });
  }, [tab]);

  useEffect(() => {
    if (!id) return;
    loadJobComments(id);
    loadJobActivity(id);
  }, [id, loadJobComments, loadJobActivity]);

  if (!job) return <Navigate to="/trabajos" replace />;
  if (!canViewJob(user, job)) {
    return <div className="p-10 text-center text-ink-700">No tenés acceso a este trabajo — no está asignado a vos.</div>;
  }

  const activeBlock = job.blockRecords.find((b) => !b.closedAt);
  const missing = missingFields(job);
  const responsible = users.find((u) => u.id === job.responsibleUserId);
  const creator = users.find((u) => u.id === job.createdByUserId);

  // El último pase de responsable, sacado del Historial (que la ficha ya carga),
  // para que se vea ahí mismo de quién venía y quién lo cambió.
  const handover = activityLog.find((a) => a.action === 'responsable');
  const lastHandover = handover
    ? `${handover.detail.replace(/^Cambió el responsable: (.*) → (.*)\.$/, 'Pasó de $1 a $2')} · por ${users.find((u) => u.id === handover.userId)?.name.split(' ')[0] ?? 'alguien'}, ${fmtDateTime(handover.createdAt)}`
    : null;

  const visibleTabs = TABS.filter((t) => t !== 'Instalación' || job.requiresInstallation);
  const desktopOnlyTab = (t: string) => t !== 'Comentarios';

  return (
    <div className="flex h-full">
      <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto">
        {/* Cabecera fija en escritorio. En el celular el envoltorio es
            "display: contents" y solo quedan fijas las pestañas. */}
        <div className="contents lg:block lg:sticky lg:top-0 lg:z-10 lg:bg-white lg:border-b lg:border-ink-100">
        <div ref={headerRef} className="bg-white px-4 pt-2 lg:px-6 lg:pt-4">
          {/* Vuelve a la pantalla de la que se vino (Dashboard, Kanban, Trabajos,
              Histórico...), no siempre a Trabajos. Solo si se abrió la ficha
              directo (sin historial en la app) cae a la lista de Trabajos. */}
          {canGoBack ? (
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm lg:text-xs font-medium text-ink-700 hover:text-brand-600 min-h-[44px] lg:min-h-0 pr-3 lg:pr-0 lg:mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <ArrowLeft size={15} aria-hidden /> Volver
            </button>
          ) : (
            <Link to="/trabajos" className="inline-flex items-center gap-1 text-sm lg:text-xs font-medium text-ink-700 hover:text-brand-600 min-h-[44px] lg:min-h-0 pr-3 lg:pr-0 lg:mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
              <ArrowLeft size={15} aria-hidden /> Volver a Trabajos
            </Link>
          )}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-ink-700">{job.code ?? 'Sin N° de trabajo'}</span>
                {job.sourceQuoteId && (
                  <Link to={`/presupuestos/${job.sourceQuoteId}`} className="text-[11px] text-brand-600 hover:underline">
                    Generado desde un presupuesto →
                  </Link>
                )}
              </div>
              <div className="flex items-start gap-1.5">
                <h1 className="text-lg font-display font-bold text-ink-900 leading-snug">{job.name}</h1>
                {canEditAnyJob(user.role) && (
                  <button onClick={() => setEditingHeader(true)} aria-label="Editar cliente y nombre del trabajo" title="Editar cliente y nombre"
                    className="-mt-1.5 lg:mt-1 p-2.5 lg:p-1 rounded text-ink-700 hover:text-ink-900 hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <Pencil size={15} aria-hidden />
                  </button>
                )}
              </div>
              <div className="text-sm text-ink-700 mt-0.5">{client?.name} {job.clientImportant && <span title="Cliente prioritario">⭐</span>}</div>
              {(creator || responsible) && (
                <div
                  className="flex items-center gap-2 mt-2 bg-brand-100 text-brand-700 rounded-full pl-1 pr-3 py-1 text-xs font-semibold w-fit"
                  title={creator && responsible ? `${creator.name} asignó este trabajo a ${responsible.name}` : creator ? `Asignado por ${creator.name}` : `Responsable: ${responsible!.name}`}
                >
                  {creator && (
                    <span className="flex items-center gap-1.5">
                      <Avatar name={creator.name} color={creator.avatarColor} size={20} /> {creator.name}
                    </span>
                  )}
                  {creator && responsible && <span className="text-brand-600" aria-hidden>→</span>}
                  {responsible && (
                    <span className="flex items-center gap-1.5">
                      <Avatar name={responsible.name} color={responsible.avatarColor} size={20} /> {responsible.name}
                    </span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-ink-700 mt-1 pl-1">Asigna → Responsable</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* En el celular prioridad y estado ya se leen en sus selects de
                  abajo: repetirlos como badge solo empujaba todo hacia abajo. */}
              <span className={canChangePriority(user.role) ? 'hidden lg:contents' : 'contents'}><PriorityBadge priority={effectivePriority(job)} /></span>
              <span className="hidden lg:contents"><StatusBadge status={job.status} /></span>
              {activeBlock && <BlockedBadge blocked reason={BLOCK_REASON_LABELS[activeBlock.reason as BlockReason]} />}
              <CountdownBadge iso={job.committedDate} status={job.status} />
              <RiskBadge risk={calculateRisk(job)} />
              <SampleReviewBadge state={job.sampleReview} at={job.sampleReviewAt} />
            </div>
          </div>

          {job.deletedAt && (
            <div className="mt-3 flex items-center justify-between gap-3 bg-crit-bg text-crit-text text-sm rounded-lg px-3 py-2.5">
              <span>
                🗑️ Este trabajo está <strong>eliminado</strong> desde el {fmtDate(job.deletedAt)}
                {users.find((u) => u.id === job.deletedBy) ? ` (${users.find((u) => u.id === job.deletedBy)!.name})` : ''} —
                no aparece en Trabajos/Kanban/Dashboard. También podés verlo desde <Link to="/historico" className="underline">Histórico</Link>.
              </span>
              {canDeleteJob(user.role) && (
                <button
                  disabled={restoring}
                  onClick={async () => {
                    setRestoring(true);
                    try { await restoreJob(job.id); } catch (err) { alert(friendlyError(err)); } finally { setRestoring(false); }
                  }}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-white/70 hover:bg-white rounded-md px-2.5 py-1.5 disabled:opacity-50"
                >
                  {restoring ? 'Restaurando...' : 'Restaurar'}
                </button>
              )}
            </div>
          )}

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
                <button
                  onClick={async () => { try { await unblockJob(job.id, user.id); } catch (err) { alert(friendlyError(err)); } }}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-white/70 hover:bg-white rounded-md px-2.5 py-1.5"
                >
                  <Unlock size={13} /> Desbloquear
                </button>
              )}
            </div>
          )}

          {/* En escritorio, selects y acciones van en una sola tira (como antes); en el celular, dos grillas. */}
          <div className="mt-3 lg:flex lg:items-center lg:gap-3 lg:flex-wrap">
          <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 lg:contents">
            <label className="min-w-0 flex flex-col gap-1 text-xs font-medium text-ink-700 lg:block">
              <span className="lg:sr-only">Estado</span>
              <select
                value={job.status}
                onChange={(e) => tryChangeJobStatus(job, e.target.value as JobStatus, setStatus, user.id)}
                className={`w-full lg:w-auto min-h-[44px] lg:min-h-0 text-sm lg:text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white font-normal`}
              >
                {statusOptionsFor(job).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            {canChangePriority(user.role) && (
              <label className="min-w-0 flex flex-col gap-1 text-xs font-medium text-ink-700 lg:block lg:order-first">
                <span className="lg:sr-only">Prioridad</span>
                <select
                  value={effectivePriority(job)}
                  onChange={async (e) => { try { await setPriority(job.id, e.target.value as Priority, user.id); } catch (err) { alert(friendlyError(err)); } }}
                  className={`w-full lg:w-auto min-h-[44px] lg:min-h-0 text-sm lg:text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white font-normal max-w-full`}
                >
                  {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label} — {v.sla}</option>)}
                </select>
              </label>
            )}
            <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-ink-700 lg:inline-flex lg:flex-row lg:items-center lg:gap-1.5 lg:font-normal">
              Muestra al cliente
              <select
                value={job.sampleReview}
                onChange={async (e) => { try { await setSampleReview(job.id, e.target.value as SampleReview, user.id); } catch (err) { alert(friendlyError(err)); } }}
                className={`w-full lg:w-auto min-h-[44px] lg:min-h-0 text-sm lg:text-xs border border-ink-200 rounded-md px-2 py-1.5 bg-white font-normal`}
              >
                {(Object.keys(SAMPLE_REVIEW_META) as SampleReview[]).map((k) => (
                  <option key={k} value={k}>{SAMPLE_REVIEW_META[k].option}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Acciones menos frecuentes: en el celular, botones parejos de 44 px. */}
          <div className="grid grid-cols-2 gap-2 mt-3 lg:contents">
            {!activeBlock && (
              <button onClick={() => setShowBlock(true)} className="inline-flex items-center justify-center gap-1 text-sm lg:text-xs font-semibold rounded-md px-2.5 py-1.5 min-h-[44px] lg:min-h-0 text-crit-text bg-crit-bg hover:brightness-95">
                <Lock size={14} aria-hidden /> Bloquear trabajo
              </button>
            )}
            {/* Cancelar es una decisión administrativa, no un paso más de la
                cadena de producción — por eso tiene su propio botón en vez de
                compartir el select de estado con los 7 pasos del flujo normal
                (mismo criterio que "Bloquear trabajo", ver lib/statusChange.ts).
                Revertir un cancelado sigue siendo por el select (aparece como
                opción extra mientras el trabajo esté en ese estado). */}
            {canEditAnyJob(user.role) && job.status !== 'CANCELADO' && job.status !== 'TERMINADO' && (
              <button onClick={() => setShowCancelConfirm(true)} className="inline-flex items-center justify-center gap-1 text-sm lg:text-xs font-semibold rounded-md px-2.5 py-1.5 min-h-[44px] lg:min-h-0 text-ink-700 bg-ink-100 hover:bg-ink-200">
                <XCircle size={14} aria-hidden /> Cancelar trabajo
              </button>
            )}
            {CLIENT_MSG_STATUSES.includes(job.status) && (
              <button onClick={() => setShowClientMsg(true)} className="col-span-2 inline-flex items-center justify-center gap-1 text-sm lg:text-xs font-semibold rounded-md px-2.5 py-1.5 min-h-[44px] lg:min-h-0 text-plan-text bg-plan-bg hover:brightness-95">
                <MessageCircle size={14} aria-hidden /> Mensaje para el cliente
              </button>
            )}
            <a
              href={`/trabajos/${job.id}/exportar`} target="_blank" rel="noopener noreferrer"
              className="col-span-2 inline-flex items-center justify-center gap-1 text-sm lg:text-xs font-semibold rounded-md px-2.5 py-1.5 min-h-[44px] lg:min-h-0 text-ink-700 bg-ink-100 hover:bg-ink-200"
            >
              <FileOutput size={14} aria-hidden /> Exportar para cliente
            </a>
          </div>
          </div>

          {/* Pestañas con "volumen" tipo Chrome: la activa se levanta (fondo del
              panel + sombra) y se funde con el contenido de abajo; las
              inactivas quedan chatas sobre el header blanco. */}
        </div>
          <div role="tablist" aria-label="Secciones de la ficha" className="sticky top-0 z-10 bg-white border-b border-ink-100 lg:static lg:border-b-0 flex gap-1 pt-3 px-3 lg:pt-4 lg:px-7 overflow-x-auto">
            {visibleTabs.map((t) => (
              <button
                key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`tabpanel-${t}`}
                onClick={() => selectTab(t)}
                className={`px-3 lg:px-4 py-2.5 min-h-[44px] lg:min-h-0 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${desktopOnlyTab(t) ? '' : 'lg:hidden'} ${
                  tab === t
                    ? 'bg-ink-50 text-ink-900 font-semibold shadow-[0_-2px_6px_rgba(15,23,32,0.08)] relative z-10'
                    : 'text-ink-700 hover:bg-ink-100/70 hover:text-ink-900'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 lg:p-6" role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'General' && (
            <>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm max-w-3xl">
                <Field label="Cliente" value={client?.name} />
                <Field label="Contacto" value={job.contactPhone ? `${job.contactName} · ${job.contactPhone}` : job.contactName} />
                <Field label="Generado por" value={creator?.name ?? '—'} />
                {canAssign(user.role) ? (
                  <div>
                    <label htmlFor="job-responsible" className="block text-[11px] uppercase tracking-wide text-ink-700 font-medium mb-0.5">Responsable interno</label>
                    <select
                      id="job-responsible" value={job.responsibleUserId}
                      onChange={async (e) => { try { await changeResponsible(job.id, e.target.value, user.id); } catch (err) { alert(friendlyError(err)); } }}
                      className="min-h-[44px] lg:min-h-0 border border-ink-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {!users.some((u) => u.id === job.responsibleUserId && u.isProducer && u.active) && <option value={job.responsibleUserId}>{responsible?.name ?? '—'}</option>}
                      {users.filter((u) => u.isProducer && u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    {lastHandover && <div className="text-[11px] text-ink-700 mt-1">{lastHandover}</div>}
                  </div>
                ) : (
                  <div>
                    <Field label="Responsable interno" value={responsible?.name} />
                    {lastHandover && <div className="text-[11px] text-ink-700 mt-1">{lastHandover}</div>}
                  </div>
                )}
                <Field label="Asignados" value={[...job.assignedUserIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean), ...job.assignedNames].join(', ') || '—'} />
                <Field label="Fecha de creación" value={fmtDate(job.createdAt)} />
                <Field label="Fecha solicitada por cliente" value={fmtDate(job.requestedDate)} />
                {canChangePriority(user.role) ? (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-ink-700 font-medium mb-0.5">Fecha comprometida</div>
                    <input
                      type="date" value={job.committedDate.slice(0, 10)}
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        try { await updateCommittedDate(job.id, new Date(`${e.target.value}T18:00`).toISOString(), user.id); }
                        catch (err) { alert(friendlyError(err)); }
                      }}
                      className="min-h-[44px] lg:min-h-0 text-ink-800 bg-white lg:bg-transparent border border-ink-200 lg:border-transparent hover:border-ink-200 focus:border-ink-300 rounded px-2 lg:px-1.5 lg:-ml-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                ) : (
                  <Field label="Fecha comprometida" value={fmtDate(job.committedDate)} />
                )}
                <Field label="Tipo de trabajo" value={jobTypes.find((t) => t.id === job.jobTypeId)?.label} />
                <div className="sm:col-span-2">
                  <Field label="Descripción" value={job.description} block />
                </div>
              </div>

              {canSetQuoteValue(user) && <JobPriceSection job={job} />}

              {/* Minuta técnica visible apenas se entra a la ficha (pestaña General,
                  la que abre por defecto) — antes había que ir a la pestaña Detalle
                  para ver qué material/medidas/notas tiene cada producto, y Gonzalo
                  lo describió como que esa info "se pierde" (15/09). Es un preview de
                  solo lectura de los mismos `job.products`/`job.specialRequirements`
                  que se editan en la pestaña Detalle — no es un campo nuevo ni una
                  copia editable, así que no reintroduce la duplicación del punto 1. */}
              {(job.products.length > 0 || job.specialRequirements) && (
                <div className="max-w-3xl mt-6 pt-5 border-t border-ink-100">
                  <div className="text-[11px] uppercase tracking-wide text-ink-700 font-semibold mb-2.5">
                    Detalle técnico
                  </div>
                  <ProductsView products={job.products} />
                  {job.specialRequirements && (
                    <p className="text-sm text-ink-800 mt-3 leading-relaxed">{job.specialRequirements}</p>
                  )}
                  <button onClick={() => selectTab('Detalle')} className="text-sm lg:text-xs font-medium text-brand-600 hover:underline mt-3 min-h-[44px] lg:min-h-0">
                    Editar en la pestaña Detalle →
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'Detalle' && (
            <ProductsTab
              job={job}
              onSave={(specs) => updateJobSpecs(job.id, specs, user.id)}
              onToggle={async (productId) => { try { await toggleProductChecked(job.id, productId, user.id); } catch (err) { alert(friendlyError(err)); } }}
            />
          )}

          {tab === 'Producción' && <ProductionTab key={job.id} job={job} />}

          {tab === 'Instalación' && job.installation && (
            <InstallationTab job={job} onComplete={async (notes) => { try { await completeInstallation(job.id, notes, user.id); } catch (err) { alert(friendlyError(err)); } }} />
          )}

          {tab === 'Comentarios' && (
            <div className="lg:hidden -mx-4 -mb-4 h-[calc(100dvh-8rem)] min-h-[380px]">
              <CommentsPanel job={job} />
            </div>
          )}

          {tab === 'Historial' && (
            <div className="max-w-2xl space-y-3">
              {activityLog.length === 0 && <div className="text-sm text-ink-700">Sin actividad registrada.</div>}
              {activityLog.map((a) => {
                const actor = users.find((u) => u.id === a.userId);
                return (
                  <div key={a.id} className="flex gap-3">
                    <Avatar name={actor?.name ?? '?'} color={actor?.avatarColor ?? '#999'} size={26} />
                    <div>
                      <div className="text-sm text-ink-800"><strong>{actor?.name}</strong> — {a.detail}</div>
                      <div className="text-xs text-ink-700">{fmtDateTime(a.createdAt)}</div>
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
        <BlockModal
          onClose={() => setShowBlock(false)}
          onConfirm={async (reason, desc) => {
            try { await blockJob(job.id, reason, desc, user.id); } catch (err) { alert(friendlyError(err)); }
            setShowBlock(false);
          }}
        />
      )}
      {editingHeader && <EditJobHeaderModal job={job} onClose={() => setEditingHeader(false)} />}
      {showClientMsg && (
        <ClientMessageModal job={job} client={client} onClose={() => setShowClientMsg(false)} />
      )}
      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancelar trabajo"
          message={<>¿Cancelar <strong>"{job.name}"</strong>{job.code ? ` (${job.code})` : ''}? Se puede revertir después eligiendo otro estado desde el select.</>}
          confirmLabel="Cancelar trabajo" cancelLabel="Volver" tone="danger"
          onConfirm={async () => {
            setShowCancelConfirm(false);
            try { await setStatus(job.id, 'CANCELADO', user.id); } catch (err) { alert(friendlyError(err)); }
          }}
          onClose={() => setShowCancelConfirm(false)}
        />
      )}
    </div>
  );
}

function Field({ label, value, block, highlightMissing }: { label: string; value?: string; block?: boolean; highlightMissing?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-700 font-medium mb-0.5">{label}</div>
      <div className={`text-ink-800 ${block ? 'leading-relaxed whitespace-pre-wrap break-words' : ''} ${highlightMissing ? 'text-wait-text italic' : ''}`}>
        {value || (highlightMissing ? 'Falta completar' : '—')}
      </div>
    </div>
  );
}

// Es la pestaña "Detalle": acá se ve/carga de qué se trata el trabajo — cada
// producto con su material, cantidades y medidas. El modo edición es el mismo
// editor que Carga rápida (ProductsEditor). Los checkboxes de "procesado" se
// pueden tildar sin entrar a editar (se usan todo el tiempo mientras se procesa).
function ProductsTab({ job, onSave, onToggle }: { job: import('../../types').Job; onSave: (specs: JobSpecs) => Promise<void>; onToggle: (productId: string) => void }) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [products, setProducts] = useState<Product[]>(job.products);
  const [specialRequirements, setSpecialRequirements] = useState(job.specialRequirements);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    // Si todavía no hay nada cargado, arrancar con un producto vacío listo para
    // completar — igual que Carga rápida, en vez de un cartel de "nada cargado".
    setProducts(job.products.length ? job.products : [emptyProduct()]);
    setSpecialRequirements(job.specialRequirements);
    setMode('edit');
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ products, specialRequirements });
      setMode('view');
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const labelCls = 'block text-xs font-medium text-ink-700 mb-1.5';
  const doneCount = job.products.filter((p) => p.checked).length;

  if (mode === 'view') {
    return (
      <div className="max-w-3xl text-sm space-y-4">
        <p className="text-xs text-ink-700">
          De qué se trata el trabajo: cada producto con su material, cantidades y medidas.
        </p>
        {job.products.length > 0 && (
          <div className="text-xs text-ink-700">{doneCount} de {job.products.length} productos procesados</div>
        )}
        <ProductsView products={job.products} onToggle={onToggle} />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-ink-700 font-semibold mb-2.5">Requisitos especiales</div>
          <p className="text-ink-800">{job.specialRequirements || '—'}</p>
        </div>
        <button
          onClick={startEdit}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 border border-brand-300 rounded-lg px-4 py-2 hover:bg-brand-50"
        >
          <Pencil size={14} /> {job.products.length ? 'Editar detalle del trabajo' : 'Cargar detalle del trabajo'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl text-sm space-y-4">
      <p className="text-xs text-ink-700">
        Cargá cada producto con su material, cantidades y medidas — igual que en Carga rápida.
      </p>
      <ProductsEditor products={products} onChange={setProducts} jobTypeId={job.jobTypeId} />
      <div>
        <label htmlFor="specs-special" className={labelCls}>Requisitos especiales</label>
        <textarea id="specs-special" className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" rows={2} value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-950 text-white px-4 py-2 rounded-lg hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button onClick={() => setMode('view')} disabled={saving} className="text-sm text-ink-700 hover:text-ink-900 disabled:opacity-40">Cancelar</button>
      </div>
    </div>
  );
}

function InstallationTab({ job, onComplete }: { job: import('../../types').Job; onComplete: (notes: string) => void }) {
  const inst = job.installation!;
  const [showComplete, setShowComplete] = useState(false);
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
          onClick={() => setShowComplete(true)}
          className="bg-ink-950 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-ink-800"
        >
          Marcar instalación completada
        </button>
      )}
      {showComplete && (
        <PromptDialog
          title="Instalación completada" label="Observaciones (opcional)"
          placeholder="Ej: instalado sin inconvenientes, cliente presente."
          confirmLabel="Marcar completada"
          onConfirm={(notes) => { onComplete(notes); setShowComplete(false); }}
          onClose={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
