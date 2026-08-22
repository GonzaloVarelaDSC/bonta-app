import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Avatar } from '../Common/Badges';
import { fmtShort } from '../../lib/dates';
import { ROLES } from '../../data/catalog';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const user = useStore((s) => s.currentUser);
  const jobs = useStore((s) => s.jobs);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAllRead = useStore((s) => s.markAllNotificationsRead);
  const logout = useStore((s) => s.logout);

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowResults(false); setShowNotifs(false); setShowAccount(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return jobs.filter((j) => {
      const client = clients.find((c) => c.id === j.clientId);
      const responsible = users.find((u) => u.id === j.responsibleUserId);
      return (
        (j.code ?? '').toLowerCase().includes(q) ||
        j.name.toLowerCase().includes(q) ||
        client?.name.toLowerCase().includes(q) ||
        responsible?.name.toLowerCase().includes(q) ||
        j.materialIds.some((m) => m.includes(q)) ||
        j.installation?.address.toLowerCase().includes(q)
      );
    }).slice(0, 8);
  }, [query, jobs, clients, users]);

  const myNotifs = user ? notifications.filter((n) => n.userId === user.id).slice(0, 12) : [];
  const unread = myNotifs.filter((n) => !n.read).length;

  if (!user) return null;

  return (
    <header className="h-16 shrink-0 bg-white border-b border-ink-100 flex items-center gap-2 sm:gap-4 px-3 sm:px-6" ref={boxRef}>
      <button onClick={onMenuClick} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-ink-50 text-ink-600 shrink-0">
        <Menu size={20} />
      </button>
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Buscar trabajo, cliente, material..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-ink-50 border border-transparent text-sm focus:bg-white focus:border-brand-400 focus:outline-none transition-colors"
        />
        {showResults && results.length > 0 && (
          <div className="absolute mt-1.5 w-full bg-white rounded-lg shadow-pop border border-ink-100 overflow-hidden z-30">
            {results.map((j) => (
              <button
                key={j.id}
                onClick={() => { navigate(`/trabajos/${j.id}`); setShowResults(false); setQuery(''); }}
                className="w-full text-left px-4 py-2.5 hover:bg-ink-50 flex items-center justify-between gap-3 border-b border-ink-50 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{j.name}</div>
                  <div className="text-xs text-ink-400">{j.code ?? 'Sin N°'} · {clients.find((c) => c.id === j.clientId)?.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="relative">
        <button onClick={() => setShowNotifs((v) => !v)} className="relative p-2 rounded-lg hover:bg-ink-50 text-ink-500">
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-crit text-white text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
        {showNotifs && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-pop border border-ink-100 z-30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-100">
              <span className="text-sm font-semibold text-ink-900">Notificaciones</span>
              {unread > 0 && (
                <button onClick={() => markAllRead(user.id)} className="text-xs text-brand-600 hover:underline">Marcar todas como leídas</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {myNotifs.length === 0 && <div className="px-4 py-6 text-sm text-ink-400 text-center">Sin notificaciones.</div>}
              {myNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { markRead(n.id); if (n.jobId) navigate(`/trabajos/${n.jobId}`); setShowNotifs(false); }}
                  className={`w-full text-left px-4 py-3 border-b border-ink-50 last:border-0 hover:bg-ink-50 flex gap-2 ${!n.read ? 'bg-brand-50/50' : ''}`}
                >
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${!n.read ? 'bg-brand-500' : 'bg-transparent'}`} />
                  <div>
                    <div className="text-sm text-ink-800">{n.text}</div>
                    <div className="text-xs text-ink-400 mt-0.5">{fmtShort(n.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button onClick={() => setShowAccount((v) => !v)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-ink-50">
          <Avatar name={user.name} color={user.avatarColor} size={32} />
          <div className="text-left hidden sm:block">
            <div className="text-sm font-medium text-ink-900 leading-tight">{user.name}</div>
            <div className="text-[11px] text-ink-400 leading-tight">{ROLES.find((r) => r.id === user.role)?.label}</div>
          </div>
          <ChevronDown size={14} className="text-ink-400" />
        </button>
        {showAccount && (
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-pop border border-ink-100 z-30 overflow-hidden">
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="w-full text-left px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 flex items-center gap-2"
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
