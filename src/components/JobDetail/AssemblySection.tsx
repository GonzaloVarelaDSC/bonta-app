import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Boxes, Plus, Trash2, Minus, Check, AlertTriangle } from 'lucide-react';
import type { Assembly, Job } from '../../types';
import { useStore } from '../../store/useStore';
import { PRODUCTION_PROCESSES } from '../../data/catalog';
import { assemblyStatus, quantityMismatches, type Piece } from '../../lib/assembly';
import { friendlyError } from '../../lib/errors';

const inputCls = 'border border-ink-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';

// Composición y armado (19/10, §75), dentro de la pestaña Producción.
// Dos momentos separados a propósito:
// 1) Composición (qué piezas lleva UNA unidad): se edita en el borrador de la
//    pestaña y se guarda con "Guardar cambios", como el resto.
// 2) Avance de armado (piezas hechas por tipo + unidades armadas): lo carga quien
//    arma, sobre la composición YA guardada, con su propio "Guardar avance". Se
//    cuenta por tipo de pieza, no pieza por pieza: el corte puede ser por lotes.
export function AssemblySection({ job, pieces, assemblies, onChange }: {
  job: Job; pieces: Piece[]; assemblies: Assembly[]; onChange: (next: Assembly[]) => void;
}) {
  const saved = job.productionConfig.assemblies ?? [];
  const mismatches = quantityMismatches(assemblies, pieces);

  function update(id: string, patch: Partial<Assembly>) { onChange(assemblies.map((a) => (a.id === id ? { ...a, ...patch } : a))); }
  function add() {
    onChange([...assemblies, { id: crypto.randomUUID(), label: '', units: 1, components: [], assembled: 0 }]);
  }

  return (
    <section className="bg-white border border-ink-100 rounded-lg" aria-labelledby="assembly-title">
      <header className="px-3 py-2.5 border-b border-ink-100 bg-ink-50/50 flex items-start gap-2">
        <Boxes size={16} className="text-ink-700 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h3 id="assembly-title" className="text-sm font-semibold text-ink-900">Composición y armado</h3>
          <p className="text-xs text-ink-700">
            Para productos hechos de varias piezas: qué piezas lleva <b>una unidad</b> y cuántas unidades pide la OT. El corte se puede hacer por lotes;
            acá se cuenta cuántas piezas de cada tipo hay y cuántas unidades se armaron. Las letras (A, B, C…) son las mismas de la planilla.
          </p>
        </div>
      </header>

      <div className="p-3 space-y-3">
        {assemblies.length === 0 && (
          <p className="text-sm text-ink-700 italic">Todavía no se definió cómo se arma ningún producto de esta OT.</p>
        )}
        {mismatches.length > 0 && (
          <div className="text-xs rounded-md bg-norm-bg text-norm-text border border-norm/30 px-2.5 py-2">
            <div className="font-semibold flex items-center gap-1"><AlertTriangle size={13} aria-hidden /> La cantidad cargada en la OT no coincide con la composición</div>
            <ul className="mt-1 space-y-0.5">
              {mismatches.map((m) => <li key={m.piece.key}><b>{m.piece.ref}</b> · {m.piece.label} {m.piece.size}: en la OT dice {m.loaded}, la composición necesita {m.required}. Revisá cuál está bien (no se corrige solo).</li>)}
            </ul>
          </div>
        )}

        {assemblies.map((a) => (
          <AssemblyCard key={a.id} job={job} a={a} pieces={pieces} saved={saved.find((s) => s.id === a.id) ?? null}
            onPatch={(p) => update(a.id, p)} onRemove={() => onChange(assemblies.filter((x) => x.id !== a.id))} />
        ))}

        <button type="button" onClick={add}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-lg px-3 py-2 hover:bg-brand-50">
          <Plus size={15} aria-hidden /> Agregar producto terminado
        </button>
      </div>
    </section>
  );
}

const compositionOf = (a: Assembly) => JSON.stringify({ l: a.label.trim(), u: a.units, c: a.components.map((c) => [c.pieceKey, c.perUnit]) });

