import { differenceInMinutes, format, isToday, isTomorrow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

export function fmtDateTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });
}

export function fmtDate(iso: string): string {
  return format(new Date(iso), "d MMM yyyy", { locale: es });
}

export function fmtShort(iso: string): string {
  return format(new Date(iso), "d MMM, HH:mm", { locale: es });
}

/** Devuelve minutos restantes (negativo si ya pasó) hasta la fecha comprometida. */
export function minutesRemaining(iso: string, now: Date = new Date()): number {
  return differenceInMinutes(new Date(iso), now);
}

export interface Countdown {
  label: string;
  tone: 'crit' | 'urg' | 'norm' | 'plan' | 'ok';
  overdue: boolean;
}

export function countdown(iso: string, now: Date = new Date()): Countdown {
  const mins = minutesRemaining(iso, now);
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const d = Math.floor(h / 24);

  if (mins < 0) {
    const label = d >= 1 ? `Atrasado ${d}d ${h % 24}h` : `Atrasado ${h}h ${m}m`;
    return { label, tone: 'crit', overdue: true };
  }
  if (mins <= 4 * 60) return { label: `Faltan ${h}h ${m}m`, tone: 'crit', overdue: false };
  if (mins <= 24 * 60) return { label: `Faltan ${h}h ${m}m`, tone: 'urg', overdue: false };
  if (mins <= 72 * 60) return { label: d >= 1 ? `Faltan ${d}d` : `Faltan ${h}h`, tone: 'norm', overdue: false };
  return { label: `Faltan ${d}d`, tone: 'ok', overdue: false };
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Hoy';
  if (isTomorrow(date)) return 'Mañana';
  if (isPast(date)) return `Atrasado — ${fmtDate(iso)}`;
  return fmtDate(iso);
}
