import { useState } from 'react';
import { Send } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Avatar } from '../Common/Badges';
import { fmtShort } from '../../lib/dates';
import type { Job } from '../../types';

const MENTIONABLE = [
  { id: 'u-juan', label: '@Coordinación' },
  { id: 'sector-diseno', label: '@Diseño' },
  { id: 'sector-produccion', label: '@Producción' },
  { id: 'sector-instalacion', label: '@Instalación' },
];

export function CommentsPanel({ job }: { job: Job }) {
  const user = useStore((s) => s.currentUser)!;
  const users = useStore((s) => s.users);
  const comments = useStore((s) => s.comments).filter((c) => c.jobId === job.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const addComment = useStore((s) => s.addComment);
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    const mentions = users.filter((u) => text.includes(`@${u.name.split(' ')[0]}`)).map((u) => u.id);
    addComment(job.id, user.id, text.trim(), mentions);
    setText('');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-ink-100 shrink-0">
        <div className="text-sm font-semibold text-ink-800">Comentarios</div>
        <div className="text-[11px] text-ink-400">Reemplaza la cadena de mails para este trabajo</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {comments.length === 0 && <div className="text-xs text-ink-400 text-center py-8">Todavía no hay comentarios.</div>}
        {comments.map((c) => {
          const author = users.find((u) => u.id === c.userId);
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar name={author?.name ?? '?'} color={author?.avatarColor ?? '#999'} size={26} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-ink-800">{author?.name}</span>
                  <span className="text-[10px] text-ink-400">{fmtShort(c.createdAt)}</span>
                </div>
                <div className="text-sm text-ink-700 leading-snug mt-0.5 break-words">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-ink-100 shrink-0">
        <div className="flex flex-wrap gap-1 mb-2">
          {MENTIONABLE.map((m) => (
            <button key={m.id} onClick={() => setText((t) => `${t}${t ? ' ' : ''}${m.label} `)} className="text-[11px] text-brand-600 bg-brand-100 rounded-full px-2 py-0.5 hover:bg-brand-200/70">
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Escribí un comentario... @ para mencionar"
            rows={2}
            className="flex-1 text-sm border border-ink-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
          <button onClick={submit} className="self-end bg-ink-950 text-white rounded-lg p-2.5 hover:bg-ink-800 transition-colors">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
