/**
 * Traduce errores técnicos (Postgres/Supabase/PostgREST, o de red) a un mensaje
 * en criollo para mostrarle al usuario. Antes de esto, errores como
 * `invalid input syntax for type uuid: "..."` o `new row violates row-level
 * security policy...` llegaban tal cual a la pantalla (ver CLAUDE.md §25,
 * hallazgo 1) — confuso para cualquiera que no sepa qué es una policy de RLS,
 * y ya pasó más de una vez que la causa real era una migración sin correr
 * (§12.8, §22) o una policy desincronizada.
 *
 * Un `Error` que ya arma el propio código de la app en criollo (ej. "Falta el
 * nombre del cliente.", "Ya existe otro trabajo con ese número.") se devuelve
 * tal cual — solo se traduce lo que tiene forma de error técnico crudo.
 */
export function friendlyError(err: unknown): string {
  if (!err) return 'No se pudo completar la acción.';
  const e = err as { message?: string; code?: string };
  const code = e.code;
  const msg = e.message ?? String(err);

  const looksTechnical = /violates row-level security|duplicate key value|invalid input syntax|does not exist|permission denied|Failed to fetch|NetworkError/i.test(msg);
  if (!code && !looksTechnical) return msg;

  if (code === '23505' || /duplicate key value/i.test(msg)) {
    return 'Ya existe un registro con ese mismo valor — revisá si no está cargado.';
  }
  if (code === '23503') {
    return 'No se pudo completar: depende de otro dato que no existe o fue borrado.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'No tenés permiso para hacer esto, o falta una configuración de acceso en la base — avisale a Gonzalo.';
  }
  if (code === '22P02' || /invalid input syntax/i.test(msg)) {
    return 'Hay un dato con formato inválido. Probá de nuevo; si sigue, avisale a Gonzalo.';
  }
  if (/column .* does not exist|relation .* does not exist/i.test(msg)) {
    return 'Falta aplicar una actualización en la base de datos. Avisale a Gonzalo — puede ser una migración pendiente.';
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return 'No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.';
  }
  return 'No se pudo completar la acción. Si el problema sigue, avisale a Gonzalo con el detalle de qué estabas haciendo.';
}