function AssemblyCard({ job, a, pieces, saved, onPatch, onRemove }: {
  job: Job; a: Assembly; pieces: Piece[]; saved: Assembly | null; onPatch: (p: Partial<Assembly>) => void; onRemove: () => void;
}) {
  const unsaved = !saved || compositionOf(saved) !== compositionOf(a);
  const unusedPieces = pieces.filter((p) => !a.components.some((c) => c.pieceKey === p.key));
  const draftStatus = assemblyStatus(a, pieces);

  return (
    <div className="border border-ink-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-ink-50 border-b border-ink-100">
        <input value={a.label} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Producto terminado (ej. Corpóreo de polifan)"
          aria-label="Nombre del producto terminado" list={`asm-labels-${a.id}`}
          className="flex-1 min-w-[200px] bg-white border border-ink-200 rounded-md px-2 py-1.5 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <datalist id={`asm-labels-${a.id}`}>{job.products.map((p) => <option key={p.id} value={p.label} />)}</datalist>
        <label className="text-xs text-ink-700 inline-flex items-center gap-1.5">Unidades que pide la OT
          <input type="number" min={1} value={a.units || ''} onChange={(e) => onPatch({ units: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            className={clsx(inputCls, 'w-20 font-semibold')} />
        </label>
        <button type="button" onClick={onRemove} aria-label="Quitar este producto terminado" className="text-ink-700 hover:text-crit-text p-1"><Trash2 size={15} aria-hidden /></button>
      </div>

      <div className="p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-700">Piezas de 1 unidad</div>
        {a.components.length === 0 && <p className="text-xs text-ink-700">Agregá las piezas que lleva una unidad.</p>}
        {a.components.map((c, i) => {
          const st = draftStatus.components[i];
          return (
            <div key={c.pieceKey + i} className="flex flex-wrap items-center gap-2 text-sm">
              <select value={c.pieceKey} aria-label={`Pieza ${i + 1}`}
                onChange={(e) => onPatch({ components: a.components.map((x, j) => (j === i ? { ...x, pieceKey: e.target.value, ready: 0 } : x)) })}
                className={clsx(inputCls, 'flex-1 min-w-[220px]', !st.piece && 'border-crit text-crit-text')}>
                {!st.piece && <option value={c.pieceKey}>— pieza que ya no está en la OT —</option>}
                {[...(st.piece ? [st.piece] : []), ...unusedPieces].map((p) => <option key={p.key} value={p.key}>{pieceOption(p)}</option>)}
              </select>
              <label className="text-xs text-ink-700 inline-flex items-center gap-1">por unidad
                <input type="number" min={1} value={c.perUnit || ''} aria-label={`Cantidad por unidad de la pieza ${i + 1}`}
                  onChange={(e) => onPatch({ components: a.components.map((x, j) => (j === i ? { ...x, perUnit: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)) })}
                  className={clsx(inputCls, 'w-16')} />
              </label>
              <span className="text-xs text-ink-800 tabular-nums min-w-[86px]">= <b>{st.total}</b> en total</span>
              <button type="button" aria-label={`Quitar pieza ${i + 1}`} onClick={() => onPatch({ components: a.components.filter((_, j) => j !== i) })}
                className="text-ink-700 hover:text-crit-text p-1"><Trash2 size={14} aria-hidden /></button>
            </div>
          );
        })}
        {unusedPieces.length > 0 ? (
          <button type="button" onClick={() => onPatch({ components: [...a.components, { pieceKey: unusedPieces[0].key, perUnit: 1, ready: 0 }] })}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Plus size={13} aria-hidden /> Agregar pieza</button>
        ) : pieces.length === 0 ? (
          <p className="text-xs text-ink-700">La OT no tiene piezas cargadas. Cargalas en Detalle o como "componente para producción" arriba.</p>
        ) : null}

        {unsaved ? (
          <p className="text-xs text-ink-700 bg-ink-50 rounded-md px-2.5 py-2 mt-2">Guardá los cambios (botón arriba) para empezar a registrar el armado de este producto.</p>
        ) : (
          <ProgressBlock job={job} a={saved!} pieces={pieces} />
        )}
      </div>
    </div>
  );
}

function pieceOption(p: Piece): string {
  return [`${p.ref} · ${p.label}`, p.size, p.material, p.loadedQty ? `(OT: ${p.loadedQty})` : ''].filter(Boolean).join(' — ');
}

// Avance: contadores locales hasta "Guardar avance". "Armadas" nunca puede pasar
// de lo que alcanzan las piezas contadas, ni de las unidades pedidas.
function ProgressBlock({ job, a, pieces }: { job: Job; a: Assembly; pieces: Piece[] }) {
  const user = useStore((s) => s.currentUser)!;
  const saveAssemblyProgress = useStore((s) => s.saveAssemblyProgress);
  const savedKey = JSON.stringify([a.assembled, a.components.map((c) => c.ready)]);
  const [local, setLocal] = useState({ key: savedKey, assembled: a.assembled, ready: Object.fromEntries(a.components.map((c) => [c.pieceKey, c.ready])) as Record<string, number> });
  const cur = local.key === savedKey ? local : { key: savedKey, assembled: a.assembled, ready: Object.fromEntries(a.components.map((c) => [c.pieceKey, c.ready])) };
  const [saving, setSaving] = useState(false);

  const view: Assembly = { ...a, assembled: cur.assembled, components: a.components.map((c) => ({ ...c, ready: cur.ready[c.pieceKey] ?? 0 })) };
  const st = useMemo(() => assemblyStatus(view, pieces), [view, pieces]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = cur.assembled !== a.assembled || a.components.some((c) => (cur.ready[c.pieceKey] ?? 0) !== c.ready);
  const units = a.units;

  function setReady(key: string, v: number) { setLocal({ ...cur, ready: { ...cur.ready, [key]: Math.max(0, v) } }); }
  function setAssembled(v: number) { setLocal({ ...cur, assembled: Math.max(0, Math.min(v, st.buildable)) }); }

  async function save() {
    setSaving(true);
    try {
      const parts = st.components.map((c) => `${c.piece?.ref ?? '?'} ${c.ready}/${c.total}`).join(', ');
      await saveAssemblyProgress(job.id, a.id, { assembled: st.assembled, ready: cur.ready }, user.id,
        `Armado de "${a.label || 'producto'}": ${st.assembled} de ${units} unidades armadas · piezas hechas ${parts}.`);
    } catch (e) { alert(friendlyError(e)); } finally { setSaving(false); }
  }

  if (st.invalidReason) {
    return <p className="text-xs rounded-md bg-crit-bg text-crit-text px-2.5 py-2 mt-2">{st.invalidReason} No se puede registrar el armado hasta corregirlo.</p>;
  }

  const pct = units ? (st.assembled / units) * 100 : 0;
  return (
    <div className="mt-3 border-t border-ink-100 pt-3 space-y-3">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-700">Armado</div>
      <div className="overflow-x-auto -mx-3">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-[11px] text-ink-700 text-left">
              <th className="px-3 py-1 font-semibold">Pieza</th>
              <th className="px-2 py-1 font-semibold">Por unidad</th>
              <th className="px-2 py-1 font-semibold">Total OT</th>
              <th className="px-2 py-1 font-semibold">Hechas</th>
              <th className="px-3 py-1 font-semibold">Faltan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {st.components.map((c) => {
              const p = c.piece!;
              return (
                <tr key={c.pieceKey}>
                  <td className="px-3 py-1.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded bg-ink-900 text-white text-xs font-bold">{p.ref}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900">{p.label}{p.size && <span className="font-normal text-ink-700"> · {p.size}</span>}</div>
                        <div className="text-[11px] text-ink-700">
                          {[p.material, p.processes.map((id) => PRODUCTION_PROCESSES.find((x) => x.id === id)?.short).filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Sin material ni procesos cargados'}
                          {p.processedInOt && <span className="ml-1 text-plan-text">· marcado procesado en Detalle</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{c.perUnit}</td>
                  <td className="px-2 py-1.5 tabular-nums font-semibold">{c.total}</td>
                  <td className="px-2 py-1.5">
                    <Stepper value={c.ready} onChange={(v) => setReady(c.pieceKey, v)} label={`Piezas ${p.ref} hechas`} />
                  </td>
                  <td className={clsx('px-3 py-1.5 tabular-nums font-semibold', c.missing ? 'text-crit-text' : 'text-plan-text')}>
                    {c.missing ? c.missing : <span className="inline-flex items-center gap-1"><Check size={13} aria-hidden /> completo</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-ink-50 px-3 py-2">
        <div className="text-sm text-ink-800">Con lo hecho alcanza para <b>{st.buildable} de {units}</b> unidades.</div>
        <div className="inline-flex items-center gap-2 text-sm text-ink-800">Armadas:
          <Stepper value={st.assembled} max={st.buildable} onChange={setAssembled} label="Unidades armadas" />
          <span>de {units}</span>
        </div>
        {st.limitingRefs.length > 0 && (
          <div className="basis-full text-xs text-crit-text">Para armar la unidad {st.assembled + 1} falta: {st.limitingRefs.join(', ')}.</div>
        )}
        <div className="basis-full h-1.5 rounded-full bg-ink-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={units} aria-valuenow={st.assembled} aria-label="Unidades armadas">
          <div className={clsx('h-full rounded-full', st.done ? 'bg-plan' : 'bg-info')} style={{ width: `${pct}%` }} />
        </div>
        {st.done && <div className="basis-full text-xs font-semibold text-plan-text">Las {units} unidades están armadas.</div>}
      </div>

      {changed && (
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={saving} className="text-sm font-semibold bg-ink-950 text-white px-3 py-1.5 rounded-lg hover:bg-ink-800 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar avance'}
          </button>
          <button type="button" onClick={() => setLocal({ key: savedKey, assembled: a.assembled, ready: Object.fromEntries(a.components.map((c) => [c.pieceKey, c.ready])) })}
            className="text-sm px-3 py-1.5 rounded-lg border border-ink-200 hover:bg-ink-50">Descartar</button>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, max, label }: { value: number; onChange: (v: number) => void; max?: number; label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-ink-200 bg-white" role="group" aria-label={label}>
      <button type="button" aria-label={`Restar 1 (${label})`} disabled={value <= 0} onClick={() => onChange(value - 1)} className="px-1.5 py-1 text-ink-700 hover:bg-ink-50 disabled:opacity-30"><Minus size={13} aria-hidden /></button>
      <input type="number" min={0} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-12 text-center text-sm font-semibold tabular-nums border-x border-ink-200 py-1 focus:outline-none" />
      <button type="button" aria-label={`Sumar 1 (${label})`} disabled={max !== undefined && value >= max} onClick={() => onChange(value + 1)} className="px-1.5 py-1 text-ink-700 hover:bg-ink-50 disabled:opacity-30"><Plus size={13} aria-hidden /></button>
    </span>
  );
}
