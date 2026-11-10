import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ModalShell } from '../Common/Modal';
import { btn, fieldCls, labelCls, selectCls } from '../Common/ui';
import { INSTALLER_NAMES } from '../../data/catalog';
import { startOfWeek } from 'date-fns';
import { addDaysKey, fmtDay, fmtPeriod, fmtTime, overlaps, parseDay, toDayKey, todayKey, WEEK_OPTS, type ScheduledInstallation } from '../../lib/installations';
import type { Job } from '../../types';

function DialogHeader({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 id={id} className="font-display font-bold text-ink-900">{title}</h3>
      <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} aria-hidden /></button>
    </div>
  );
}

/** Elegir la OT a la que se le programa una instalación. No crea OT nuevas. */
export function PickJobDialog({ date, onPick, onClose }: { date: string | null; onPick: (job: Job) => void; onClose: () => void }) {
  const jobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const [q, setQ] = useState('');
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '';

  const candidates = useMemo(() => {
    const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? '';
    const needle = q.trim().toLowerCase();
    return jobs
      .filter((j) => !j.deletedAt && j.status !== 'CANCELADO' && j.status !== 'TERMINADO' && !j.installation?.date)
      .filter((j) => !needle || `${j.code ?? ''} ${nameOf(j.clientId)} ${j.name}`.toLowerCase().includes(needle))
      // Primero las que ya piden instalación.
      .sort((a, b) => Number(b.requiresInstallation) - Number(a.requiresInstallation) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40);
  }, [jobs, clients, q]);

  return (
    <ModalShell titleId="pick-job-title" onClose={onClose}>
      <DialogHeader id="pick-job-title" title={date ? `Nueva instalación · ${fmtDay(date, true)}` : 'Nueva instalación'} onClose={onClose} />
      <p className="text-sm text-ink-700 mb-3">Elegí la OT. Si el trabajo todavía no tiene ficha, primero cargala en Carga rápida.</p>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700" aria-hidden />
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por N°, cliente o trabajo"
          aria-label="Buscar OT" className={clsx(fieldCls, 'pl-9')}
        />
      </div>
      <ul className="max-h-[50vh] overflow-y-auto -mx-1 divide-y divide-ink-100">
        {candidates.length === 0 && <li className="px-1 py-6 text-sm text-ink-700 text-center">No hay OT sin instalación programada que coincidan.</li>}
        {candidates.map((j) => (
          <li key={j.id}>
            <button
              onClick={() => onPick(j)}
              className="w-full text-left px-2 py-2.5 rounded-ctl hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="text-sm text-ink-900"><span className="font-semibold tabular-nums">{j.code ?? 'Sin N°'}</span> · {clientName(j.clientId)}</div>
              <div className="text-xs text-ink-700 truncate">{j.name}{j.requiresInstallation ? ' · lleva instalación' : ''}</div>
            </button>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}

/**
 * Exportar órdenes de instalación: una semana (filtrada por quién instala, para
 * no mandarle a alguien instalaciones que no son suyas) o una selección a mano.
 */
export function ExportDialog({ items, onExport, onClose }: {
  items: ScheduledInstallation[];
  onExport: (jobIds: string[]) => void;
  onClose: () => void;
}) {
  const clients = useStore((s) => s.clients);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '';
  const [mode, setMode] = useState<'week' | 'pick'>('week');
  const [weekDay, setWeekDay] = useState(todayKey());
  const [installer, setInstaller] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const weekStart = toDayKey(startOfWeek(parseDay(weekDay), WEEK_OPTS));
  const weekEnd = addDaysKey(weekStart, 6);
  const weekItems = items.filter((it) => overlaps(it, weekStart, weekEnd) && (!installer || it.inst.installerNames.includes(installer)));
  const pickable = items.filter((it) => it.end >= addDaysKey(todayKey(), -7));
  const ids = mode === 'week' ? weekItems.map((it) => it.job.id) : pickable.filter((it) => picked.has(it.job.id)).map((it) => it.job.id);

  return (
    <ModalShell titleId="export-inst-title" onClose={onClose}>
      <DialogHeader id="export-inst-title" title="Exportar órdenes de instalación" onClose={onClose} />
      <div className="inline-flex rounded-ctl border border-ink-300 overflow-hidden mb-4" role="group" aria-label="Qué exportar">
        {([['week', 'Una semana'], ['pick', 'Elegir']] as const).map(([v, l]) => (
          <button
            key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}
            className={clsx('h-ctl max-md:min-h-touch px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
              mode === v ? 'bg-ink-900 text-white' : 'bg-white text-ink-800 hover:bg-ink-50')}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === 'week' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-week" className={labelCls}>Semana del día</label>
              <input id="exp-week" type="date" className={fieldCls} value={weekDay} onChange={(e) => e.target.value && setWeekDay(e.target.value)} />
            </div>
            <div>
              <label htmlFor="exp-installer" className={labelCls}>Quién instala</label>
              <select id="exp-installer" className={selectCls} value={installer} onChange={(e) => setInstaller(e.target.value)}>
                <option value="">Todos</option>
                {INSTALLER_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <p className="text-sm text-ink-800">
            Lunes {fmtDay(weekStart)} a domingo {fmtDay(weekEnd)}: <strong>{weekItems.length}</strong> {weekItems.length === 1 ? 'instalación' : 'instalaciones'}{installer ? ` de ${installer}` : ''}.
          </p>
          {!installer && weekItems.length > 0 && (
            <p className="text-2xs text-ink-700">Si la mandás a una sola persona, elegí quién instala: así no le llegan las de otros.</p>
          )}
        </div>
      ) : (
        <ul className="max-h-[45vh] overflow-y-auto -mx-1 divide-y divide-ink-100">
          {pickable.length === 0 && <li className="px-1 py-6 text-sm text-ink-700 text-center">No hay instalaciones programadas.</li>}
          {pickable.map((it) => (
            <li key={it.job.id}>
              <label className="flex items-start gap-3 px-2 py-2.5 rounded-ctl hover:bg-ink-50 cursor-pointer">
                <input
                  type="checkbox" className="mt-1 accent-brand-600" checked={picked.has(it.job.id)}
                  onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(it.job.id)) n.delete(it.job.id); else n.add(it.job.id); return n; })}
                />
                <span className="min-w-0">
                  <span className="block text-sm text-ink-900"><span className="font-semibold tabular-nums">{it.job.code ?? 'Sin N°'}</span> · {clientName(it.job.clientId)}</span>
                  <span className="block text-xs text-ink-700">{fmtPeriod(it.start, it.end)} · {fmtTime(it.inst.time)}{it.inst.installerNames.length ? ` · ${it.inst.installerNames.join(', ')}` : ''}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 justify-end mt-5">
        <button onClick={onClose} className={btn('ghost')}>Cancelar</button>
        <button onClick={() => onExport(ids)} disabled={ids.length === 0} className={btn('primary')}>
          Ver orden{ids.length > 1 ? 'es' : ''} ({ids.length})
        </button>
      </div>
    </ModalShell>
  );
}
