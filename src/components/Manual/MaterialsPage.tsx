import { useState } from 'react';
import clsx from 'clsx';
import { CircleAlert, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { canEditKnowledge } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import { fmtShort } from '../../lib/dates';
import { visibleJobTypes } from '../../data/catalog';
import {
  machineSpec, newId, withCm,
  type DataStatus, type KnowledgeMachine, type KnowledgeMaterial, type KnowledgeRule, type MaterialsKnowledge,
} from '../../data/materialsKnowledge';

// Base de materiales y máquinas. Se consulta y, desde el 06/11, se edita acá
// (admin/coordinador). Separa siempre lo confirmado, lo aproximado y lo que
// falta confirmar — nada se muestra como seguro si no lo está. Las medidas que
// se cargan acá son las que usan los avisos al cargar productos.
const STATUS: Record<DataStatus, { label: string; cls: string }> = {
  confirmado: { label: 'Confirmado', cls: 'bg-plan-bg text-plan-text border-plan/30' },
  aproximado: { label: 'Aproximado', cls: 'bg-norm-bg text-norm-text border-norm/30' },
  pendiente: { label: 'A confirmar', cls: 'bg-wait-bg text-wait-text border-wait/30' },
};

function Status({ s }: { s: DataStatus }) {
  return <span className={clsx('inline-block text-[11px] font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap', STATUS[s].cls)}>{STATUS[s].label}</span>;
}

const dash = (v: string) => v ? withCm(v) : <span className="text-ink-700">—</span>;
const th = 'px-3 py-2 text-left text-[11px] uppercase tracking-wide text-ink-700 font-medium';
const td = 'px-3 py-2.5 align-top';
const input = 'w-full border border-ink-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';
const lbl = 'block text-[11px] font-medium text-ink-700 mb-0.5';

export function MaterialsPage() {
  const user = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const knowledge = useStore((s) => s.knowledge);
  const meta = useStore((s) => s.knowledgeMeta);
  const saveKnowledge = useStore((s) => s.saveKnowledge);
  const jobTypes = visibleJobTypes(useStore((s) => s.jobTypes));
  const [draft, setDraft] = useState<MaterialsKnowledge | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit = !!user && canEditKnowledge(user.role);
  const editing = draft !== null;
  const k = draft ?? knowledge;
  const editor = meta?.updatedBy ? users.find((u) => u.id === meta.updatedBy)?.name : null;

  function patch<K extends keyof MaterialsKnowledge>(key: K, value: MaterialsKnowledge[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  async function save() {
    if (!draft) return;
    setSaving(true); setError('');
    try {
      const clean: MaterialsKnowledge = {
        materials: draft.materials.filter((m) => m.material.trim()),
        machines: draft.machines.filter((m) => m.name.trim()),
        rules: draft.rules.filter((r) => r.title.trim()).map((r) => ({ ...r, points: r.points.map((p) => p.trim()).filter(Boolean) })),
        pending: draft.pending.map((p) => p.trim()).filter(Boolean),
      };
      await saveKnowledge(clean);
      setDraft(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-2xl font-display font-bold text-ink-900 mb-1">Materiales y máquinas</h1>
          <p className="text-base text-ink-700">
            Formatos de placa, medidas máximas de las máquinas y reglas de producción. Lo marcado «A confirmar» todavía no está verificado.
            {' '}Con estas medidas la app avisa al cargar un producto si una pieza no entra.
          </p>
          {meta && !editing && (
            <p className="text-xs text-ink-700 mt-1">Última modificación: {fmtShort(meta.updatedAt)}{editor ? ` · ${editor}` : ''}</p>
          )}
        </div>
        {canEdit && !editing && (
          <button type="button" onClick={() => { setDraft(structuredClone(knowledge)); setError(''); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ink-900 text-white rounded-lg px-3.5 py-2 hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Pencil size={14} aria-hidden /> Editar medidas
          </button>
        )}
      </div>

      {/* ---------- Materiales ---------- */}
      <section className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-ink-900 border-b border-ink-100">Materiales y formatos</h2>
        {editing ? (
          <div className="divide-y divide-ink-100">
            {k.materials.map((m, i) => (
              <MaterialEditor key={m.id} m={m}
                onChange={(next) => patch('materials', k.materials.map((x, j) => (j === i ? next : x)))}
                onRemove={() => patch('materials', k.materials.filter((_, j) => j !== i))} />
            ))}
            <AddButton label="Agregar material o formato"
              onClick={() => patch('materials', [...k.materials, { id: newId(), material: '', thickness: '', length: '', width: '', status: 'pendiente' }])} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60"><tr><th className={th}>Material</th><th className={th}>Espesor</th><th className={th}>Largo de placa</th><th className={th}>Ancho</th><th className={th}>Estado</th></tr></thead>
              <tbody className="divide-y divide-ink-50">
                {k.materials.map((m) => (
                  <tr key={m.id}>
                    <td className={clsx(td, 'font-semibold text-ink-900')}>{m.material}</td>
                    <td className={td}>{m.thickness || <span className="text-ink-700">—</span>}</td>
                    <td className={td}>{m.length ? dash(m.length) : (m.width ? <span className="text-ink-700">Rollo</span> : dash(''))}</td>
                    <td className={td}>
                      {dash(m.width)}
                      {m.note && <div className="text-xs text-ink-700 mt-0.5">{m.note}</div>}
                      {m.hint && <div className="text-xs text-info-text mt-0.5">Aviso al cargar: {m.hint}</div>}
                    </td>
                    <td className={td}><Status s={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Máquinas ---------- */}
      <section className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-ink-900 border-b border-ink-100">Máquinas</h2>
        {editing ? (
          <div className="divide-y divide-ink-100">
            {k.machines.map((m, i) => (
              <MachineEditor key={m.id} m={m} jobTypes={jobTypes}
                onChange={(next) => patch('machines', k.machines.map((x, j) => (j === i ? next : x)))}
                onRemove={() => patch('machines', k.machines.filter((_, j) => j !== i))} />
            ))}
            <AddButton label="Agregar máquina"
              onClick={() => patch('machines', [...k.machines, { id: newId(), name: '', maxLength: '', maxWidth: '', status: 'pendiente', jobTypeIds: [] }])} />
          </div>
        ) : (
          <ul className="divide-y divide-ink-50">
            {k.machines.map((m) => (
              <li key={m.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink-900">{m.name}</div>
                  <div className="text-sm text-ink-800">{machineSpec(m)}</div>
                  {m.note && <div className="text-xs text-ink-700 mt-0.5">{m.note}</div>}
                  <AppliesTo m={m} jobTypes={jobTypes} />
                </div>
                <Status s={m.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Reglas ---------- */}
      <section className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-ink-900 border-b border-ink-100">Reglas de producción</h2>
        {editing ? (
          <div className="divide-y divide-ink-100">
            {k.rules.map((r, i) => (
              <RuleEditor key={r.id} r={r}
                onChange={(next) => patch('rules', k.rules.map((x, j) => (j === i ? next : x)))}
                onRemove={() => patch('rules', k.rules.filter((_, j) => j !== i))} />
            ))}
            <AddButton label="Agregar regla"
              onClick={() => patch('rules', [...k.rules, { id: newId(), title: '', points: [], status: 'pendiente' }])} />
          </div>
        ) : (
          <ul className="divide-y divide-ink-50">
            {k.rules.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink-900 flex-1">{r.title}</span>
                  <Status s={r.status} />
                </div>
                <ul className="list-disc pl-5 text-sm text-ink-800 space-y-0.5">
                  {r.points.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Pendientes ---------- */}
      <section className="bg-wait-bg/60 rounded-xl border border-wait/30 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-1.5"><CircleAlert size={15} aria-hidden /> Datos que faltan completar o verificar</h2>
        {editing ? (
          <>
            <textarea aria-label="Datos que faltan, uno por renglón" rows={Math.max(4, k.pending.length + 1)}
              value={k.pending.join('\n')} onChange={(e) => patch('pending', e.target.value.split('\n'))}
              className={clsx(input, 'resize-y')} />
            <p className="text-xs text-ink-700 mt-1">Uno por renglón. Borrá el renglón cuando ya esté confirmado.</p>
          </>
        ) : k.pending.length ? (
          <ul className="list-disc pl-5 text-sm text-ink-800 space-y-0.5">
            {k.pending.map((p, j) => <li key={j}>{p}</li>)}
          </ul>
        ) : <p className="text-sm text-ink-800">No hay datos pendientes.</p>}
      </section>

      {editing && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t border-ink-100 px-4 py-3 z-20"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap">
            <p className={clsx('flex-1 min-w-[200px] text-sm', error ? 'text-crit-text' : 'text-ink-700')}>
              {error || 'Medidas en cm. Si un dato no está verificado, dejalo como «Aproximado» o «A confirmar».'}
            </p>
            <button type="button" onClick={() => { setDraft(null); setError(''); }} disabled={saving}
              className="text-sm font-semibold border border-ink-200 rounded-lg px-4 py-2.5 text-ink-900 hover:bg-ink-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={saving}
              className="text-sm font-semibold bg-ink-900 text-white rounded-lg px-4 py-2.5 hover:bg-ink-800 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={onClick}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 border border-dashed border-brand-300 rounded-lg px-3 py-2 hover:bg-brand-100">
        <Plus size={14} aria-hidden /> {label}
      </button>
    </div>
  );
}

function RemoveButton({ what, onClick }: { what: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Quitar ${what}`} title={`Quitar ${what}`}
      className="p-2 rounded-lg text-crit hover:bg-crit-bg shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <Trash2 size={16} aria-hidden />
    </button>
  );
}

function StatusSelectField({ value, onChange }: { value: DataStatus; onChange: (s: DataStatus) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as DataStatus)} className={input}>
      <option value="confirmado">Confirmado</option>
      <option value="aproximado">Aproximado</option>
      <option value="pendiente">A confirmar</option>
    </select>
  );
}

function MaterialEditor({ m, onChange, onRemove }: { m: KnowledgeMaterial; onChange: (m: KnowledgeMaterial) => void; onRemove: () => void }) {
  const set = (p: Partial<KnowledgeMaterial>) => onChange({ ...m, ...p });
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1">
          <label className="col-span-2 sm:col-span-1"><span className={lbl}>Material</span>
            <input value={m.material} onChange={(e) => set({ material: e.target.value })} className={input} placeholder="Ej: MDF" /></label>
          <label><span className={lbl}>Espesor</span>
            <input value={m.thickness} onChange={(e) => set({ thickness: e.target.value })} className={input} placeholder="Ej: 5 mm" /></label>
          <label><span className={lbl}>Largo (cm)</span>
            <input value={m.length} onChange={(e) => set({ length: e.target.value })} className={input} placeholder="Vacío si es rollo" inputMode="decimal" /></label>
          <label><span className={lbl}>Ancho (cm)</span>
            <input value={m.width} onChange={(e) => set({ width: e.target.value })} className={input} placeholder="Ej: 122" /></label>
          <label><span className={lbl}>Estado</span>
            <StatusSelectField value={m.status} onChange={(status) => set({ status })} /></label>
        </div>
        <RemoveButton what={m.material || 'este material'} onClick={onRemove} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label><span className={lbl}>Nota (se ve en esta pantalla)</span>
          <input value={m.note ?? ''} onChange={(e) => set({ note: e.target.value })} className={input} /></label>
        <label><span className={lbl}>Aviso al cargar un producto con este material</span>
          <input value={m.hint ?? ''} onChange={(e) => set({ hint: e.target.value })} className={input} placeholder="Opcional" /></label>
      </div>
      <p className="text-[11px] text-ink-700">Si es rollo, dejá el largo vacío y poné en Ancho los anchos separados por coma (ej: 60, 100, 150).</p>
    </div>
  );
}

function MachineEditor({ m, jobTypes, onChange, onRemove }: {
  m: KnowledgeMachine; jobTypes: { id: string; label: string }[];
  onChange: (m: KnowledgeMachine) => void; onRemove: () => void;
}) {
  const set = (p: Partial<KnowledgeMachine>) => onChange({ ...m, ...p });
  const toggleType = (id: string) => set({ jobTypeIds: m.jobTypeIds.includes(id) ? m.jobTypeIds.filter((x) => x !== id) : [...m.jobTypeIds, id] });
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
          <label className="col-span-2 sm:col-span-1"><span className={lbl}>Máquina</span>
            <input value={m.name} onChange={(e) => set({ name: e.target.value })} className={input} /></label>
          <label><span className={lbl}>Largo máx. (cm)</span>
            <input value={m.maxLength} onChange={(e) => set({ maxLength: e.target.value })} className={input} placeholder="Vacío si es rollo" inputMode="decimal" /></label>
          <label><span className={lbl}>Ancho máx. (cm)</span>
            <input value={m.maxWidth} onChange={(e) => set({ maxWidth: e.target.value })} className={input} inputMode="decimal" /></label>
          <label><span className={lbl}>Estado</span>
            <StatusSelectField value={m.status} onChange={(status) => set({ status })} /></label>
        </div>
        <RemoveButton what={m.name || 'esta máquina'} onClick={onRemove} />
      </div>
      <label className="block"><span className={lbl}>Nota</span>
        <input value={m.note ?? ''} onChange={(e) => set({ note: e.target.value })} className={input} /></label>
      <div className="rounded-lg bg-ink-50/70 px-3 py-2.5 space-y-2">
        <p className="text-xs font-semibold text-ink-900">¿Cuándo avisar que una pieza no entra?</p>
        <div>
          <span className={lbl}>Cuando el trabajo es de tipo:</span>
          <div className="flex flex-wrap gap-1.5">
            {jobTypes.map((t) => {
              const on = m.jobTypeIds.includes(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggleType(t.id)} aria-pressed={on}
                  className={clsx('text-xs rounded-full border px-2.5 py-1', on ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-800 border-ink-200 hover:border-ink-400')}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label><span className={lbl}>O cuando el material contiene</span>
            <input value={m.materialWord ?? ''} onChange={(e) => set({ materialWord: e.target.value })} className={input} placeholder="Ej: vinilo" /></label>
          <label><span className={lbl}>…y el nombre del producto contiene (opcional)</span>
            <input value={m.productWord ?? ''} onChange={(e) => set({ productWord: e.target.value })} className={input} placeholder="Ej: corte" /></label>
        </div>
      </div>
    </div>
  );
}

function AppliesTo({ m, jobTypes }: { m: KnowledgeMachine; jobTypes: { id: string; label: string }[] }) {
  const types = m.jobTypeIds.map((id) => jobTypes.find((t) => t.id === id)?.label).filter(Boolean);
  const parts: string[] = [];
  if (types.length) parts.push(`trabajos de tipo ${types.join(', ')}`);
  if (m.materialWord?.trim()) parts.push(`productos con material «${m.materialWord.trim()}»${m.productWord?.trim() ? ` y «${m.productWord.trim()}» en el nombre` : ''}`);
  if (!parts.length) return null;
  return <div className="text-xs text-ink-700 mt-0.5">Avisa en: {parts.join(' · ')}</div>;
}

function RuleEditor({ r, onChange, onRemove }: { r: KnowledgeRule; onChange: (r: KnowledgeRule) => void; onRemove: () => void }) {
  const set = (p: Partial<KnowledgeRule>) => onChange({ ...r, ...p });
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 flex-1">
          <label><span className={lbl}>Regla</span>
            <input value={r.title} onChange={(e) => set({ title: e.target.value })} className={input} /></label>
          <label><span className={lbl}>Estado</span>
            <StatusSelectField value={r.status} onChange={(status) => set({ status })} /></label>
        </div>
        <RemoveButton what={r.title || 'esta regla'} onClick={onRemove} />
      </div>
      <label className="block"><span className={lbl}>Puntos (uno por renglón)</span>
        <textarea rows={Math.max(2, r.points.length + 1)} value={r.points.join('\n')}
          onChange={(e) => set({ points: e.target.value.split('\n') })} className={clsx(input, 'resize-y')} /></label>
    </div>
  );
}
