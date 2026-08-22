import type { Job, RiskLevel } from '../types';
import { minutesRemaining } from './dates';

export function calculateRisk(job: Job, now: Date = new Date()): RiskLevel {
  const isBlocked = job.blockRecords.some((b) => !b.closedAt);
  const hours = minutesRemaining(job.committedDate, now) / 60;
  const activeStages = job.stages.filter((s) => s.active).length;
  const hasOpenDependencyRisk = isBlocked && hours <= 48;

  if (hasOpenDependencyRisk) return 'CRITICO';
  if (job.requiresInstallation && activeStages >= 3 && hours <= 96) return 'ALTO';
  const missingSomething =
    !job.measurements.trim() || job.materialIds.length === 0 || !job.technique.trim();
  if (missingSomething || isBlocked) return 'MEDIO';
  return 'BAJO';
}

export const RISK_META: Record<RiskLevel, { label: string; emoji: string }> = {
  BAJO: { label: 'Bajo', emoji: '🟢' },
  MEDIO: { label: 'Medio', emoji: '🟡' },
  ALTO: { label: 'Alto', emoji: '🟠' },
  CRITICO: { label: 'Crítico', emoji: '🔴' },
};

/** Un trabajo "silencioso": sin actividad hace más de 48h y no terminado/cancelado. */
export function isSilent(job: Job, now: Date = new Date()): boolean {
  if (job.status === 'TERMINADO' || job.status === 'CANCELADO') return false;
  const hoursSinceActivity = (now.getTime() - new Date(job.lastActivityAt).getTime()) / 3_600_000;
  return hoursSinceActivity >= 48;
}
