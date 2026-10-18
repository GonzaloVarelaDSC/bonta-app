import { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import { MANUAL, type ManualTopic } from './manualContent';

// Manual con capturas (18/10): cada tema se abre y muestra las capturas con
// marcas rojas numeradas y, al lado/abajo, los pasos con el mismo número.
// Letra más grande que el resto de la app a propósito: es para leer tranquilo.
function Topic({ topic, open, onToggle }: { topic: ManualTopic; open: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
      <button
        type="button" onClick={onToggle} aria-expanded={open}
        aria-controls={`manual-panel-${topic.key}`} id={`manual-trigger-${topic.key}`}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ink-50/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <span>
          <span className="block text-base font-semibold text-ink-900">{topic.title}</span>
          <span className="block text-sm text-ink-700 mt-0.5">{topic.summary}</span>
        </span>
        <ChevronDown size={20} aria-hidden className={clsx('text-ink-700 transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={`manual-panel-${topic.key}`} role="region" aria-labelledby={`manual-trigger-${topic.key}`} className="border-t border-ink-50 px-5 py-5 space-y-8">
          {topic.blocks.map((b) => (
            <figure key={b.img} className="space-y-4">
              <a href={b.img} target="_blank" rel="noopener noreferrer" title="Ver la imagen en grande" className="block">
                <img src={b.img} alt={b.alt} loading="lazy" className="max-w-full w-auto mx-auto rounded-lg border border-ink-100 shadow-card" />
              </a>
              <ol className="space-y-2.5">
                {b.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-base text-ink-900 leading-snug">
                    <span aria-hidden className="shrink-0 w-7 h-7 rounded-full bg-crit text-white text-sm font-bold flex items-center justify-center mt-[-1px]">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              {b.tip && (
                <p className="flex items-start gap-2.5 text-sm text-norm-text bg-norm-bg rounded-lg px-3.5 py-2.5">
                  <Lightbulb size={16} aria-hidden className="shrink-0 mt-0.5" /> <span>{b.tip}</span>
                </p>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

export function ManualPage() {
  const [openKey, setOpenKey] = useState<string | null>(MANUAL[0].key);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-ink-900 mb-1">Manual de uso</h1>
      <p className="text-base text-ink-700 mb-6">
        Elegí un tema para ver el paso a paso. Los números rojos de cada imagen son los mismos de la lista de abajo.
        Tocá una imagen para verla en grande.
      </p>
      <div className="space-y-3">
        {MANUAL.map((t) => (
          <Topic key={t.key} topic={t} open={openKey === t.key} onToggle={() => setOpenKey(openKey === t.key ? null : t.key)} />
        ))}
      </div>
    </div>
  );
}
