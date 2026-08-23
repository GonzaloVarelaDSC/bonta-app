import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Phone } from 'lucide-react';
import type { Job, Priority } from '../../types';
import { useStore } from '../../store/useStore';
import { effectivePriority } from '../../lib/priority';
import { canEditAnyJob } from '../../lib/permissions';
import { PriorityBadge, StatusSelect, CountdownBadge, Avatar } from '../Common/Badges';
import { SELECTABLE_STATUSES, tryChangeJobStatus } from '../../lib/statusChange';
import { fmtDate } from '../../lib/dates';
import { isSilent } from '../../lib/risk';

function EditableCode({ job, editable, onSave }: { job: Job; editable: boolean; onSave: (code: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(job.code ?? '');

  if (!editable) return <span className="font-mono text-sm font-semibold text-ink-900">{job.code ?? '—'}</span>;

  if (editing) {
    const save = () => { setEditing(false); if (draft.trim() && draft.trim() !== job.code) onSave(draft); };
    return (
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={save} placeholder="N° de Copernico"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="font-mono text-sm w-28 border border-brand-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(job.code ?? ''); setEditing(true); }}
      title="Cargar número de trabajo / orden de Copernico"
      className={
        job.code
          ? 'font-mono text-sm font-semibold text-ink-900 hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300 whitespace-nowrap'
          : 'text-sm text-ink-400 italic hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300 whitespace-nowrap'
      }
    >
      {job.code ?? 'Cargar N°'}
    </button>
  );
}

// Cada ficha se marca con un borde de color a la izquierda según su prioridad —
// mismo lenguaje que ya usan las tarjetas de KPI del Dashboard — para que se lea
// el estado de todo el día de un vistazo, no solo lo urgente.
const PRIORITY_ACCENT: Record<Priority, string> = {
  CRITICO: 'border-l-4 border-l-crit',
  URGENTE: 'border-l-4 border-l-urg',
  NORMAL: 'border-l-4 border-l-norm',
  PLANIFICADO: 'border-l-4 border-l-plan',
  EN_ESPERA: 'border-l-4 border-l-wait',
};

/**
 * Fila de briefing diario, horizontal (como la tabla de antes) pero con toda la
 * información nueva: quién se lo asignó, para cuándo, qué tan urgente es, de qué
 * se trata y cómo contactar al cliente — todo de un vistazo, sin abrir la ficha.
 * Se arma en dos líneas internas (meta arriba, nombre+descripción abajo) para que
 * la descripción tenga lugar real y nada se empuje fuera de la tarjeta. La
 * navegación a la ficha completa es un botón explícito, nunca "click en cualquier
 * lado", así el estado y el N° nunca compiten con eso.
 */
export function DashboardJobCard({ job }: { job: Job }) {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const setJobCode = useStore((s) => s.setJobCode);
  const setStatus = useStore((s) => s.setStatus);

  const client = clients.find((c) => c.id === job.clientId);
  const resp = users.find((u) => u.id === job.responsibleUserId);
  const creator = users.find((u) => u.id === job.createdByUserId);
  const canEditCode = !!currentUser && canEditAnyJob(currentUser.role);
  const priority = effectivePriority(job);

  return (
    <div className={clsx(
      'bg-white rounded-xl border-t border-r border-b border-ink-100 shadow-card px-4 py-3 flex flex-col gap-2',
      PRIORITY_ACCENT[priority]
    )}>
      <div className="flex items-center gap-3 flex-wrap">
        <PriorityBadge priority={priority} manual={!!job.priorityManual} size="sm" />
        {isSilent(job) && <span title="Más de 48h sin movimiento">💤</span>}
        <StatusSelect
          status={job.status} options={SELECTABLE_STATUSES}
          onChange={(s) => currentUser && tryChangeJobStatus(job, s, setStatus, currentUser.id)}
        />
        <EditableCode job={job} editable={canEditCode} onSave={(code) => setJobCode(job.id, code, currentUser!.id)} />
        <span className="text-sm font-semibold text-ink-900 truncate max-w-[160px]">{client?.name}</span>

        <div className="flex items-center gap-2 text-xs text-ink-800 font-medium ml-auto whitespace-nowrap">
          <span>Asignado {fmtDate(job.createdAt)}</span>
          <span className="text-ink-300 font-normal">·</span>
          <span>Entrega {fmtDate(job.committedDate)}</span>
          <CountdownBadge iso={job.committedDate} />
        </div>

        <button
          type="button"
          onClick={() => navigate(`/trabajos/${job.id}`)}
          className="shrink-0 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          Ver ficha <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-[220px] flex-1">
          <div className="text-sm font-semibold text-ink-900 leading-snug">{job.name}</div>
          {job.description && (
            <div className="text-sm text-ink-700 mt-0.5 leading-snug line-clamp-2">{job.description}</div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-ink-500 shrink-0">
          {(job.contactName || job.contactPhone) && (
            <div className="flex items-center gap-1.5">
              <Phone size={12} className="text-ink-400 shrink-0" />
              <span className="truncate max-w-[160px]">{job.contactName}{job.contactName && job.contactPhone ? ' · ' : ''}{job.contactPhone}</span>
            </div>
          )}
          {resp && (
            <span className="flex items-center gap-1"><Avatar name={resp.name} color={resp.avatarColor} size={18} /> {resp.name.split(' ')[0]}</span>
          )}
          {creator && <span className="whitespace-nowrap">Asignado por {creator.name.split(' ')[0]}</span>}
        </div>
      </div>
    </div>
  );
}
