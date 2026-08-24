import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

export function LoginPage() {
  const login = useStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.ok) { setError(res.error ?? 'No se pudo iniciar sesión.'); return; }
    navigate('/');
  }

  async function sendRecovery() {
    if (!recoverEmail.trim()) return;
    await supabase.auth.resetPasswordForEmail(recoverEmail.trim(), { redirectTo: window.location.origin });
    setRecoverSent(true);
  }

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-ink-950 p-6">
        <div className="max-w-md bg-white rounded-2xl shadow-pop p-6">
          <h1 className="font-display font-bold text-ink-900 text-lg mb-2">Falta configurar Supabase</h1>
          <p className="text-sm text-ink-600 leading-relaxed">
            No encontré <code className="bg-ink-50 px-1 rounded">VITE_SUPABASE_URL</code> ni <code className="bg-ink-50 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>.
            Creá un archivo <code className="bg-ink-50 px-1 rounded">.env.local</code> con esos dos valores (ver <code className="bg-ink-50 px-1 rounded">supabase/README.md</code>) y reiniciá <code className="bg-ink-50 px-1 rounded">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-ink-950">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-700/40">
        <div className="flex items-center gap-3">
          <img src="/logo-mark-blanco.png" alt="Estudio Bonta" className="w-10 h-10" />
          <div>
            <div className="font-brand font-extrabold text-2xl text-white tracking-tight">Estudio Bonta</div>
            <div className="text-ink-400 text-sm">Sistema interno de gestión de producción</div>
          </div>
        </div>
        <div>
          <p className="text-white text-2xl font-brand font-semibold" style={{ textWrap: 'balance' as any }}>
            "Del concepto a la pieza."
          </p>
          <p className="text-ink-200 text-base leading-relaxed mt-2 max-w-md" style={{ textWrap: 'balance' as any }}>
            Soluciones especiales para marcas, espacios y proyectos que necesitan algo más que una impresión.
          </p>
          <p className="text-ink-500 text-sm mt-6">Impresión UV · Vinilo de corte · Vidrieras · Stands · Letras corpóreas · Impresión 3D</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-ink-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <img src="/logo-mark.png" alt="Estudio Bonta" className="w-9 h-9" />
            <div className="font-brand font-extrabold text-xl text-ink-900">Estudio Bonta</div>
          </div>
          <div className="bg-white rounded-2xl shadow-card border border-ink-100 p-7">
            <h1 className="text-lg font-display font-bold text-ink-900 mb-1">Iniciar sesión</h1>
            <p className="text-sm text-ink-400 mb-6">Ingresá con tu cuenta de Estudio Bonta.</p>

            {!showRecover ? (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1.5">Usuario o email</label>
                  <input
                    value={email} onChange={(e) => setEmail(e.target.value)} type="text" autoComplete="username"
                    placeholder="nombre@estudiobonta.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1.5">Contraseña</label>
                  <input
                    value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                  />
                </div>
                {error && <div className="text-xs text-crit-text bg-crit-bg rounded-md px-3 py-2">{error}</div>}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-ink-600">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" />
                    Recordarme
                  </label>
                  <button type="button" onClick={() => setShowRecover(true)} className="text-brand-600 hover:underline">
                    Olvidé mi contraseña
                  </button>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-800 transition-colors disabled:opacity-50">
                  {submitting ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {recoverSent ? (
                  <p className="text-sm text-plan-text bg-plan-bg rounded-md px-3 py-2.5">
                    Si esa cuenta existe, te llegó un mail con un link para elegir una contraseña nueva.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1.5">Tu email</label>
                      <input
                        value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} type="email"
                        placeholder="nombre@estudiobonta.com"
                        className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
                      />
                    </div>
                    <button onClick={sendRecovery} className="w-full py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold hover:bg-ink-800 transition-colors">
                      Enviar link de recuperación
                    </button>
                  </>
                )}
                <button type="button" onClick={() => { setShowRecover(false); setRecoverSent(false); }} className="text-xs text-brand-600 hover:underline">
                  Volver al login
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-ink-400 mt-4 text-center">
            ¿No tenés cuenta todavía? Pedile a un administrador que te dé de alta desde Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
