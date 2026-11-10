import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Moon, Trash2 } from 'lucide-react';
import type { Job } from '../../types';
import { useStore } from '../../store/useStore';
import { effectivePriority } from '../../lib/priority';
import { canEditAnyJob, canDeleteJob } from '../../lib/permissions';
import { PriorityBadge, StatusSelect, CountdownBadge, Avatar, BlockedBadge, EscalatedHint } from '../Common/Badges';
import { fmtShort, fmtDate } from '../../lib/dates';
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
      {/* Celular (18/10): la tabla de 9 columnas obligaba a deslizar de costado
          para ver hasta el nombre del trabajo. Debajo de md cada trabajo es una
          tarjeta con lo mismo, apilado; la tabla queda para pantallas anchas. */}
      <ul className="md:hidden divide-y divide-ink-100">
        {jobs.map((j) => {
          const client = clients.find((c) => c.id === j.clientId);
          const resp = users.find((u) => u.id === j.responsibleUserId);
          return (
            // Celular (rediseño 08/11): nombre primero (es el link a la ficha),
            // debajo cliente · N° · prioridad, y una fila de estado +
            // responsable + tacho. Sin el renglón de la flecha.
            <li key={j.id} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => navigate(`/trabajos/${j.id}`)} className="flex-1 min-w-0 text-left text-[15px] font-semibold text-ink-900 leading-snug break-words focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
                  {j.name}{isSilent(j) && <Moon size={12} aria-label="Más de 48h sin movimiento" className="inline ml-1.5 -mt-0.5 text-wait-text" />}
                </button>
                {isClosedStatus(j.status)
                  ? <span className="text-xs text-ink-700 whitespace-nowrap mt-0.5">{fmtDate(j.committedDate)}</span>
                  : <CountdownBadge iso={j.committedDate} status={j.status} compact />}
              </div>
              <div className="mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap text-sm">
                <span className="font-medium text-ink-800 break-words">{client?.name ?? '—'}</span>
                <span className="text-ink-700" aria-hidden>·</span>
                <EditableCode job={j} editable={canEditCode} onSave={(code) => setJobCode(j.id, code, currentUser!.id)} stopClickPropagation />
                <span className="text-ink-700" aria-hidden>·</span>
                <PriorityBadge priority={effectivePriority(j)} size="sm" /><EscalatedHint job={j} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusSelect size="sm" className="min-w-0 shrink" status={j.status} options={statusOptionsFor(j)} onChange={(st) => tryChangeJobStatus(j, st, setStatus, currentUser!.id)} />
                {isBlocked(j) && <BlockedBadge blocked size="sm" reason={BLOCK_REASON_LABELS[j.blockRecords.find((b) => !b.closedAt)!.reason as BlockReason]} />}
                {resp && <span className="flex items-center gap-1.5 text-xs text-ink-800 shrink-0"><Avatar name={resp.name} color={resp.avatarColor} size={20} decorative />{resp.name.split(' ')[0]}</span>}
                {canDelete && <button type="button" onClick={() => setConfirmDelete(j)} aria-label={`Eliminar ${j.name}`} className="ml-auto text-crit-text hover:bg-crit-bg w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-ctl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Trash2 size={16} /></button>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hidden md:block">
      <ScrollFadeX className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-ink-700 bg-ink-50/70 border-b border-ink-200">
            <th className="px-4 py-2.5 font-medium">Prioridad</th>
            <th className="px-2.5 py-2.5 font-medium">N°</th>
            <th className="px-2.5 py-2.5 font-medium">Cliente</th>
            <th className="px-2.5 py-2.5 font-medium">Trabajo</th>
            <th className="px-2.5 py-2.5 font-medium">Estado</th>
            <th className="px-2.5 py-2.5 font-medium">Responsable</th>
            <th className="px-2.5 py-2.5 font-medium">Entrega</th>
            {!compact && <th className="px-2.5 py-2.5 font-medium">Actualizado</th>}
            {/* Pegada al borde derecho del scroll horizontal (sticky) — en una
                tabla de 8-9 columnas el tacho de eliminar quedaba al final,
                fuera de la vista, y había que scrollear hasta el fondo para
                encontrarlo (Gonzalo, 22/09). Con `sticky right-0` queda
                siempre visible sin importar cuánto se scrollee la tabla. */}
            <th className="px-2 py-2.5 font-medium sticky right-0 bg-ink-50"><span className="sr-only">Acciones</span></th>
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
                className="group border-b border-ink-100 last:border-0 hover:bg-ink-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3"><div className="flex flex-col items-start gap-0.5"><PriorityBadge priority={effectivePriority(j)} size="sm" /><EscalatedHint job={j} /></div></td>
                <td className="px-2.5 py-3 whitespace-nowrap">
                  <EditableCode job={j} editable={canEditCode} onSave={(code) => setJobCode(j.id, code, currentUser!.id)} stopClickPropagation />
                </td>
                <td className="px-2.5 py-3 text-ink-800 max-w-[140px] truncate" title={client?.name}>{client?.name}</td>
                <td className="px-2.5 py-3 text-ink-900 font-semibold max-w-[220px] truncate">
                  {j.name}
                  {silent && <Moon size={12} aria-label="Más de 48h sin movimiento" className="inline ml-1.5 -mt-0.5 text-wait-text" />}
                </td>
                <td className="px-2.5 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusSelect
                      size="sm"
                      status={j.status} options={statusOptionsFor(j)}
                      onChange={(s) => tryChangeJobStatus(j, s, setStatus, currentUser!.id)}
                    />
                    {isBlocked(j) && (
                      <BlockedBadge blocked size="sm" reason={BLOCK_REASON_LABELS[j.blockRecords.find((b) => !b.closedAt)!.reason as BlockReason]} />
                    )}
                  </div>
                </td>
                <td className="px-2.5 py-3">
                  {resp && <div className="flex items-center gap-1.5 whitespace-nowrap"><Avatar name={resp.name} color={resp.avatarColor} size={20} decorative /><span className="text-xs text-ink-800">{resp.name.split(' ')[0]}</span></div>}
                </td>
                <td className="px-2.5 py-3">
                  {isClosedStatus(j.status)
                    ? <span className="text-xs text-ink-700 whitespace-nowrap">{fmtDate(j.committedDate)}</span>
                    : <CountdownBadge iso={j.committedDate} status={j.status} compact />}
                </td>
                {!compact && <td className="px-2.5 py-3 text-xs text-ink-700 whitespace-nowrap tabular">{fmtShort(j.lastActivityAt)}</td>}
                <td className="px-2 py-3 sticky right-0 bg-white group-hover:bg-ink-50 transition-colors">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button" onClick={() => navigate(`/trabajos/${j.id}`)}
                      aria-label={`Ver ficha de ${j.name}`}
                      className="w-7 h-7 inline-flex items-center justify-center text-ink-700 hover:text-brand-600 hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-ctl"
                    >
                      <ArrowRight size={15} />
                    </button>
                    {canDelete && (
                      <button
                        type="button" onClick={() => setConfirmDelete(j)}
                        aria-label={`Eliminar ${j.name}`}
                        className="w-7 h-7 inline-flex items-center justify-center text-crit-text hover:bg-crit-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-ctl"
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
      </div>
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
