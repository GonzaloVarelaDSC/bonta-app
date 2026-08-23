import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import type { Job } from '../../types';
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

  if (!editable) return <span className="font-mono text-xs text-ink-500">{job.code ?? '—'}</span>;

  if (editing) {
    const save = () => { setEditing(false); if (draft.trim() && draft.trim() !== job.code) onSave(draft); };
    return (
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={save} placeholder="N° de Copernico"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="font-mono text-xs w-28 border border-brand-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
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
          ? 'font-mono text-xs text-ink-500 hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300'
          : 'text-xs text-ink-400 italic hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300'
      }
    >
      {job.code ?? 'Cargar N°'}
    </button>
  );
}

/**
 * Tarjeta de briefing diario — pensada para que Gonzalo llegue a las 9am y sepa qué
 * tiene que hacer sin leer notas ni un pizarrón: quién se lo asignó, para cuándo,
 * qué tan urgente es, de qué se trata y cómo contactar al cliente. La navegación a
 * la ficha completa es un link explícito, nunca "click en cualquier lado" — así el
 * selector de estado y el N° de trabajo nunca compiten con el click de la tarjeta.
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

  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={effectivePriority(job)} manual={!!job.priorityManual} size="sm" />
          {isSilent(job) && <span title="Más de 48h sin movimiento">💤</span>}
        </div>
        <StatusSelect
          status={job.status} options={SELECTABLE_STATUSES}
          onChange={(s) => currentUser && tryChangeJobStatus(job, s, setStatus, currentUser.id)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <EditableCode job={job} editable={canEditCode} onSave={(code) => setJobCode(job.id, code, currentUser!.id)} />
        <span className="text-ink-500 truncate">{client?.name}</span>
      </div>

      <div>
        <div className="text-sm font-semibold text-ink-900 leading-snug">{job.name}</div>
        {job.description && <div className="text-xs text-ink-500 mt-0.5 line-clamp-2">{job.description}</div>}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-ink-500 bg-ink-50 rounded-lg px-2.5 py-1.5">
        <span>Asignado {fmtDate(job.createdAt)}</span>
        <span className="text-ink-300">·</span>
        <span>Entrega {fmtDate(job.committedDate)}</span>
        <CountdownBadge iso={job.committedDate} />
      </div>

      {(job.contactName || job.contactPhone) && (
        <div className="flex items-center gap-1.5 text-xs text-ink-600">
          <Phone size={12} className="text-ink-400 shrink-0" />
          <span className="truncate">{job.contactName}{job.contactName && job.contactPhone ? ' · ' : ''}{job.contactPhone}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-ink-50">
        <div className="flex items-center gap-3 text-[11px] text-ink-400">
          {resp && (
            <span className="flex items-center gap-1"><Avatar name={resp.name} color={resp.avatarColor} size={18} /> {resp.name.split(' ')[0]}</span>
          )}
          {creator && <span>Generado por {creator.name.split(' ')[0]}</span>}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/trabajos/${job.id}`)}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline shrink-0"
        >
          Ver ficha <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
