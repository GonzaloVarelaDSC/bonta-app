import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { MATERIAL_FORMATS, MACHINES, PRODUCTION_RULES, PENDING_DATA, type DataStatus } from '../../data/materialsKnowledge';

// Página de consulta de la base de materiales (18/10). Separa siempre lo
// confirmado, lo aproximado y lo que falta confirmar, como pide el documento
// original — nada se muestra como seguro si no lo está.
const STATUS: Record<DataStatus, { label: string; cls: string }> = {
  confirmado: { label: 'Confirmado', cls: 'bg-plan-bg text-plan-text border-plan/30' },
  aproximado: { label: 'Aproximado', cls: 'bg-norm-bg text-norm-text border-norm/30' },
  pendiente: { label: 'A confirmar', cls: 'bg-wait-bg text-wait-text border-wait/30' },
};

function Status({ s }: { s: DataStatus }) {
  return <span className={clsx('inline-block text-[11px] font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap', STATUS[s].cls)}>{STATUS[s].label}</span>;
}

const dash = (v: string) => v || <span className="text-ink-700">—</span>;
const th = 'px-3 py-2 text-left text-[11px] uppercase tracking-wide text-ink-700 font-medium';
const td = 'px-3 py-2.5 align-top';

export function MaterialsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-900 mb-1">Materiales y máquinas</h1>
        <p className="text-base text-ink-700">
          Formatos de placa, medidas máximas de las máquinas y reglas de producción. Lo marcado «A confirmar» todavía no está verificado.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-ink-900 border-b border-ink-100">Materiales y formatos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60"><tr><th className={th}>Material</th><th className={th}>Espesor</th><th className={th}>Largo de placa</th><th className={th}>Ancho</th><th className={th}>Estado</th></tr></thead>
            <tbody className="divide-y divide-ink-50">
              {MATERIAL_FORMATS.map((m, i) => (
                <tr key={i}>
                  <td className={clsx(td, 'font-semibold text-ink-900')}>{m.material}</td>
                  <td className={td}>{dash(m.thickness)}</td>
                  <td className={td}>{dash(m.length)}</td>
                  <td className={td}>{dash(m.width)}{m.note && <div className="text-xs text-ink-700 mt-0.5">{m.note}</div>}</td>
                  <td className={td}><Status s={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-ink-900 border-b border-ink-100">Máquinas</h2>
        <ul className="divide-y divide-ink-50">
          {MACHINES.map((m) => (
            <li key={m.name} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink-900">{m.name}</div>
                <div className="text-sm text-ink-800">{m.spec}</div>
                {m.note && <div className="text-xs text-ink-700 mt-0.5">{m.note}</div>}
              </div>
              <Status s={m.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-ink-900 border-b border-ink-100">Reglas de producción</h2>
        <ul className="divide-y divide-ink-50">
          {PRODUCTION_RULES.map((r) => (
            <li key={r.title} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-ink-900 flex-1">{r.title}</span>
                <Status s={r.status} />
              </div>
              <ul className="list-disc pl-5 text-sm text-ink-800 space-y-0.5">
                {r.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-wait-bg/60 rounded-xl border border-wait/30 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 mb-1.5"><CircleAlert size={15} aria-hidden /> Datos que faltan completar o verificar</h2>
        <ul className="list-disc pl-5 text-sm text-ink-800 space-y-0.5">
          {PENDING_DATA.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>
    </div>
  );
}
