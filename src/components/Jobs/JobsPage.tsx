import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Search, Archive, Lock } from 'lucide-react';
import { btn, fieldCls, selectCls as baseSelectCls } from '../Common/ui';
import { useStore } from '../../store/useStore';
import { visibleJobs, canCreateJobs } from '../../lib/permissions';
import { effectivePriority, PRIORITY_META } from '../../lib/priority';
import { isArchivedJob, isBlocked } from '../../lib/selectors';
import { JobsTable } from './JobsTable';
import { STATUS_LABELS } from '../../data/catalog';
import type { JobStatus, Priority } from '../../types';

export function JobsPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [respFilter, setRespFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  // "Bloqueado" dejó de ser un valor de `status` (Fase 3, 17/09) — antes se
  // filtraba eligiendo "Bloqueado" en el select de Estado; este toggle cubre esa
  // pérdida sin resucitar el status falso.
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  // Eliminados (Fase 4) nunca aparecen en Trabajos — Histórico es el único lugar
  // para consultarlos/restaurarlos.
  const jobs = useMemo(() => visibleJobs(user, allJobs).filter((j) => !j.deletedAt), [user, allJobs]);
  const archivedCount = useMemo(() => jobs.filter(isArchivedJob).length, [jobs]);
  const blockedCount = useMemo(() => jobs.filter(isBlocked).length, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (!showArchived && isArchivedJob(j)) return false;
      if (onlyBlocked && !isBlocked(j)) return false;
      if (priorityFilter !== 'all' && effectivePriority(j) !== priorityFilter) return false;
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (clientFilter !== 'all' && j.clientId !== clientFilter) return false;
      if (respFilter !== 'all' && j.responsibleUserId !== respFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const client = clients.find((c) => c.id === j.clientId);
        if (!((j.code ?? '').toLowerCase().includes(q) || j.name.toLowerCase().includes(q) || client?.name.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [jobs, priorityFilter, statusFilter, clientFilter, respFilter, search, clients, showArchived, onlyBlocked]);

  const selectCls = clsx(baseSelectCls, 'min-w-0 sm:w-auto');
  // Filtros sí/no como chips (mismo lenguaje que el segmentado del Dashboard),
  // en vez de checkboxes nativos sueltos.
  const chipCls = (on: boolean) => clsx(
    'inline-flex items-center gap-1.5 h-ctl max-md:h-auto max-md:min-h-touch px-3 rounded-full border text-xs font-semibold cursor-pointer select-none transition-colors',
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
    on ? 'bg-ink-950 border-ink-950 text-white' : 'bg-white border-ink-300 text-ink-800 hover:border-ink-450'
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="text-xl font-display font-bold text-ink-900 tracking-tight">Trabajos</h1>
          <p className="text-sm text-ink-700 mt-0.5">{filtered.length} {filtered.length === 1 ? 'trabajo' : 'trabajos'}{showArchived ? ' · con archivados' : ''}</p>
        </div>
        {canCreateJobs(user.role) && (
          <button onClick={() => navigate('/trabajos/rapido')} className={btn('primary')}>
            <Plus size={16} aria-hidden /> Nuevo trabajo
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 sm:w-60">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar N°, cliente o trabajo" aria-label="Buscar"
            type="search" enterKeyHint="search" autoComplete="off"
            className={clsx(fieldCls, 'pl-9')}
          />
        </div>
        <select aria-label="Prioridad" className={selectCls} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
          <option value="all">Toda prioridad</option>
          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select aria-label="Estado" className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">Todo estado</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Cliente" className={selectCls} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="all">Todo cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Responsable" className={selectCls} value={respFilter} onChange={(e) => setRespFilter(e.target.value)}>
          <option value="all">Todo responsable</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label
          className={clsx(chipCls(showArchived), 'justify-center')}
          title="Entregados hace 5 días o más — se ocultan por default para no acumular"
        >
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="sr-only" />
          <Archive size={13} aria-hidden />
          Archivados{!showArchived && archivedCount > 0 ? ` (${archivedCount})` : ''}
        </label>
        {blockedCount > 0 && (
          <label className={clsx(chipCls(onlyBlocked), 'justify-center')}>
            <input type="checkbox" checked={onlyBlocked} onChange={(e) => setOnlyBlocked(e.target.checked)} className="sr-only" />
            <Lock size={13} aria-hidden />
            Solo bloqueados ({blockedCount})
          </label>
        )}
      </div>

      <div className="bg-white rounded-card border border-ink-200/80 shadow-card overflow-hidden">
        <JobsTable jobs={filtered} />
      </div>
    </div>
  );
}
