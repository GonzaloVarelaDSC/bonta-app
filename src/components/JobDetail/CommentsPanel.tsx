import { useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Avatar } from '../Common/Badges';
import { fmtShort } from '../../lib/dates';
import type { Job, RoleId, User } from '../../types';

// Menciones por sector — antes eran decorativas: insertaban el texto "@Diseño"
// etc. pero `submit()` solo generaba una mención (y por lo tanto notificación,
// ver `insertNotifications` en `addComment`) si el texto matcheaba el nombre de
// pila de un usuario real, así que clickear estos chips nunca avisaba a nadie
// (hallazgo de la Fase 5, 17/09). Ahora mencionan a todos los usuarios activos de
// ese `role` — más predecible que matchear contra `sector` (texto libre editable,
// ver CLAUDE.md sección 20) porque `role` es un enum fijo.
const MENTIONABLE: { role: RoleId; label: string }[] = [
  { role: 'coordinador', label: '@Coordinación' },
  { role: 'diseno', label: '@Diseño' },
  { role: 'produccion', label: '@Producción' },
  { role: 'instalacion', label: '@Instalación' },
];

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Punto en el texto donde arranca un "@nombre" que todavía se está tipeando —
// null si el cursor no está dentro de uno. Un espacio (o un segundo @) corta el
// token, mismo criterio que WhatsApp/Slack.
function activeMentionToken(text: string, cursor: number): { query: string; start: number } | null {
  const uptoCursor = text.slice(0, cursor);
  const at = uptoCursor.lastIndexOf('@');
  if (at === -1) return null;
  const token = uptoCursor.slice(at + 1);
  if (/\s/.test(token)) return null;
  return { query: token, start: at };
}

export function CommentsPanel({ job }: { job: Job }) {
  const user = useStore((s) => s.currentUser)!;
  const users = useStore((s) => s.users);
  const comments = useStore((s) => s.comments).filter((c) => c.jobId === job.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const addComment = useStore((s) => s.addComment);
  const [text, setText] = useState('');
  // Menciones individuales confirmadas por autocompletado (punto 5, 20/09) — la
  // mención queda atada al ID real del usuario, elegido del dropdown, no a un
  // matcheo de texto (eso es justo lo que pedía el punto: "vinculada al usuario
  // real mediante su ID"). Mapa id → nombre insertado, para poder validar en
  // submit() que la mención sigue de verdad en el texto (por si se borra a mano
  // después de insertarla).
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map());
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = normalize(mention.query);
    return users.filter((u) => u.active && (q === '' || normalize(u.name).includes(q))).slice(0, 6);
  }, [mention, users]);

  function handleTextChange(value: string, cursor: number) {
    setText(value);
    const token = activeMentionToken(value, cursor);
    setMention(token);
    setHighlight(0);
  }

  function selectMention(u: User) {
    if (!mention) return;
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const firstName = u.name.split(' ')[0];
    const before = text.slice(0, mention.start);
    const after = text.slice(cursor);
    const inserted = `@${firstName} `;
    const newText = before + inserted + after;
    setText(newText);
    setMentionedUsers((m) => new Map(m).set(u.id, firstName));
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    if (!text.trim()) return;
    // Solo cuentan las que se eligieron del dropdown Y siguen presentes en el
    // texto final (si se borró el "@Nombre" a mano después de insertarlo, no
    // corresponde notificar a esa persona).
    const individualMentions = [...mentionedUsers.entries()]
      .filter(([, label]) => text.includes(`@${label}`))
      .map(([id]) => id);
    const roleMentions = MENTIONABLE
      .filter((m) => text.includes(m.label))
      .flatMap((m) => users.filter((u) => u.active && u.role === m.role).map((u) => u.id));
    const mentions = [...new Set([...individualMentions, ...roleMentions])].filter((id) => id !== user.id);
    addComment(job.id, user.id, text.trim(), mentions);
    setText('');
    setMentionedUsers(new Map());
    setMention(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-ink-100 shrink-0">
        <div className="text-sm font-semibold text-ink-800">Comentarios</div>
        <div className="text-[11px] text-ink-700">Reemplaza la cadena de mails para este trabajo</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {comments.length === 0 && <div className="text-xs text-ink-700 text-center py-8">Todavía no hay comentarios.</div>}
        {comments.map((c) => {
          const author = users.find((u) => u.id === c.userId);
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar name={author?.name ?? '?'} color={author?.avatarColor ?? '#999'} size={26} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-ink-800">{author?.name}</span>
                  <span className="text-[10px] text-ink-700">{fmtShort(c.createdAt)}</span>
                </div>
                <div className="text-sm text-ink-700 leading-snug mt-0.5 break-words">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-ink-100 shrink-0 relative">
        {mention && mentionMatches.length > 0 && (
          <div
            role="listbox" aria-label="Usuarios para mencionar"
            className="absolute left-3 right-3 bottom-full mb-1 bg-white rounded-lg shadow-pop border border-ink-100 overflow-hidden z-30"
          >
            {mentionMatches.map((u, i) => (
              <button
                key={u.id} type="button" role="option" aria-selected={i === highlight}
                onMouseDown={(e) => { e.preventDefault(); selectMention(u); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm ${i === highlight ? 'bg-brand-50' : 'hover:bg-ink-50'}`}
              >
                <Avatar name={u.name} color={u.avatarColor} size={22} />
                <span className="text-ink-900">{u.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 mb-2">
          {MENTIONABLE.map((m) => (
            <button key={m.role} onClick={() => setText((t) => `${t}${t ? ' ' : ''}${m.label} `)} className="text-[11px] text-brand-600 bg-brand-100 rounded-full px-2 py-0.5 hover:bg-brand-200/70">
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={(e) => {
              if (mention && mentionMatches.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((i) => (i + 1) % mentionMatches.length); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(mentionMatches[highlight]); return; }
                if (e.key === 'Escape') { setMention(null); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Escribí un comentario... @ para mencionar"
            aria-label="Escribir un comentario"
            rows={2}
            className="flex-1 text-sm border border-ink-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={submit} aria-label="Enviar comentario" className="self-end bg-ink-950 text-white rounded-lg p-2.5 hover:bg-ink-800 transition-colors">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
