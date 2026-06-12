import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId, getSettings, saveSettings } from './db';
import type { Notebook, Note, TaskItem, AppSettings } from './types';
import { Editor } from './components/Editor';
import { extractTasks } from './ai-engine';
import { Menu, Plus, Search, Settings, Moon, Sun, FileText, Trash2, Circle, CheckCircle2, X } from 'lucide-react';

function App() {
  const [activeNb, setActiveNb] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dark, setDark] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ aiMode: 'rule', llmEndpoint: '', llmApiKey: '', llmModel: 'gpt-4o-mini' });

  useEffect(() => { getSettings().then(setSettings); }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const notebooks = useLiveQuery(() => db.notebooks.orderBy('updatedAt').reverse().toArray()) as Notebook[] ?? [];
  const notes = useLiveQuery(() => activeNb ? db.notes.where('notebookId').equals(activeNb).toArray() : Promise.resolve([] as Note[]), [activeNb]) as Note[] ?? [];
  const activeNoteData = useLiveQuery(() => activeNote ? db.notes.get(activeNote) : undefined, [activeNote]) as Note | undefined;
  const tasks = useLiveQuery(() => activeNb ? db.tasks.where('notebookId').equals(activeNb).toArray() : db.tasks.toArray(), [activeNb]) as TaskItem[] ?? [];
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const doneTasks = tasks.filter(t => t.status === 'done');

  useEffect(() => {
    if (notebooks.length === 0) {
      (async () => {
        const id = genId(); const now = new Date().toISOString();
        await db.notebooks.put({ id, name: '我的笔记本', icon: '📓', createdAt: now, updatedAt: now });
        setActiveNb(id);
      })();
    }
  }, [notebooks.length]);
  useEffect(() => { if (!activeNb && notebooks.length > 0) setActiveNb(notebooks[0].id); }, [activeNb, notebooks]);

  const newNb = async () => {
    const name = prompt('笔记本名称：'); if (!name?.trim()) return;
    const id = genId(); const now = new Date().toISOString();
    await db.notebooks.put({ id, name: name.trim(), icon: '📓', createdAt: now, updatedAt: now });
    setActiveNb(id); setSidebarOpen(false);
  };
  const newNote = async () => {
    if (!activeNb) return;
    const id = genId(); const now = new Date().toISOString();
    await db.notes.put({ id, notebookId: activeNb, title: '', content: '', createdAt: now, updatedAt: now });
    await db.notebooks.update(activeNb, { updatedAt: now });
    setActiveNote(id);
  };
  const updateNote = async (updates: Partial<Note>) => {
    if (!activeNote) return;
    await db.notes.update(activeNote, { ...updates, updatedAt: new Date().toISOString() });
    if (activeNb) await db.notebooks.update(activeNb, { updatedAt: new Date().toISOString() });
  };
  const delNote = async (id: string) => {
    await db.notes.delete(id); await db.tasks.where('noteId').equals(id).delete();
    if (activeNote === id) setActiveNote(null);
  };
  const extractFromNote = async (noteId: string) => {
    const note = await db.notes.get(noteId);
    if (!note) return;
    const text = note.content.replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' ').trim();
    if (!text) return;
    const items = await extractTasks(text, settings);
    const now = new Date().toISOString();
    for (const item of items) {
      await db.tasks.put({ id: genId(), noteId: noteId, notebookId: note.notebookId, title: item.title, priority: item.priority, status: 'pending', dueDate: item.dueDate, createdAt: now });
    }
    setTaskOpen(true);
  };
  const toggleTask = async (id: string) => { const t = await db.tasks.get(id); if (t) await db.tasks.update(id, { status: t.status === 'done' ? 'pending' : 'done' }); };
  const delTask = async (id: string) => { await db.tasks.delete(id); };

  const filtered = search ? notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase())) : notes;
  const currentNb = notebooks.find(n => n.id === activeNb);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top nav */}
      <header className="flex items-center h-11 px-3 gap-2 flex-shrink-0 bg-purple-700 text-white select-none">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1 rounded hover:bg-white/15"><Menu size={16} /></button>
        <span className="font-bold text-sm mr-3">⚡ 翼记</span>
        <div className="flex items-center gap-0 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
          {notebooks.map(nb => (
            <button key={nb.id} onClick={() => setActiveNb(nb.id)}
              className={`flex items-center gap-1 px-3 py-1 rounded-t text-xs font-medium whitespace-nowrap transition-colors ${activeNb === nb.id ? 'bg-white text-purple-700' : 'text-white/80 hover:bg-white/10'}`}>{nb.icon} {nb.name}</button>
          ))}
          <button onClick={newNb} className="p-1 rounded text-white/60 hover:bg-white/10"><Plus size={14} /></button>
        </div>
        <div className="relative hidden sm:block">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..."
            className="w-36 pl-7 pr-2 py-1 rounded text-xs bg-white/15 text-white placeholder-white/40 border border-white/20" />
        </div>
        <button onClick={() => setTaskOpen(!taskOpen)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${taskOpen ? 'bg-white/20' : 'text-white/80 hover:bg-white/10'}`}>
          📋 {pendingTasks.length > 0 && <span className="bg-red-400 text-white text-[10px] min-w-[16px] h-[16px] rounded-full flex items-center justify-center">{pendingTasks.length}</span>}
        </button>
        <button onClick={() => setDark(!dark)} className="p-1 rounded text-white/60 hover:bg-white/10">{dark ? <Sun size={14} /> : <Moon size={14} />}</button>
        <button onClick={() => setSettingsOpen(true)} className="p-1 rounded text-white/60 hover:bg-white/10"><Settings size={14} /></button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-auto" onClick={e => e.stopPropagation()}>
              <MobileSidebar notebooks={notebooks} notes={filtered} activeNb={activeNb} activeNote={activeNote}
                tasks={pendingTasks} onSelectNb={(id: string) => { setActiveNb(id); setSidebarOpen(false); }}
                onSelectNote={(id: string) => { setActiveNote(id); setSidebarOpen(false); }}
                onNewNb={newNb} onNewNote={newNote} onDeleteNote={delNote}
                onToggleTask={toggleTask} onDeleteTask={delTask} onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        <div className="hidden lg:flex w-56 flex-shrink-0 border-r border-slate-200 flex-col bg-slate-50/50">
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">{currentNb?.icon} {currentNb?.name || '笔记'}</h2>
              <span className="text-[11px] text-slate-400">{notes.length}</span>
            </div>
            <button onClick={newNote}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors">
              <Plus size={13} /> 新建笔记
            </button>
          </div>
          <div className="flex-1 overflow-auto py-1">
            {filtered.map(note => (
              <div key={note.id} onClick={() => setActiveNote(note.id)}
                className={`group flex items-start gap-2 px-3 py-2 mx-1 rounded-md cursor-pointer transition-colors ${activeNote === note.id ? 'bg-purple-50 border border-purple-100' : 'hover:bg-slate-100 border border-transparent'}`}>
                <FileText size={13} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] truncate ${activeNote === note.id ? 'font-medium text-purple-700' : 'text-slate-700'}`}>{note.title || '无标题'}</p>
                  <p className="text-[10px] text-slate-400">{new Date(note.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); delNote(note.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400"><Trash2 size={11} /></button>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-8">暂无笔记</p>}
          </div>
        </div>

        <Editor note={activeNoteData || null} onUpdate={updateNote} onExtractTasks={extractFromNote} settings={settings} />

        {taskOpen && (
          <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">📋 待办 ({pendingTasks.length})</h3>
              <button onClick={() => setTaskOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {pendingTasks.map(t => (
                <div key={t.id} className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 group">
                  <button onClick={() => toggleTask(t.id)} className="mt-0.5 text-slate-300 hover:text-green-500"><Circle size={14} /></button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-700">{t.title}</p>
                    {t.dueDate && <p className="text-[10px] text-slate-400">📅 {t.dueDate.slice(5)}</p>}
                  </div>
                  <button onClick={() => delTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
              ))}
              {pendingTasks.length === 0 && <p className="text-center text-xs text-slate-400 py-8">暂无待办</p>}
              {doneTasks.length > 0 && (
                <details className="mt-3">
                  <summary className="text-[11px] text-slate-400 cursor-pointer px-2">已完成 ({doneTasks.length})</summary>
                  {doneTasks.slice(0, 10).map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1"><CheckCircle2 size={12} className="text-green-400" /><span className="text-[11px] text-slate-400 line-through truncate">{t.title}</span></div>
                  ))}
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">设置</h2>
            <div className="space-y-4">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                {[{ k: 'rule', l: '规则引擎（离线）' }, { k: 'llm', l: 'LLM 大模型' }].map(({ k, l }) => (
                  <button key={k} onClick={() => setSettings(s => ({ ...s, aiMode: k as 'rule' | 'llm' }))}
                    className={`flex-1 py-2 text-xs rounded-md font-medium ${settings.aiMode === k ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>{l}</button>
                ))}
              </div>
              {settings.aiMode === 'llm' && (
                <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                  <input value={settings.llmEndpoint} onChange={e => setSettings(s => ({ ...s, llmEndpoint: e.target.value }))} placeholder="API 地址" className="w-full text-xs border rounded px-3 py-2" />
                  <input value={settings.llmApiKey} onChange={e => setSettings(s => ({ ...s, llmApiKey: e.target.value }))} type="password" placeholder="API Key" className="w-full text-xs border rounded px-3 py-2" />
                  <input value={settings.llmModel} onChange={e => setSettings(s => ({ ...s, llmModel: e.target.value }))} placeholder="模型名称" className="w-full text-xs border rounded px-3 py-2" />
                </div>
              )}
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs font-medium text-purple-700">翼记 v3.0 · 省公司自研</p>
                <p className="text-[11px] text-purple-500 mt-1">块编辑器 + AI任务提取 + 本地存储</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 text-sm text-slate-500">取消</button>
              <button onClick={() => { saveSettings(settings); setSettingsOpen(false); }} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg font-medium">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileSidebar(props: any) {
  const { notebooks, activeNb, onSelectNb, onNewNb, onNewNote, tasks, onToggleTask, onDeleteTask, onClose } = props;
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><span className="text-lg">⚡</span><div><h1 className="text-sm font-bold">翼记</h1><p className="text-[10px] text-slate-400">省公司自研</p></div></div>
          <button onClick={onClose} className="p-1 text-slate-400"><X size={16} /></button>
        </div>
        <button onClick={onNewNote} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium bg-purple-600 text-white">新建笔记</button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between px-1 mb-1"><span className="text-[10px] font-semibold uppercase text-slate-400">笔记本</span><button onClick={onNewNb} className="p-0.5 text-slate-400"><Plus size={13} /></button></div>
          {notebooks.map((nb: Notebook) => (
            <button key={nb.id} onClick={() => onSelectNb(nb.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs ${activeNb === nb.id ? 'bg-purple-50 text-purple-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>{nb.icon} {nb.name}</button>
          ))}
        </div>
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase text-slate-400 px-1">待办 ({tasks.length})</span>
          {tasks.slice(0, 8).map((t: TaskItem) => (
            <div key={t.id} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-50 group">
              <button onClick={() => onToggleTask(t.id)} className="text-slate-300"><Circle size={11} /></button>
              <span className="text-[11px] text-slate-600 truncate flex-1">{t.title}</span>
              <button onClick={() => onDeleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300"><X size={10} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
