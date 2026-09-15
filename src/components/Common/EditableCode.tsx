import { useState } from 'react';
import type { Job } from '../../types';
import { friendlyError } from '../../lib/errors';

type EditableCodeSize = 'sm' | 'md';

const READ_ONLY_CLS: Record<EditableCodeSize, string> = {
  sm: 'font-mono text-xs text-ink-700',
  md: 'font-mono text-sm font-semibold text-ink-900',
};
const INPUT_CLS: Record<EditableCodeSize, string> = {
  sm: 'font-mono text-xs w-28 border border-brand-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500',
  md: 'font-mono text-sm w-28 border border-brand-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500',
};
const WITH_CODE_CLS: Record<EditableCodeSize, string> = {
  sm: 'font-mono text-xs text-ink-700 hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300',
  md: 'font-mono text-sm font-semibold text-ink-900 hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300 whitespace-nowrap',
};
const WITHOUT_CODE_CLS: Record<EditableCodeSize, string> = {
  sm: 'text-xs text-ink-700 italic hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300',
  md: 'text-sm text-ink-700 italic hover:text-brand-600 underline decoration-dotted underline-offset-2 decoration-ink-300 whitespace-nowrap',
};

/**
 * Input inline para cargar/editar el N° de trabajo / orden de Copernico —
 * compartido entre JobsTable y DashboardJobCard (antes duplicado en los dos
 * archivos, con una diferencia real ya presente entre las copias — ver
 * AUDITORIA_UXUI_2026-09-15.md, ítem #11). `size` reproduce el tamaño/peso de
 * cada pantalla ("sm" = Tabla, "md" = ficha horizontal del Dashboard, más
 * grande y en negrita). `stopClickPropagation` reproduce el
 * `stopPropagation()` que solo tenía la copia de la Tabla (su `<tr>` entera es
 * clickeable para navegar) — se mantiene como estaba en cada lado en vez de
 * decidir cuál de las dos versiones es "la correcta".
 */
export function EditableCode({
  job, editable, onSave, size = 'sm', stopClickPropagation = false,
}: {
  job: Job;
  editable: boolean;
  onSave: (code: string) => void | Promise<void>;
  size?: EditableCodeSize;
  stopClickPropagation?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(job.code ?? '');

  if (!editable) return <span className={READ_ONLY_CLS[size]}>{job.code ?? '—'}</span>;

  if (editing) {
    const save = async () => {
      setEditing(false);
      if (!draft.trim() || draft.trim() === job.code) return;
      try {
        await onSave(draft);
      } catch (err: any) {
        alert(friendlyError(err));
      }
    };
    return (
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
        onBlur={save} placeholder="N° de Copernico"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className={INPUT_CLS[size]}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { if (stopClickPropagation) e.stopPropagation(); setDraft(job.code ?? ''); setEditing(true); }}
      title="Cargar número de trabajo / orden de Copernico"
      className={job.code ? WITH_CODE_CLS[size] : WITHOUT_CODE_CLS[size]}
    >
      {job.code ?? 'Cargar N°'}
    </button>
  );
}
