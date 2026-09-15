import { useState } from 'react';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { visibleJobTypes, BLOCK_REASON_LABELS } from '../../data/catalog';
import { canManageCatalog } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import { Section } from './Section';

export function ConfigPage() {
  const user = useStore((s) => s.currentUser)!;
  const jobTypes = useStore((s) => s.jobTypes);
  const materials = useStore((s) => s.materials);
  const addJobType = useStore((s) => s.addJobType);
  const renameJobType = useStore((s) => s.renameJobType);
  const addMaterial = useStore((s) => s.addMaterial);
  const renameMaterial = useStore((s) => s.renameMaterial);
  const editable = canManageCatalog(user.role);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-ink-900 mb-1">Configuración</h1>
        <p className="text-sm text-ink-700">
          {editable
            ? 'Catálogos del sistema. Podés agregar ítems nuevos y renombrar los existentes — no se pueden borrar (algunos trabajos ya los tienen guardados).'
            : 'Catálogos del sistema. Solo un administrador puede editarlos.'}
        </p>
      </div>
      <EditableSection
        title="Tipos de trabajo" items={visibleJobTypes(jobTypes)} editable={editable}
        onAdd={addJobType} onRename={renameJobType}
        addPlaceholder="Ej: Impresión gran formato"
      />
      <EditableSection
        title="Materiales" items={materials} editable={editable}
        onAdd={addMaterial} onRename={renameMaterial}
        addPlaceholder="Ej: Policarbonato"
      />
      <ChipsSection title="Motivos de bloqueo" items={Object.values(BLOCK_REASON_LABELS)} />
    </div>
  );
}

function ChipsSection({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <span key={i} className="text-xs bg-ink-50 text-ink-700 rounded-full px-2.5 py-1">{i}</span>)}
      </div>
    </Section>
  );
}

// Chip con click-to-rename (mismo patrón que EditableCode en JobsTable/
// DashboardJobCard) — evita meter un formulario aparte para algo tan chico.
function EditableChip({ id, label, onRename }: { id: string; label: string; onRename: (id: string, label: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button" onClick={() => { setDraft(label); setEditing(true); }}
        className="group inline-flex items-center gap-1 text-xs bg-ink-50 hover:bg-ink-100 text-ink-700 rounded-full pl-2.5 pr-2 py-1"
      >
        {label}
        <Pencil size={11} className="text-ink-400 group-hover:text-ink-700" aria-hidden />
      </button>
    );
  }

  async function save() {
    if (!draft.trim() || draft.trim() === label) { setEditing(false); return; }
    setSaving(true);
    try {
      await onRename(id, draft);
      setEditing(false);
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1 bg-white border border-brand-300 rounded-full pl-2.5 pr-1 py-1">
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="text-xs w-32 focus:outline-none disabled:opacity-50"
      />
      <button type="button" onClick={save} disabled={saving} aria-label="Guardar" className="text-plan-text hover:brightness-90 disabled:opacity-40">
        <Check size={13} />
      </button>
      <button type="button" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancelar" className="text-ink-700 hover:text-ink-900 disabled:opacity-40">
        <X size={13} />
      </button>
    </span>
  );
}

function AddChip({ placeholder, onAdd }: { placeholder?: string; onAdd: (label: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (!adding) {
    return (
      <button
        type="button" onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 border border-dashed border-brand-300 rounded-full px-2.5 py-1 hover:bg-brand-50"
      >
        <Plus size={12} /> Agregar
      </button>
    );
  }

  async function save() {
    if (!draft.trim()) { setAdding(false); return; }
    setSaving(true);
    try {
      await onAdd(draft);
      setDraft('');
      setAdding(false);
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1 bg-white border border-brand-300 rounded-full pl-2.5 pr-1 py-1">
      <input
        autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} disabled={saving} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false); }}
        className="text-xs w-40 focus:outline-none disabled:opacity-50"
      />
      <button type="button" onClick={save} disabled={saving} aria-label="Agregar" className="text-plan-text hover:brightness-90 disabled:opacity-40">
        <Check size={13} />
      </button>
      <button type="button" onClick={() => setAdding(false)} disabled={saving} aria-label="Cancelar" className="text-ink-700 hover:text-ink-900 disabled:opacity-40">
        <X size={13} />
      </button>
    </span>
  );
}

function EditableSection({ title, items, editable, onAdd, onRename, addPlaceholder }: {
  title: string; items: { id: string; label: string }[]; editable: boolean;
  onAdd: (label: string) => Promise<void>; onRename: (id: string, label: string) => Promise<void>;
  addPlaceholder?: string;
}) {
  if (!editable) return <ChipsSection title={title} items={items.map((i) => i.label)} />;
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <EditableChip key={i.id} id={i.id} label={i.label} onRename={onRename} />)}
        <AddChip placeholder={addPlaceholder} onAdd={onAdd} />
      </div>
    </Section>
  );
}
