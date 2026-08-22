import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Job } from '../../types';
import { useStore } from '../../store/useStore';
import { effectivePriority } from '../../lib/priority';
import { canEditAnyJob } from '../../lib/permissions';
import { PriorityBadge, StatusBadge, CountdownBadge, Avatar } from '../Common/Badges';
import { JOB_TYPES } from '../../data/catalog';
import { fmtShort } from '../../lib/dates';
import { isSilent } from '../../lib/risk';

function EditableCode({ job, editable, onSave }: { job: Job; editable: boolean; onSave: (code: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(job.code);

  if (!editable) return <span className="font-mono text-xs text-ink-500">{job.code}</span>;

  if (editing) {
    const save = () => { setEditing(false); if (draft.trim() && draft.trim() !== job.code) onSave(draft); };
    return (
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="font-mono text-xs w-28 border border-brand-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setDraft(job.code); setEditing(true); }}
      title="Editar número de trabajo / orden de Copernico"
      className="font-mono text-xs text-ink-500 hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300"
    >
      {job.code}
    </button>
  );
}

export function JobsTable({ jobs, compact }: { jobs: Job[]; compact?: boolean }) {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const setJobCode = useStore((s) => s.setJobCode);
  const canEditCode = !!currentUser && canEditAnyJob(currentUser.role);

  if (jobs.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-ink-400">No hay trabajos que coincidan con este filtro.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-400 border-b border-ink-100">
            <th className="px-4 py-2.5 font-medium">Prioridad</th>
            <th className="px-2 py-2.5 font-medium">N°</th>
            <th className="px-2 py-2.5 font-medium">Cliente</th>
            <th className="px-2 py-2.5 font-medium">Trabajo</th>
            {!compact && <th className="px-2 py-2.5 font-medium">Tipo</th>}
            <th className="px-2 py-2.5 font-medium">Estado</th>
            <th className="px-2 py-2.5 font-medium">Responsable</th>
            <th className="px-2 py-2.5 font-medium">Entrega</th>
            {!compact && <th className="px-2 py-2.5 font-medium">Actualizado</th>}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const client = clients.find((c) => c.id === j.clientId);
            const resp = users.find((u) => u.id === j.responsibleUserId);
            const silent = isSilent(j);
            return (
              <tr
                key={j.id}
                onClick={() => navigate(`/trabajos/${j.id}`)}
                className="border-b border-ink-50 last:border-0 hover:bg-ink-50/70 cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5"><PriorityBadge priority={effectivePriority(j)} manual={!!j.priorityManual} size="sm" /></td>
                <td className="px-2 py-2.5 whitespace-nowrap">
                  <EditableCode job={j} editable={canEditCode} onSave={(code) => setJobCode(j.id, code, currentUser!.id)} />
                </td>
                <td className="px-2 py-2.5 text-ink-700 whitespace-nowrap">{client?.name}</td>
                <td className="px-2 py-2.5 text-ink-900 font-medium max-w-[260px] truncate">
                  {j.name}
                  {silent && <span className="ml-1.5 text-wait-text" title="Más de 48h sin movimiento">💤</span>}
                </td>
                {!compact && <td className="px-2 py-2.5 text-ink-500 whitespace-nowrap">{JOB_TYPES.find((t) => t.id === j.jobTypeId)?.label}</td>}
                <td className="px-2 py-2.5"><StatusBadge status={j.status} /></td>
                <td className="px-2 py-2.5">
                  {resp && <div className="flex items-center gap-1.5 whitespace-nowrap"><Avatar name={resp.name} color={resp.avatarColor} size={20} /><span className="text-xs text-ink-600">{resp.name.split(' ')[0]}</span></div>}
                </td>
                <td className="px-2 py-2.5"><CountdownBadge iso={j.committedDate} /></td>
                {!compact && <td className="px-2 py-2.5 text-xs text-ink-400 whitespace-nowrap">{fmtShort(j.lastActivityAt)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
