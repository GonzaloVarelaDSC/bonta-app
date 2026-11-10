import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  X, CalendarDays, MapPin, Users as UsersIcon, FileCheck2, ExternalLink, Printer, Pencil, RotateCcw, CheckCircle2,
} from 'lucide-react';
import { useStore, installationInputOf, type InstallationInput } from '../../store/useStore';
import { canScheduleInstallations } from '../../lib/permissions';
import { friendlyError } from '../../lib/errors';
import { fmtDateTime } from '../../lib/dates';
import { fmtPeriod, fmtTime, fmtDay, durationDays } from '../../lib/installations';
import { INSTALLER_NAMES } from '../../data/catalog';
import { btn, fieldCls, labelCls } from '../Common/ui';
import type { Job } from '../../types';

/**
 * Detalle de una instalación en panel lateral (en celular ocupa la pantalla).
 * Muestra los datos de agenda en 4 grupos y, para quien puede programar, los
 * edita. Cliente, trabajo, N° y descripción se leen de la OT: no se copian.
 */
export function InstallationPanel({
  job, startEditing, initialDate, onClose, onExport,
}: {
  job: Job;
  startEditing?: boolean;
  /** Para una instalación nueva creada desde un día del calendario. */
  initialDate?: string | null;
  onClose: () => void;
  onExport: (jobId: string) => void;
}) {
  const user = useStore((s) => s.currentUser)!;
  const users = useStore((s) => s.users);
  const client = useStore((s) => s.clients).find((c) => c.id === job.clientId);
  const saveInstallation = useStore((s) => s.saveInstallation);
  const loadJobActivity = useStore((s) => s.loadJobActivity);
  const activityLog = useStore((s) => s.activityLog);
  const canEdit = canScheduleInstallations(user);
  const inst = job.installation;

  const [editing, setEditing] = useState(!!startEditing && canEdit);
  const [form, setForm] = useState<InstallationInput>(() => {
    const base = installationInputOf(inst);
    if (!inst) {
      base.contactName = job.contactName ?? '';
      base.contactPhone = job.contactPhone ?? '';
    }
    if (!base.date && initialDate) { base.date = initialDate; base.endDate = initialDate; }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadJobActivity(job.id).catch(() => { /* el historial es secundario */ });
  }, [job.id, loadJobActivity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const history = useMemo(
    () => activityLog.filter((a) => a.jobId === job.id && (a.action === 'instalacion_agenda' || a.action === 'instalacion')),
    [activityLog, job.id],
  );
  const userName = (id?: string) => users.find((u) => u.id === id)?.name.split(' ')[0] ?? 'Alguien';

  function patch(p: Partial<InstallationInput>) { setForm((f) => ({ ...f, ...p })); }

  async function save() {
    setError('');
    if (form.date && form.endDate && form.endDate < form.date) { setError('La fecha de fin no puede ser anterior al inicio.'); return; }
    setSaving(true);
    try {
      await saveInstallation(job.id, form);
      setEditing(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const start = inst?.date;
  const end = inst?.endDate ?? inst?.date;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-ink-950/25" onClick={onClose} aria-hidden />
      <aside
        role="dialog" aria-modal="true" aria-labelledby="inst-panel-title"
        className="relative h-full w-full sm:max-w-md bg-white shadow-pop flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <header className="px-5 pt-4 pb-3 border-b border-ink-200 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-meta uppercase tracking-wide text-ink-700 font-semibold">Instalación</div>
            <h2 id="inst-panel-title" className="mt-0.5 font-display font-bold text-lg text-ink-900 leading-snug">
              <span className="tabular-nums">{job.code ?? 'Sin N°'}</span> · {client?.name ?? 'Cliente'}
            </h2>
            <p className="text-sm text-ink-700 truncate">{job.name}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {inst?.completed && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-ink-100 text-ink-800 border border-ink-200">
                  <CheckCircle2 size={12} aria-hidden /> Completada
                </span>
              )}
              {inst?.rescheduled && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-urg-bg text-urg-text border border-urg/30">
                  <RotateCcw size={12} aria-hidden /> Reprogramada
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className={btn('ghost', 'sm')}><X size={18} aria-hidden /></button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          {editing ? (
            <EditForm form={form} patch={patch} />
          ) : (
            <>
              <Group icon={CalendarDays} title="Programación">
                {start ? (
                  <>
                    <Row label="Fecha">{fmtPeriod(start, end!, true)}{start !== end && <span className="text-ink-700"> · {durationDays(start, end!)} días</span>}</Row>
                    <Row label="Hora de inicio">{fmtTime(inst?.time)}</Row>
                  </>
                ) : (
                  <Row label="Fecha"><span className="text-urg-text font-medium">Sin fecha</span></Row>
                )}
                {inst?.rescheduled && inst.rescheduledFrom && (
                  <Row label="Reprogramada">
                    Antes: {fmtDay(inst.rescheduledFrom, true)} · por {userName(inst.rescheduledBy)}
                    {inst.rescheduledAt && <span className="text-ink-700"> ({fmtDateTime(inst.rescheduledAt)})</span>}
                  </Row>
                )}
              </Group>
              <Group icon={MapPin} title="Ubicación">
                <Row label="Dirección">{inst?.address || <Missing />}</Row>
                <Row label="Localidad">{inst?.locality || <Missing />}</Row>
                <Row label="Indicaciones">{inst?.notes ? <span className="whitespace-pre-wrap">{inst.notes}</span> : <Missing />}</Row>
                <Row label="Contacto">
                  {inst?.contactName || inst?.contactPhone
                    ? <>{inst.contactName}{inst.contactPhone && <> · <a className="underline underline-offset-2" href={`tel:${inst.contactPhone}`}>{inst.contactPhone}</a></>}</>
                    : <Missing />}
                </Row>
              </Group>
              <Group icon={UsersIcon} title="Personal">
                <Row label="Instala">{inst?.installerNames.length ? inst.installerNames.join(', ') : <Missing text="Sin asignar" />}</Row>
              </Group>
              <Group icon={FileCheck2} title="Papeles y permisos">
                <Row label="Estado">
                  <span className={clsx('inline-flex items-center gap-1.5 font-medium', inst?.papersOk ? 'text-plan-text' : 'text-urg-text')}>
                    <span className={clsx('w-2 h-2 rounded-full', inst?.papersOk ? 'bg-plan' : 'bg-urg')} aria-hidden />
                    {inst?.papersOk ? 'OK' : 'No OK'}
                  </span>
                </Row>
              </Group>
              {history.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-ink-800 mb-2">Historial de la instalación</h3>
                  <ol className="space-y-1.5">
                    {history.slice(0, 8).map((h) => (
                      <li key={h.id} className="text-xs text-ink-800">
                        <span className="text-ink-700">{fmtDateTime(h.createdAt)} · {userName(h.userId)}</span>
                        <div>{h.detail}</div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {inst?.completed && inst.completedNotes && (
                <p className="text-xs text-ink-700">Observaciones al completar: {inst.completedNotes}</p>
              )}
            </>
          )}
          {error && <p role="alert" className="text-sm text-crit-text bg-crit-bg border border-crit/30 rounded-ctl px-3 py-2">{error}</p>}
        </div>

        <footer className="px-5 py-3 border-t border-ink-200 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button onClick={save} disabled={saving} className={btn('primary')}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button onClick={() => { if (inst) { setForm(installationInputOf(inst)); setEditing(false); } else onClose(); }} className={btn('ghost')}>Cancelar</button>
            </>
          ) : (
            <>
              {canEdit && <button onClick={() => setEditing(true)} className={btn('primary')}><Pencil size={15} aria-hidden /> Editar</button>}
              {inst && <button onClick={() => onExport(job.id)} className={btn('secondary')}><Printer size={15} aria-hidden /> Orden PDF</button>}
              <Link to={`/trabajos/${job.id}`} className={clsx(btn('ghost'), 'ml-auto')}>Abrir OT <ExternalLink size={14} aria-hidden /></Link>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Group({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-800 mb-2">
        <Icon size={14} className="text-ink-700" aria-hidden /> {title}
      </h3>
      <dl className="rounded-ctl border border-ink-200 divide-y divide-ink-100">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2 text-sm">
      <dt className="text-ink-700">{label}</dt>
      <dd className="text-ink-900 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Missing({ text = '—' }: { text?: string }) {
  return <span className="text-ink-700">{text}</span>;
}

function EditForm({ form, patch }: { form: InstallationInput; patch: (p: Partial<InstallationInput>) => void }) {
  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-ink-800 mb-2">Programación</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inst-start" className={labelCls}>Inicio</label>
            <input
              id="inst-start" type="date" className={fieldCls} value={form.date ?? ''}
              onChange={(e) => {
                const v = e.target.value || null;
                patch({ date: v, endDate: !v ? null : !form.endDate || form.endDate < v ? v : form.endDate });
              }}
            />
          </div>
          <div>
            <label htmlFor="inst-end" className={labelCls}>Fin</label>
            <input
              id="inst-end" type="date" className={fieldCls} value={form.endDate ?? ''} min={form.date ?? undefined}
              disabled={!form.date} onChange={(e) => patch({ endDate: e.target.value || form.date })}
            />
          </div>
        </div>
        <div className="w-1/2 pr-1.5">
          <label htmlFor="inst-time" className={labelCls}>Hora de inicio</label>
          <input id="inst-time" type="time" className={fieldCls} value={form.time ?? ''} onChange={(e) => patch({ time: e.target.value || null })} />
        </div>
        <p className="text-2xs text-ink-700">Si dura un día, inicio y fin son el mismo. La hora vale para todos los días.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-ink-800 mb-2">Ubicación</legend>
        <div>
          <label htmlFor="inst-address" className={labelCls}>Dirección</label>
          <input id="inst-address" className={fieldCls} value={form.address} onChange={(e) => patch({ address: e.target.value })} placeholder="Ej: Paraná 3745, local 1012" />
        </div>
        <div>
          <label htmlFor="inst-locality" className={labelCls}>Localidad</label>
          <input id="inst-locality" className={fieldCls} value={form.locality} onChange={(e) => patch({ locality: e.target.value })} placeholder="Ej: Martínez" />
        </div>
        <div>
          <label htmlFor="inst-notes" className={labelCls}>Indicaciones</label>
          <textarea
            id="inst-notes" rows={3} className={clsx(fieldCls, 'h-auto py-2 resize-y')} value={form.notes}
            onChange={(e) => patch({ notes: e.target.value })} placeholder="Ej: entrar por carga y descarga, pedir por seguridad."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inst-contact" className={labelCls}>Contacto</label>
            <input id="inst-contact" className={fieldCls} value={form.contactName} onChange={(e) => patch({ contactName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="inst-phone" className={labelCls}>Teléfono</label>
            <input id="inst-phone" type="tel" inputMode="tel" className={fieldCls} value={form.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-ink-800 mb-2">Quién instala</legend>
        <div className="flex flex-wrap gap-2">
          {INSTALLER_NAMES.map((name) => {
            const on = form.installerNames.includes(name);
            return (
              <button
                key={name} type="button" aria-pressed={on}
                onClick={() => patch({ installerNames: on ? form.installerNames.filter((n) => n !== name) : [...form.installerNames, name] })}
                className={clsx(
                  'h-ctl max-md:min-h-touch px-3 rounded-full text-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  on ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-800 border-ink-300 hover:border-ink-450',
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold text-ink-800 mb-2">Papeles y permisos</legend>
        <div className="inline-flex rounded-ctl border border-ink-300 overflow-hidden" role="group">
          {[{ v: true, l: 'OK' }, { v: false, l: 'No OK' }].map((o) => (
            <button
              key={o.l} type="button" aria-pressed={form.papersOk === o.v} onClick={() => patch({ papersOk: o.v })}
              className={clsx(
                'h-ctl max-md:min-h-touch px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                form.papersOk === o.v ? 'bg-ink-900 text-white' : 'bg-white text-ink-800 hover:bg-ink-50',
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
