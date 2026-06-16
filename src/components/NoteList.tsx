import type { Note, Notebook } from '../types';
import { Star, Trash2, Plus, Search } from 'lucide-react';
import { stripHtml } from '../db';

interface Props {
  notes: Note[];
  notebooks: Notebook[];
  activeNoteId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  filterType: string;
  filterValue: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function filterLabel(type: string, value: string, notebooks: Notebook[]) {
  if (type === 'all') return '全部笔记';
  if (type === 'starred') return '已加星标';
  if (type === 'tag') return `# ${value}`;
  const nb = notebooks.find(n => n.id === value);
  return nb ? `${nb.icon} ${nb.name}` : '笔记';
}

export function NoteList({ notes, notebooks, activeNoteId, search, onSearch, onSelect, onNew, onDelete, onToggleStar, filterType, filterValue }: Props) {
  const filtered = search
    ? notes.filter(n => {
        const q = search.toLowerCase();
        return n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q);
      })
    : notes;

  const sorted = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700 truncate">{filterLabel(filterType, filterValue, notebooks)}</h2>
          <button
            onClick={onNew}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors flex-shrink-0"
          >
            <Plus size={13} /> 新建
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="搜索笔记..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-700 placeholder-slate-400 border-none outline-none focus:ring-1 focus:ring-violet-300"
          />
        </div>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <p className="text-sm">{search ? '未找到笔记' : '暂无笔记'}</p>
            {!search && <button onClick={onNew} className="mt-2 text-xs text-violet-500 hover:underline">创建第一篇</button>}
          </div>
        )}
        {sorted.map(note => {
          const preview = stripHtml(note.content).slice(0, 80);
          const active = note.id === activeNoteId;
          return (
            <div
              key={note.id}
              onClick={() => onSelect(note.id)}
              className={`group relative px-3 py-2.5 rounded-xl cursor-pointer transition-all border
                ${active ? 'bg-violet-50 border-violet-200' : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm'}`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <p className={`text-[13px] font-medium leading-snug truncate flex-1 ${active ? 'text-violet-800' : 'text-slate-800'}`}>
                  {note.title || '无标题'}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); onToggleStar(note.id); }}
                  className={`flex-shrink-0 transition-colors ${note.starred ? 'text-amber-400' : 'text-transparent group-hover:text-slate-200 hover:!text-amber-300'}`}
                >
                  <Star size={13} fill={note.starred ? 'currentColor' : 'none'} />
                </button>
              </div>
              {preview && (
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{preview}</p>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-slate-400">{fmtDate(note.updatedAt)}</span>
                {note.tags?.length > 0 && (
                  <div className="flex gap-1">
                    {note.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(note.id); }}
                className="absolute top-2 right-6 opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400 transition-all"
              ><Trash2 size={11} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
