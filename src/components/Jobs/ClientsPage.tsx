import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { visibleJobs } from '../../lib/permissions';
import { JobsTable } from './JobsTable';

export function ClientsPage() {
  const clients = useStore((s) => s.clients);
  const user = useStore((s) => s.currentUser)!;
  const allJobs = useStore((s) => s.jobs);
  const jobs = visibleJobs(user, allJobs);
  const [openId, setOpenId] = useState<string | null>(clients[0]?.id ?? null);

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <h1 className="text-xl font-display font-bold text-ink-900 mb-5">Clientes</h1>
      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden h-fit">
          {clients.map((c) => {
            const total = jobs.filter((j) => j.clientId === c.id).length;
            const active = jobs.filter((j) => j.clientId === c.id && j.status !== 'TERMINADO' && j.status !== 'CANCELADO').length;
            return (
              <button key={c.id} onClick={() => setOpenId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-ink-50 last:border-0 hover:bg-ink-50 ${openId === c.id ? 'bg-ink-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-900">{c.name}</span>
                  {c.tier === 'prioritario' && <span className="text-xs">⭐</span>}
                </div>
                <div className="text-xs text-ink-700 mt-0.5">{active} activos · {total} totales</div>
              </button>
            );
          })}
        </div>

        {openId && (() => {
          const c = clients.find((cl) => cl.id === openId)!;
          const clientJobs = jobs.filter((j) => j.clientId === c.id);
          return (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-ink-100 shadow-card p-5">
                <h2 className="font-display font-bold text-ink-900 text-lg">{c.name}</h2>
                <p className="text-sm text-ink-700">{c.company}</p>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
                  <div><div className="text-[11px] uppercase text-ink-700 font-medium">Dirección</div><div className="text-ink-800">{c.address}</div></div>
                  {c.contacts.map((ct, i) => (
                    <div key={i}><div className="text-[11px] uppercase text-ink-700 font-medium">Contacto</div><div className="text-ink-800">{ct.name} · {ct.phone} · {ct.email}</div></div>
                  ))}
                </div>
                {c.notes && <p className="text-sm text-ink-700 mt-3 italic">{c.notes}</p>}
              </div>
              <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-100 text-sm font-semibold text-ink-800">Trabajos de {c.name}</div>
                <JobsTable jobs={clientJobs} compact />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
