import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Moon, Phone } from 'lucide-react';
import type { Job, Priority, BlockReason } from '../../types';
import { useStore } from '../../store/useStore';
import { effectivePriority } from '../../lib/priority';
import { canEditAnyJob, canChangePriority } from '../../lib/permissions';
import { PriorityBadge, PrioritySelect, StatusSelect, CountdownBadge, Avatar, SampleReviewBadge, BlockedBadge, EscalatedHint } from '../Common/Badges';
import { statusOptionsFor, tryChangeJobStatus } from '../../lib/statusChange';
import { friendlyError } from '../../lib/errors';
import { fmtDate, fmtShort } from '../../lib/dates';
import { isSilent } from '../../lib/risk';
import { isBlocked } from '../../lib/selectors';
import { BLOCK_REASON_LABELS } from '../../data/catalog';
import { CodeStamp } from '../Common/EditableCode';

// Cada ficha se marca con una franja de color a la izquierda según su prioridad.
// urg/norm usan su variante -text: el DEFAULT no llega a 3:1 como borde.
const PRIORITY_ACCENT: Record<Priority, string> = {
  CRITICO: 'before:bg-crit',
  URGENTE: 'before:bg-urg-text',
  NORMAL: 'before:bg-norm-text',
  PLANIFICADO: 'before:bg-plan',
  EN_ESPERA: 'before:bg-wait',
};

/**
 * Fila de briefing diario. Rediseño "Pulido" (08/11): lo primero que se lee es
 * el nombre del trabajo (un link real a la ficha, también en celular), debajo
 * cliente · N° · descripción, y abajo de una regla fina los controles y datos
 * (prioridad, estado, fechas, contacto, asigna → responsable). Clickear cualquier
 * zona no interactiva también abre la ficha (mismo resguardo `closest(...)`).
 */
export function DashboardJobCard({ job }: { job: Job }) {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const setJobCode = useStore((s) => s.setJobCode);
  const setStatus = useStore((s) => s.setStatus);
  const setPriority = useStore((s) => s.setPriority);

  const client = clients.find((c) => c.id === job.clientId);
  const resp = users.find((u) => u.id === job.responsibleUserId);
  const creator = users.find((u) => u.id === job.createdByUserId);
  const canEditCode = !!currentUser && canEditAnyJob(currentUser.role);
  const canEditPriority = !!currentUser && canChangePriority(currentUser.role);
  const priority = effectivePriority(job);
  const href = `/trabajos/${job.id}`;
  const assignTitle = creator && resp
    ? `${creator.name} asignó este trabajo a ${resp.name}`
    : creator ? `Asignado por ${creator.name}` : resp ? `Responsable: ${resp.name}` : '';

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('select, button, input, a')) return;
        navigate(href);
      }}
      className={clsx(
        'group relative overflow-hidden bg-white rounded-card border border-ink-200/80 shadow-card cursor-pointer transition-shadow hover:shadow-lift',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        PRIORITY_ACCENT[priority]
      )}
    >
      <div className="pl-5 pr-4 pt-3.5 pb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={href}
            className="text-[15px] font-semibold text-ink-900 leading-snug tracking-tight hover:text-brand-700 hover:underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {job.name}
          </Link>
          <div className="mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap text-sm">
            <span className="font-semibold text-ink-800 truncate max-w-[220px]" title={client?.name}>{client?.name}</span>
            <span className="text-ink-700" aria-hidden>·</span>
            <CodeStamp job={job} editable={canEditCode} onSave={(code) => setJobCode(job.id, code, currentUser!.id)} />
            {isSilent(job) && (
              <span title="Más de 48h sin ningún movimiento" className="inline-flex items-center gap-1 text-meta font-medium text-wait-text">
                <Moon size={12} aria-hidden />Sin movimiento
              </span>
            )}
          </div>
          {job.description && (
            <p className="text-sm text-ink-700 mt-1 leading-snug line-clamp-2 max-w-[80ch]">{job.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <CountdownBadge iso={job.committedDate} status={job.status} />
          <Link
            to={href}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Ver ficha <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="pl-5 pr-4 py-2.5 border-t border-ink-100 bg-ink-50/50 flex items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {canEditPriority
            ? <PrioritySelect priority={priority} onChange={async (p) => { try { await setPriority(job.id, p, currentUser!.id); } catch (err) { alert(friendlyError(err)); } }} />
            : <PriorityBadge priority={priority} size="sm" />}
          <EscalatedHint job={job} />
          <StatusSelect
            size="sm"
            status={job.status} options={statusOptionsFor(job)}
            onChange={(s) => currentUser && tryChangeJobStatus(job, s, setStatus, currentUser.id)}
          />
          {isBlocked(job) && (
            <BlockedBadge blocked size="sm" reason={BLOCK_REASON_LABELS[job.blockRecords.find((b) => !b.closedAt)!.reason as BlockReason]} />
          )}
          <SampleReviewBadge state={job.sampleReview} at={job.sampleReviewAt} size="sm" />
        </div>

        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs text-ink-700 sm:ml-auto">
          <span className="whitespace-nowrap">Entrega <span className="font-semibold text-ink-900">{fmtDate(job.committedDate)}</span></span>
          {/* Hora exacta de creación (20/09): mismo timestamp que "Asignado". */}
          <span className="whitespace-nowrap">Asignado {fmtShort(job.createdAt)}</span>
          {(job.contactName || job.contactPhone) && (
            <span className="flex items-center gap-1.5 min-w-0">
              <Phone size={12} aria-hidden className="shrink-0" />
              <span className="truncate max-w-[180px]">{job.contactName}{job.contactName && job.contactPhone ? ' · ' : ''}{job.contactPhone}</span>
            </span>
          )}
          {(creator || resp) && (
            <span className="flex items-center gap-1.5 text-ink-800 font-medium whitespace-nowrap" title={assignTitle}>
              {creator && <><Avatar name={creator.name} color={creator.avatarColor} size={20} decorative /> {creator.name.split(' ')[0]}</>}
              {creator && resp && <ArrowRight size={12} className="text-ink-700" aria-label="asignó a" />}
              {resp && <><Avatar name={resp.name} color={resp.avatarColor} size={20} decorative /> <span className="font-semibold text-ink-900">{resp.name.split(' ')[0]}</span></>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
