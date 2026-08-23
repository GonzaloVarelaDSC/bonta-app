import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface ManualSection {
  key: string;
  title: string;
  content?: ReactNode;
}

// Se va completando de a poco, sección por sección, a medida que Gonzalo pide
// que se documente cada parte de la app. Las que todavía no tienen `content`
// muestran un aviso de "pendiente" en vez de romper o inventar contenido.
const SECTIONS: ManualSection[] = [
  { key: 'dashboard', title: 'Dashboard' },
  { key: 'trabajos', title: 'Trabajos' },
  { key: 'nuevo-trabajo', title: 'Nuevo trabajo' },
  { key: 'kanban', title: 'Kanban' },
  { key: 'chequeo-archivos', title: 'Chequeo de archivos' },
  { key: 'usuarios', title: 'Usuarios y roles' },
];

function SectionItem({ section, open, onToggle }: { section: ManualSection; open: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 shadow-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-ink-50/60 transition-colors"
      >
        <span className="text-sm font-semibold text-ink-900">{section.title}</span>
        <ChevronDown size={16} className={clsx('text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm text-ink-700 leading-relaxed border-t border-ink-50">
          {section.content ?? (
            <p className="text-ink-400 italic py-2">Todavía no hay contenido para esta sección — se va completando de a poco.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ManualPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Manual de uso</h1>
      <p className="text-sm text-ink-500 mb-5">Paso a paso de cada sección y herramienta del sistema. Se va armando de a poco.</p>

      <div className="space-y-2.5">
        {SECTIONS.map((s) => (
          <SectionItem key={s.key} section={s} open={openKey === s.key} onToggle={() => setOpenKey(openKey === s.key ? null : s.key)} />
        ))}
      </div>
    </div>
  );
}
