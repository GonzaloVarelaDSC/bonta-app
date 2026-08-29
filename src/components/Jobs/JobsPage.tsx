import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobs, canCreateJobs } from '../../lib/permissions';
import { effectivePriority, PRIORITY_META } from '../../lib/priority';
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

  const jobs = useMemo(() => visibleJobs(user, allJobs), [user, allJobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
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
  }, [jobs, priorityFilter, statusFilter, clientFilter, respFilter, search, clients]);

  const selectCls = 'text-sm border border-ink-200 rounded-lg px-2.5 py-1.5 bg-white text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold text-ink-900">Trabajos</h1>
        {canCreateJobs(user.role) && (
          <button onClick={() => navigate('/trabajos/rapido')} className="inline-flex items-center gap-1.5 bg-ink-950 text-white text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-ink-800 transition-colors">
            <Plus size={16} /> Nuevo trabajo
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
          className="text-sm border border-ink-200 rounded-lg px-3 py-1.5 w-56 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select className={selectCls} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
          <option value="all">Toda prioridad</option>
          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
        <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">Todo estado</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={selectCls} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="all">Todo cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={selectCls} value={respFilter} onChange={(e) => setRespFilter(e.target.value)}>
          <option value="all">Todo responsable</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-700 self-center">{filtered.length} trabajo{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <JobsTable jobs={filtered} />
      </div>
    </div>
  );
}
