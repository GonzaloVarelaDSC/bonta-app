import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Trash2 } from 'lucide-react';
import type { Job } from '../../types';
import { useStore } from '../../store/useStore';
import { effectivePriority } from '../../lib/priority';
import { canEditAnyJob, canDeleteJob } from '../../lib/permissions';
import { PriorityBadge, StatusSelect, CountdownBadge, Avatar, BlockedBadge } from '../Common/Badges';
import { fmtShort } from '../../lib/dates';
import { isSilent } from '../../lib/risk';
import { isBlocked } from '../../lib/selectors';
import { BLOCK_REASON_LABELS } from '../../data/catalog';
import type { BlockReason } from '../../types';
import { statusOptionsFor, tryChangeJobStatus, isClosedStatus } from '../../lib/statusChange';
import { friendlyError } from '../../lib/errors';
import { ScrollFadeX } from '../Common/ScrollFade';
import { EditableCode } from '../Common/EditableCode';
import { ConfirmDialog } from '../Common/Modal';

export function JobsTable({ jobs, compact }: { jobs: Job[]; compact?: boolean }) {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const setJobCode = useStore((s) => s.setJobCode);
  const setStatus = useStore((s) => s.setStatus);
  const deleteJob = useStore((s) => s.deleteJob);
  const canEditCode = !!currentUser && canEditAnyJob(currentUser.role);
  const canDelete = !!currentUser && canDeleteJob(currentUser.role);
  const [confirmDelete, setConfirmDelete] = useState<Job | null>(null);

  async function doDelete(j: Job) {
    try {
      await deleteJob(j.id);
    } catch (err: any) {
      alert(friendlyError(err));
    }
  }

  if (jobs.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-ink-700">No hay trabajos que coincidan con este filtro.</div>;
  }

  return (
    <>
      <ScrollFadeX className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-700 border-b border-ink-100">
            <th className="px-4 py-2.5 font-medium">Prioridad</th>
            <th className="px-2 py-2.5 font-medium">N°</th>
            <th className="px-2 py-2.5 font-medium">Cliente</th>
            <th className="px-2 py-2.5 font-medium">Trabajo</th>
            <th className="px-2 py-2.5 font-medium">Estado</th>
            <th className="px-2 py-2.5 font-medium">Responsable</th>
            <th className="px-2 py-2.5 font-medium">Entrega</th>
            {!compact && <th className="px-2 py-2.5 font-medium">Actualizado</th>}
            {/* Pegada al borde derecho del scroll horizontal (sticky) — en una
                tabla de 8-9 columnas el tacho de eliminar quedaba al final,
                fuera de la vista, y había que scrollear hasta el fondo para
                encontrarlo (Gonzalo, 22/09). Con `sticky right-0` queda
                siempre visible sin importar cuánto se scrollee la tabla. */}
            <th className="px-2 py-2.5 font-medium sticky right-0 bg-white"><span className="sr-only">Acciones</span></th>
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
                onClick={(e) => {
                  // No navegar si el click fue sobre un control interactivo (select de estado, editor de N°).
                  if ((e.target as HTMLElement).closest('select, button, input')) return;
                  navigate(`/trabajos/${j.id}`);
                }}
                className="group border-b border-ink-50 last:border-0 hover:bg-ink-50/70 cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5"><PriorityBadge priority={effectivePriority(j)} size="sm" /></td>
                <td className="px-2 py-2.5 whitespace-nowrap">
                  <EditableCode job={j} editable={canEditCode} onSave={(code) => setJobCode(j.id, code, currentUser!.id)} stopClickPropagation />
                </td>
                <td className="px-2 py-2.5 text-ink-700 whitespace-nowrap">{client?.name}</td>
                <td className="px-2 py-2.5 text-ink-900 font-medium max-w-[260px] truncate">
                  {j.name}
                  {silent && <span className="ml-1.5 text-wait-text" title="Más de 48h sin movimiento">💤</span>}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusSelect
                      status={j.status} options={statusOptionsFor(j)}
                      onChange={(s) => tryChangeJobStatus(j, s, setStatus, currentUser!.id)}
                    />
                    {isBlocked(j) && (
                      <BlockedBadge blocked size="sm" reason={BLOCK_REASON_LABELS[j.blockRecords.find((b) => !b.closedAt)!.reason as BlockReason]} />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  {resp && <div className="flex items-center gap-1.5 whitespace-nowrap"><Avatar name={resp.name} color={resp.avatarColor} size={20} /><span className="text-xs text-ink-700">{resp.name.split(' ')[0]}</span></div>}
                </td>
                <td className="px-2 py-2.5">
                  {isClosedStatus(j.status)
                    ? <span className="text-xs text-ink-700">{fmtShort(j.committedDate)}</span>
                    : <CountdownBadge iso={j.committedDate} status={j.status} />}
                </td>
                {!compact && <td className="px-2 py-2.5 text-xs text-ink-700 whitespace-nowrap">{fmtShort(j.lastActivityAt)}</td>}
                <td className="px-2 py-2.5 sticky right-0 bg-white group-hover:bg-ink-50/70 transition-colors">
                  <div className="flex items-center gap-2">
                    <button
                      type="button" onClick={() => navigate(`/trabajos/${j.id}`)}
                      aria-label={`Ver ficha de ${j.name}`}
                      className="text-ink-700 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                    >
                      <ArrowRight size={15} />
                    </button>
                    {canDelete && (
                      <button
                        type="button" onClick={() => setConfirmDelete(j)}
                        aria-label={`Eliminar ${j.name}`}
                        className="text-crit hover:text-crit-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollFadeX>
    {confirmDelete && (
      <ConfirmDialog
        title="Eliminar trabajo"
        message={<>¿Eliminar <strong>"{confirmDelete.name}"</strong>{confirmDelete.code ? ` (${confirmDelete.code})` : ''}? Deja de aparecer en Trabajos/Kanban/Dashboard — se puede restaurar después desde Histórico.</>}
        confirmLabel="Eliminar" tone="danger"
        onConfirm={() => { const j = confirmDelete; setConfirmDelete(null); doDelete(j); }}
        onClose={() => setConfirmDelete(null)}
      />
    )}
    </>
  );
}
