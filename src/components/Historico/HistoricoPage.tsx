import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Trash2, RotateCcw, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobs, canDeleteJob } from '../../lib/permissions';
import { isArchivedJob, isDeletedJob, ARCHIVE_AFTER_DAYS } from '../../lib/selectors';
import { fmtDate } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { Avatar, PriorityBadge } from '../Common/Badges';
import { effectivePriority } from '../../lib/priority';

// Histórico — admin-only (canViewHistorico, ver App.tsx). No es "otro Dashboard":
// no tiene KPIs ni indicadores operativos, es puramente para buscar y consultar
// trabajos que ya no están en las vistas activas — archivados (Entregados hace
// ARCHIVE_AFTER_DAYS o más) o eliminados (borrado lógico, ver deleteJob en el
// store). Ninguno de los dos "desaparece" de verdad: siguen con archivos,
// comentarios e historial intactos, y un trabajo eliminado se puede restaurar
// desde acá.
export function HistoricoPage() {
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const jobTypes = useStore((s) => s.jobTypes);
  const restoreJob = useStore((s) => s.restoreJob);

  const [search, setSearch] = useState('');
  const [respFilter, setRespFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [restoring, setRestoring] = useState<string | null>(null);

  const entries = useMemo(() => {
    return visibleJobs(user, allJobs)
      .filter((j) => isArchivedJob(j) || isDeletedJob(j))
      .map((j) => ({ job: j, at: j.deletedAt ?? j.finishedAt ?? j.lastActivityAt }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [user, allJobs]);

  const filtered = useMemo(() => {
    return entries.filter(({ job: j }) => {
      if (respFilter !== 'all' && j.responsibleUserId !== respFilter) return false;
      if (typeFilter !== 'all' && j.jobTypeId !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const client = clients.find((c) => c.id === j.clientId);
        if (!((j.code ?? '').toLowerCase().includes(q) || j.name.toLowerCase().includes(q) || client?.name.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [entries, respFilter, typeFilter, search, clients]);

  async function handleRestore(jobId: string) {
    setRestoring(jobId);
    try {
      await restoreJob(jobId);
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setRestoring(null);
    }
  }

  const selectCls = 'text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 bg-white text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Histórico</h1>
      <p className="text-sm text-ink-700 mb-4">
        Trabajos archivados (Entregados hace {ARCHIVE_AFTER_DAYS} días o más) y eliminados — solo para buscar y consultar, no afecta lo operativo.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por N°, cliente o nombre..." aria-label="Buscar"
          className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 w-64 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select aria-label="Responsable" className={selectCls} value={respFilter} onChange={(e) => setRespFilter(e.target.value)}>
          <option value="all">Todo responsable</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select aria-label="Tipo de trabajo" className={selectCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">Todo tipo</option>
          {jobTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-700 self-center">{filtered.length} trabajo{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-700">Nada que mostrar con estos filtros.</div>
        ) : (
          <div className="divide-y divide-ink-50">
            {filtered.map(({ job: j, at }) => {
              const client = clients.find((c) => c.id === j.clientId);
              const resp = users.find((u) => u.id === j.responsibleUserId);
              const deletedByUser = j.deletedBy ? users.find((u) => u.id === j.deletedBy) : undefined;
              const deleted = isDeletedJob(j);
              return (
                <div key={j.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${deleted ? 'bg-crit-bg text-crit-text' : 'bg-ink-100 text-ink-700'}`}
                    title={deleted ? `Eliminado el ${fmtDate(at)}${deletedByUser ? ` por ${deletedByUser.name}` : ''}` : `Archivado — Entregado el ${fmtDate(j.finishedAt ?? at)}`}
                  >
                    {deleted ? <Trash2 size={12} aria-hidden /> : <Archive size={12} aria-hidden />}
                    {deleted ? 'Eliminado' : 'Archivado'}
                  </span>
                  <PriorityBadge priority={effectivePriority(j)} size="sm" />
                  <span className="font-mono text-xs text-ink-700 shrink-0">{j.code ?? 'Sin N°'}</span>
                  <span className="text-sm text-ink-700 shrink-0">{client?.name}</span>
                  <span className="text-sm font-medium text-ink-900 truncate max-w-[280px]">{j.name}</span>
                  {resp && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-700 shrink-0">
                      <Avatar name={resp.name} color={resp.avatarColor} size={18} />{resp.name.split(' ')[0]}
                    </span>
                  )}
                  <span className="text-xs text-ink-700 shrink-0">{fmtDate(at)}</span>
                  <div className="flex items-center gap-3 ml-auto shrink-0">
                    {deleted && canDeleteJob(user.role) && (
                      <button
                        type="button" disabled={restoring === j.id} onClick={() => handleRestore(j.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-40"
                      >
                        <RotateCcw size={13} /> {restoring === j.id ? 'Restaurando...' : 'Restaurar'}
                      </button>
                    )}
                    <Link to={`/trabajos/${j.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 hover:text-brand-600">
                      Ver ficha <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
