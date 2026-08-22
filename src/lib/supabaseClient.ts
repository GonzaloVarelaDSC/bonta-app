import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

// Si no hay .env.local configurado todavía, exportamos un cliente "vacío" apuntando a
// valores dummy — la app lo detecta vía `supabaseConfigured` y muestra un aviso en vez
// de romper, para que el proyecto siga siendo clonable/mostrable sin credenciales reales.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
);
