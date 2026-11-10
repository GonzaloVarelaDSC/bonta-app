import { differenceInCalendarDays, differenceInMinutes, format, isToday, isTomorrow, isPast } from 'date-fns';
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
  // La entrega es solo fecha (las 18:00 son referencia interna): la etiqueta
  // cuenta días de calendario, nunca horas/minutos. El tono sigue por horas.
  const days = differenceInCalendarDays(new Date(iso), now);
  const plural = (n: number) => (n === 1 ? 'día' : 'días');

  if (mins < 0) {
    const late = Math.abs(days);
    const label = late === 0 ? 'Venció hoy' : `Atrasado ${late} ${plural(late)}`;
    return { label, tone: 'crit', overdue: true };
  }
  const label = days <= 0 ? 'Vence hoy' : days === 1 ? 'Mañana' : `Faltan ${days} días`;
  if (mins <= 4 * 60) return { label, tone: 'crit', overdue: false };
  // Hasta 2 días (48h) cuenta como urgente — antes eran solo 24h y el tramo de
  // "faltan 1-2 días" caía en el amarillo tranquilo de abajo, pasando desapercibido.
  if (mins <= 48 * 60) return { label, tone: 'urg', overdue: false };
  if (mins <= 72 * 60) return { label, tone: 'norm', overdue: false };
  return { label, tone: 'ok', overdue: false };
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Hoy';
  if (isTomorrow(date)) return 'Mañana';
  if (isPast(date)) return `Atrasado — ${fmtDate(iso)}`;
  return fmtDate(iso);
}
