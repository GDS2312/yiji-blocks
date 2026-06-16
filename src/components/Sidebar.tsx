import { useState } from 'react';
import type { Notebook, Note } from '../types';
import { Plus, Star, FileText, Hash, Settings, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

interface Props {
  notebooks: Notebook[];
  notes: Note[];
  filterType: string;
  filterValue: string;
  onFilter: (type: string, value: string) => void;
  onNewNotebook: () => void;
  onDeleteNotebook: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ notebooks, notes, filterType, filterValue, onFilter, onNewNotebook, onDeleteNotebook, onOpenSettings }: Props) {
  const [nbOpen, setNbOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).sort();
  const starredCount = notes.filter(n => n.starred).length;

  const navItem = (type: string, value: string, icon: React.ReactNode, label: string, count?: number) => {
    const active = filterType === type && filterValue === value;
    return (
      <button
        onClick={() => onFilter(type, value)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-left group
          ${active ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        <span className="flex-shrink-0 opacity-70">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className={`text-[11px] px-1.5 rounded-full ${active ? 'bg-violet-200 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Brand */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm font-bold">翼</div>
          <span className="font-bold text-slate-800">翼记</span>
          <span className="text-[10px] text-slate-400 ml-auto">v4.0</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4">
        {/* Core filters */}
        {navItem('all', '', <FileText size={15} />, '全部笔记', notes.length)}
        {navItem('starred', '', <Star size={15} />, '已加星标', starredCount)}

        {/* Notebooks */}
        <div className="mt-3">
          <button
            onClick={() => setNbOpen(v => !v)}
            className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
          >
            {nbOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            笔记本
          </button>
          {nbOpen && (
            <div className="mt-0.5 space-y-0.5">
              {notebooks.map(nb => {
                const count = notes.filter(n => n.notebookId === nb.id).length;
                const active = filterType === 'notebook' && filterValue === nb.id;
                return (
                  <div key={nb.id} className="group flex items-center">
                    <button
                      onClick={() => onFilter('notebook', nb.id)}
                      className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left min-w-0
                        ${active ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span className="text-base leading-none">{nb.icon}</span>
                      <span className="flex-1 truncate">{nb.name}</span>
                      <span className={`text-[11px] px-1.5 rounded-full ${active ? 'bg-violet-200 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                    </button>
                    <button
                      onClick={() => onDeleteNotebook(nb.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-slate-300 hover:text-red-400 rounded transition-all"
                    ><Trash2 size={12} /></button>
                  </div>
                );
              })}
              <button
                onClick={onNewNotebook}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
              >
                <Plus size={14} /> 新建笔记本
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setTagsOpen(v => !v)}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
            >
              {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              标签
            </button>
            {tagsOpen && (
              <div className="mt-0.5 space-y-0.5">
                {allTags.map(tag => {
                  const count = notes.filter(n => n.tags?.includes(tag)).length;
                  return (
                    <div key={tag}>
                      {navItem('tag', tag, <Hash size={13} />, tag, count)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="px-2 pb-3 border-t border-slate-100 pt-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Settings size={15} />
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}
