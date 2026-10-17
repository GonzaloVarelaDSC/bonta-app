import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Job } from '../../types';
import { useStore } from '../../store/useStore';
import { friendlyError } from '../../lib/errors';
import { ModalShell } from '../Common/Modal';

function normalizeClientName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

const inputCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';

/**
 * Corregir cliente y nombre de un trabajo ya creado (17/10). Mismo criterio que
 * Carga rápida: el cliente es texto libre con autocompletado, y si lo tipeado
 * coincide con uno existente salvo mayúsculas/tildes se sugiere usar ese, para
 * no ensuciar la lista con casi-duplicados.
 */
export function EditJobHeaderModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const user = useStore((s) => s.currentUser)!;
  const clients = useStore((s) => s.clients);
  const updateJobHeader = useStore((s) => s.updateJobHeader);
  const [name, setName] = useState(job.name);
  const [clientName, setClientName] = useState(clients.find((c) => c.id === job.clientId)?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const similar = useMemo(() => {
    const typed = clientName.trim();
    if (!typed) return null;
    return clients.find((c) => c.name !== typed && normalizeClientName(c.name) === normalizeClientName(typed)) ?? null;
  }, [clientName, clients]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateJobHeader(job.id, { name, clientName }, user.id);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell titleId="edit-job-header-title" onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 id="edit-job-header-title" className="font-display font-bold text-ink-900">Editar cliente y nombre</h3>
        <button onClick={onClose} aria-label="Cerrar" className="text-ink-700 hover:text-ink-900"><X size={18} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label htmlFor="ejh-client" className="block text-xs font-medium text-ink-700 mb-1.5">Cliente</label>
          <input id="ejh-client" list="ejh-clients" className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <datalist id="ejh-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          {similar && (
            <div className="mt-1.5 text-xs text-norm-text bg-norm-bg rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2">
              <span>¿Quisiste decir <strong>{similar.name}</strong>? Ya existe un cliente con ese nombre.</span>
              <button type="button" onClick={() => setClientName(similar.name)} className="font-semibold hover:underline shrink-0">Usar ese</button>
            </div>
          )}
        </div>
        <div>
          <label htmlFor="ejh-name" className="block text-xs font-medium text-ink-700 mb-1.5">Nombre del trabajo</label>
          <input id="ejh-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-xs text-crit-text">{error}</p>}
      </div>
      <div className="flex gap-2 justify-end mt-5">
        <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-50">Cancelar</button>
        <button onClick={save} disabled={saving || !name.trim() || !clientName.trim()}
          className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-brand-500 hover:brightness-95 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </ModalShell>
  );
}
