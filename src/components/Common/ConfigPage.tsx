import { JOB_TYPES, MATERIALS, BLOCK_REASON_LABELS } from '../../data/catalog';

export function ConfigPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Configuración</h1>
        <p className="text-sm text-ink-700">
          Catálogos del sistema. En Fase 1 son de solo lectura (definidos en el código, junto con el resto del modelo de datos);
          la edición desde esta pantalla queda para cuando se conecte el backend real, para que los cambios no se pierdan al reiniciar.
        </p>
      </div>
      <Section title="Tipos de trabajo" items={JOB_TYPES.map((t) => t.label)} />
      <Section title="Materiales" items={MATERIALS.map((m) => m.label)} />
      <Section title="Motivos de bloqueo" items={Object.values(BLOCK_REASON_LABELS)} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card p-4">
      <div className="text-sm font-semibold text-ink-800 mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <span key={i} className="text-xs bg-ink-50 text-ink-700 rounded-full px-2.5 py-1">{i}</span>)}
      </div>
    </div>
  );
}
