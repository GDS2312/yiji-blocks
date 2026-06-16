import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId, getSettings, saveSettings } from './db';
import type { Notebook, Note, AppSettings } from './types';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { Menu, X, ChevronLeft, Moon, Sun, Plus } from 'lucide-react';

type MobileView = 'sidebar' | 'list' | 'editor';

const NOTEBOOK_ICONS = ['📓','📔','📒','📕','📗','📘','📙','🗒️','📑','📋'];

export default function App() {
  const [filterType, setFilterType] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ theme: 'light', speechLang: 'zh-CN' });

  useEffect(() => { getSettings().then(setSettings); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const notebooks = (useLiveQuery(() => db.notebooks.orderBy('updatedAt').reverse().toArray()) ?? []) as Notebook[];
  const allNotes = (useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray()) ?? []) as Note[];

  const filteredNotes: Note[] = (() => {
    let base = allNotes;
    if (filterType === 'starred') base = base.filter(n => n.starred);
    else if (filterType === 'notebook') base = base.filter(n => n.notebookId === filterValue);
    else if (filterType === 'tag') base = base.filter(n => n.tags?.includes(filterValue));
    return base;
  })();

  const activeNote = allNotes.find(n => n.id === activeNoteId) ?? null;

  // Bootstrap default notebook
  useEffect(() => {
    if (notebooks.length === 0) {
      const id = genId(); const now = new Date().toISOString();
      db.notebooks.put({ id, name: '我的笔记本', icon: '📓', color: '#7c3aed', createdAt: now, updatedAt: now });
    }
  }, [notebooks.length]);

  const handleFilter = (type: string, value: string) => {
    setFilterType(type); setFilterValue(value);
    setActiveNoteId(null); setSidebarOpen(false);
  };

  const newNote = async () => {
    const nbId = filterType === 'notebook' ? filterValue : (notebooks[0]?.id ?? '');
    if (!nbId) return;
    const id = genId(); const now = new Date().toISOString();
    await db.notes.put({ id, notebookId: nbId, title: '', content: '', tags: [], starred: false, createdAt: now, updatedAt: now });
    await db.notebooks.update(nbId, { updatedAt: now });
    setActiveNoteId(id);
    setMobileView('editor');
  };

  const updateNote = async (updates: Partial<Note>) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    await db.notes.update(activeNoteId, { ...updates, updatedAt: now });
    const note = await db.notes.get(activeNoteId);
    if (note) await db.notebooks.update(note.notebookId, { updatedAt: now });
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const toggleStar = async (id: string) => {
    const n = await db.notes.get(id);
    if (n) await db.notes.update(id, { starred: !n.starred });
  };

  const newNotebook = async () => {
    const name = prompt('笔记本名称：');
    if (!name?.trim()) return;
    const icon = NOTEBOOK_ICONS[Math.floor(Math.random() * NOTEBOOK_ICONS.length)];
    const id = genId(); const now = new Date().toISOString();
    await db.notebooks.put({ id, name: name.trim(), icon, color: '#7c3aed', createdAt: now, updatedAt: now });
    handleFilter('notebook', id);
  };

  const deleteNotebook = async (id: string) => {
    if (!confirm('删除此笔记本？笔记将被移动到默认笔记本。')) return;
    const defaultNb = notebooks.find(n => n.id !== id);
    if (defaultNb) {
      await db.notes.where('notebookId').equals(id).modify({ notebookId: defaultNb.id });
    }
    await db.notebooks.delete(id);
    if (filterType === 'notebook' && filterValue === id) handleFilter('all', '');
  };

  const selectNote = (id: string) => {
    setActiveNoteId(id);
    setMobileView('editor');
  };

  return (
    <div className={`flex h-screen overflow-hidden bg-white ${settings.theme === 'dark' ? 'dark' : ''}`}>
      {/* Desktop: three-panel layout */}
      <div className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-slate-200 bg-slate-50">
        <Sidebar
          notebooks={notebooks} notes={allNotes}
          filterType={filterType} filterValue={filterValue}
          onFilter={handleFilter} onNewNotebook={newNotebook}
          onDeleteNotebook={deleteNotebook} onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50/50">
        <NoteList
          notes={filteredNotes} notebooks={notebooks}
          activeNoteId={activeNoteId} search={search}
          onSearch={setSearch} onSelect={selectNote}
          onNew={newNote} onDelete={deleteNote}
          onToggleStar={toggleStar}
          filterType={filterType} filterValue={filterValue}
        />
      </div>

      <div className="hidden lg:flex flex-1 overflow-hidden">
        <Editor note={activeNote} onUpdate={updateNote} onToggleStar={toggleStar} settings={settings} />
      </div>

      {/* Mobile layout */}
      <div className="flex lg:hidden flex-col w-full">
        {/* Mobile top bar */}
        <header className="flex items-center gap-2 px-3 h-12 border-b border-slate-200 bg-white flex-shrink-0">
          {mobileView === 'editor' ? (
            <button onClick={() => setMobileView('list')} className="p-1.5 text-slate-500"><ChevronLeft size={20} /></button>
          ) : (
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-slate-500"><Menu size={18} /></button>
          )}
          <div className="flex items-center gap-1.5 flex-1">
            <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center text-white text-xs font-bold">翼</div>
            <span className="font-semibold text-sm text-slate-800">
              {mobileView === 'editor' ? (activeNote?.title || '无标题') : '翼记'}
            </span>
          </div>
          <button
            onClick={() => { setSidebarOpen(false); setSettingsOpen(true); }}
            className="p-1.5 text-slate-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
        </header>

        {/* Mobile panels */}
        {mobileView === 'list' && (
          <div className="flex-1 overflow-hidden bg-slate-50/50">
            <NoteList
              notes={filteredNotes} notebooks={notebooks}
              activeNoteId={activeNoteId} search={search}
              onSearch={setSearch} onSelect={selectNote}
              onNew={newNote} onDelete={deleteNote}
              onToggleStar={toggleStar}
              filterType={filterType} filterValue={filterValue}
            />
          </div>
        )}
        {mobileView === 'editor' && (
          <div className="flex-1 overflow-hidden">
            <Editor note={activeNote} onUpdate={updateNote} onToggleStar={toggleStar} settings={settings} />
          </div>
        )}

        {/* Mobile FAB */}
        {mobileView === 'list' && (
          <button
            onClick={newNote}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-200 flex items-center justify-center hover:bg-violet-700 active:scale-95 transition-all z-40"
          ><Plus size={24} /></button>
        )}
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="font-semibold text-slate-800">翼记</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-400"><X size={18} /></button>
            </div>
            <Sidebar
              notebooks={notebooks} notes={allNotes}
              filterType={filterType} filterValue={filterValue}
              onFilter={handleFilter} onNewNotebook={newNotebook}
              onDeleteNotebook={deleteNotebook} onOpenSettings={() => { setSidebarOpen(false); setSettingsOpen(true); }}
            />
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 mb-5">设置</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">界面主题</label>
                <div className="flex gap-2">
                  {(['light', 'dark'] as const).map(t => (
                    <button key={t} onClick={() => setSettings(s => ({ ...s, theme: t }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors border-2
                        ${settings.theme === t ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'}`}>
                      {t === 'light' ? <Sun size={15} /> : <Moon size={15} />}
                      {t === 'light' ? '浅色' : '深色'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">语音识别语言</label>
                <select
                  value={settings.speechLang}
                  onChange={e => setSettings(s => ({ ...s, speechLang: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-300"
                >
                  <option value="zh-CN">中文（普通话）</option>
                  <option value="zh-TW">中文（繁体）</option>
                  <option value="en-US">English (US)</option>
                  <option value="ja-JP">日本語</option>
                </select>
              </div>
              <div className="pt-2 border-t border-slate-100 text-center">
                <p className="text-[11px] text-slate-400">翼记 v4.0 · 本地存储 · 无需登录</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 text-sm text-slate-500">取消</button>
              <button onClick={() => { saveSettings(settings); setSettingsOpen(false); }}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
