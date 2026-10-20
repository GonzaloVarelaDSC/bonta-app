import type { DaysMode, ExplorerFilters, JobFacts, Period } from '../../lib/metrics';

/** Lo que comparten todas las vistas de Métricas: mismos hechos, mismo período, mismas reglas. */
export interface MetricsCtx {
  facts: JobFacts[];
  period: Period;
  prev: Period;
  periodLabel: string;
  /** El período anterior cae entero dentro de los datos disponibles. */
  comparable: boolean;
  dataSince: Date | null;
  mode: DaysMode;
  unit: string; // "días" o "días hábiles"
  now: Date;
  typeLabel: (id: string) => string;
  clientName: (id: string) => string;
  userName: (id: string | null) => string;
  /** Ir al Explorador con estos filtros (y opcionalmente otro período), conservando el resto del contexto. */
  drill: (f: Partial<ExplorerFilters>, period?: Period) => void;
  openJob: (id: string) => void;
}
