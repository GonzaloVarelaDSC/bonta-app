// Lógica pura del módulo Instalaciones: fechas de solo-día, armado de la grilla
// mensual con franjas de varios días y la "orden de instalación" para el PDF.
//
// Las fechas de instalación son "YYYY-MM-DD" (sin hora). Nunca pasarlas por
// `new Date('2026-11-12')`: eso las toma como UTC y en Argentina se ven un día
// antes. Usar siempre parseDay/toDayKey de acá.

import {
  addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client, InstallationInfo, Job, Product } from '../types';

export const WEEK_OPTS = { weekStartsOn: 1 as const };

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function addDaysKey(key: string, n: number): string {
  return toDayKey(addDays(parseDay(key), n));
}

/** "12 nov" / "12 nov 2026" */
export function fmtDay(key: string, withYear = false): string {
  return format(parseDay(key), withYear ? "d MMM yyyy" : 'd MMM', { locale: es });
}

/** "jueves 12 de noviembre" */
export function fmtDayLong(key: string): string {
  return format(parseDay(key), "EEEE d 'de' MMMM", { locale: es });
}

/** "12 nov" o "12 al 14 nov" o "30 nov al 2 dic". */
export function fmtPeriod(start: string, end: string, withYear = false): string {
  if (start === end) return fmtDay(start, withYear);
  const a = parseDay(start);
  const b = parseDay(end);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = sameMonth ? format(a, 'd') : fmtDay(start);
  return `${left} al ${fmtDay(end, withYear)}`;
}

export function fmtTime(time?: string): string {
  return time ? `${time.slice(0, 5)} h` : 'Sin horario';
}

export interface ScheduledInstallation {
  job: Job;
  inst: InstallationInfo;
  start: string;
  end: string;
}

/** Trabajos vigentes (no eliminados ni cancelados) con instalación. */
function liveWithInstallation(jobs: Job[]): Job[] {
  return jobs.filter((j) => !j.deletedAt && j.status !== 'CANCELADO' && j.installation);
}

/** Instalaciones con fecha, ordenadas por inicio y hora. */
export function scheduledInstallations(jobs: Job[]): ScheduledInstallation[] {
  return liveWithInstallation(jobs)
    .filter((j) => j.installation!.date)
    .map((job) => {
      const inst = job.installation!;
      const start = inst.date!;
      const end = inst.endDate && inst.endDate >= start ? inst.endDate : start;
      return { job, inst, start, end };
    })
    .sort((a, b) => a.start.localeCompare(b.start) || (a.inst.time ?? '99').localeCompare(b.inst.time ?? '99'));
}

/** OT que requieren instalación y todavía no tienen fecha (se arrastran al calendario). */
export function unscheduledInstallations(jobs: Job[]): Job[] {
  return jobs.filter((j) =>
    !j.deletedAt && j.requiresInstallation && j.status !== 'CANCELADO' && j.status !== 'TERMINADO'
    && !(j.installation?.date) && !j.installation?.completed
  );
}

export function overlaps(s: ScheduledInstallation, from: string, to: string): boolean {
  return s.start <= to && s.end >= from;
}

/** Duración en días (1 = un solo día). */
export function durationDays(start: string, end: string): number {
  return differenceInCalendarDays(parseDay(end), parseDay(start)) + 1;
}

// ---------- Grilla mensual ----------

export interface WeekBar {
  item: ScheduledInstallation;
  /** columna 0..6 donde empieza / termina dentro de la semana */
  col: number;
  span: number;
  lane: number;
  startsHere: boolean;
  endsHere: boolean;
}

export interface MonthWeek {
  days: string[];
  bars: WeekBar[];
  lanes: number;
}

/**
 * Semanas (lunes a domingo) que cubren el mes, con las instalaciones ubicadas en
 * carriles: una franja continua por instalación aunque dure varios días, y
 * nunca dos franjas en el mismo carril el mismo día. No se ocultan instalaciones.
 */
export function monthWeeks(monthDate: Date, items: ScheduledInstallation[]): MonthWeek[] {
  const first = startOfWeek(startOfMonth(monthDate), WEEK_OPTS);
  const last = endOfWeek(endOfMonth(monthDate), WEEK_OPTS);
  const weeks: MonthWeek[] = [];
  for (let d = first; d <= last; d = addDays(d, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => toDayKey(addDays(d, i)));
    const from = days[0];
    const to = days[6];
    const inWeek = items
      .filter((it) => overlaps(it, from, to))
      .sort((a, b) => a.start.localeCompare(b.start) || durationDays(b.start, b.end) - durationDays(a.start, a.end));
    const laneEnds: string[] = [];
    const bars: WeekBar[] = inWeek.map((item) => {
      const s = item.start < from ? from : item.start;
      const e = item.end > to ? to : item.end;
      let lane = laneEnds.findIndex((endKey) => endKey < s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
      const col = days.indexOf(s);
      return { item, col, span: days.indexOf(e) - col + 1, lane, startsHere: item.start >= from, endsHere: item.end <= to };
    });
    weeks.push({ days, bars, lanes: laneEnds.length });
  }
  return weeks;
}

// ---------- Orden de instalación (PDF) ----------

/**
 * Lo único que sale en la orden para quien instala. Se arma campo por campo
 * (lista blanca): nunca se pasa el trabajo entero a la hoja. No incluye precios,
 * importes, presupuestos, comentarios, historial, papeles ni links de la app.
 */
export interface InstallationOrder {
  key: string;
  code: string;
  clientName: string;
  jobName: string;
  description: string;
  products: { label: string; sizes: string[]; notes: string }[];
  period: string;
  multiDay: boolean;
  time: string;
  address: string;
  locality: string;
  indications: string;
  contactName: string;
  contactPhone: string;
  installers: string[];
  contactSheetPath: string | null;
}

function productLine(p: Product): { label: string; sizes: string[]; notes: string } {
  const sizes = p.sizeItems
    .filter((s) => s.quantity || s.width || s.height)
    .map((s) => [s.quantity && `${s.quantity} u.`, [s.width, s.height].filter(Boolean).join(' × ')].filter(Boolean).join(' de '));
  return { label: p.label || 'Producto', sizes, notes: p.notes };
}

export function buildInstallationOrder(job: Job, client: Client | undefined): InstallationOrder | null {
  const inst = job.installation;
  if (!inst) return null;
  const start = inst.date ?? '';
  const end = inst.endDate && inst.endDate >= start ? inst.endDate : start;
  return {
    key: job.id,
    code: job.code ?? 'Sin N°',
    clientName: client?.name ?? '',
    jobName: job.name,
    description: job.description,
    products: job.products.map(productLine),
    period: start ? fmtPeriod(start, end, true) : 'Sin fecha',
    multiDay: !!start && start !== end,
    time: inst.time ? fmtTime(inst.time) : '',
    address: inst.address,
    locality: inst.locality,
    indications: inst.notes,
    contactName: inst.contactName,
    contactPhone: inst.contactPhone,
    installers: inst.installerNames,
    contactSheetPath: job.contactSheetPath ?? null,
  };
}
