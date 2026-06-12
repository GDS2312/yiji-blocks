import { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import type { Note, AppSettings } from '../types';
import { Mic, ImageIcon, Sparkles, Loader2, Download, Bold, Italic, Strikethrough, Code, List, ListOrdered, CheckSquare, Quote, Undo, Redo } from 'lucide-react';
import { analyzeImage as aiAnalyze } from '../ai-engine';

interface EditorProps {
  note: Note | null;
  onUpdate: (updates: Partial<Note>) => void;
  onExtractTasks: (noteId: string) => void;
  settings: AppSettings;
}

export function Editor({ note, onUpdate, onExtractTasks, settings }: EditorProps) {
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [voiceResult, setVoiceResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: '输入 / 选择块类型，或直接开始写作...' }),
      TaskList, TaskItem.configure({ nested: true }),
      Highlight, Link.configure({ openOnClick: false }),
      Image.configure({ allowBase64: true }),
      Underline,
    ],
    content: note?.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (note && html !== note.content) onUpdate({ content: html });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[400px] px-8 py-6 text-[15px] leading-relaxed',
      },
    },
  });

  // Sync content when note changes
  if (editor && note && editor.getHTML() !== note.content && !editor.isFocused) {
    editor.commands.setContent(note.content || '');
  }

  const handleExtract = async () => {
    if (!note || !editor) return;
    setExtracting(true);
    const text = editor.getText();
    if (text.trim()) {
      await new Promise(r => setTimeout(r, 200));
      onExtractTasks(note.id);
    }
    setExtracting(false);
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      editor.chain().focus().setImage({ src: dataUrl }).run();
      if (settings.aiMode === 'llm' && settings.llmEndpoint) {
        const text = await aiAnalyze(dataUrl, settings);
        if (text) {
          onUpdate({ content: editor.getHTML() });
          setVoiceResult('📷 识别结果：' + text);
        }
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (settings.aiMode === 'llm' && settings.llmEndpoint) {
          try {
            const reader = new FileReader();
            const b64 = await new Promise<string>(r => { reader.onloadend = () => r(reader.result as string); });
            reader.readAsDataURL(blob);
            const base64 = await b64;
            const resp = await fetch(settings.llmEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + settings.llmApiKey },
              body: JSON.stringify({ model: settings.llmModel, messages: [{ role: 'user', content: [
                { type: 'text', text: '转写音频为文字，只输出结果。' },
                { type: 'input_audio', input_audio: { data: base64.split(',')[1], format: 'webm' } },
              ]}]}),
            });
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || '';
            if (text) {
              setVoiceResult(text);
              return;
            }
          } catch {}
        }
        setVoiceResult('__MANUAL__');
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch { alert('无法访问麦克风'); }
  };

  const stopRec = () => {
    if (recRef.current?.state === 'recording') recRef.current.stop();
    setRecording(false);
  };

  const confirmVoice = (text: string) => {
    if (editor) {
      editor.commands.insertContent(`<p>${text}</p>`);
    }
    setVoiceResult(null);
  };

  const handleExport = () => {
    if (!note) return;
    const md = `# ${note.title || '无标题'}\n\n${editor?.getText() || ''}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${note.title || '笔记'}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  if (!note) {
    return <div className="flex-1 flex items-center justify-center bg-white text-slate-400">选择笔记开始编辑</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-slate-100 flex-wrap bg-white sticky top-0 z-10">
        <div className="flex items-center gap-0.5">
          {[
            { icon: Bold, action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
            { icon: Italic, action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
            { icon: Strikethrough, action: () => editor?.chain().focus().toggleStrike().run(), active: editor?.isActive('strike') },
            { icon: Code, action: () => editor?.chain().focus().toggleCode().run(), active: editor?.isActive('code') },
          ].map(({ icon: Icon, action, active }, i) => (
            <button key={i} onClick={action}
              className={`p-1.5 rounded transition-colors ${active ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon size={15} />
            </button>
          ))}
        </div>
        <div className="w-px h-5 mx-1 bg-slate-200" />
        <div className="flex items-center gap-0.5">
          {[
            { icon: List, action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
            { icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
            { icon: CheckSquare, action: () => editor?.chain().focus().toggleTaskList().run(), active: editor?.isActive('taskList') },
            { icon: Quote, action: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
          ].map(({ icon: Icon, action, active }, i) => (
            <button key={i} onClick={action}
              className={`p-1.5 rounded transition-colors ${active ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon size={15} />
            </button>
          ))}
        </div>
        <div className="w-px h-5 mx-1 bg-slate-200" />
        <button onClick={() => editor?.chain().focus().undo().run()} className="p-1.5 rounded text-slate-500 hover:bg-slate-100"><Undo size={15} /></button>
        <button onClick={() => editor?.chain().focus().redo().run()} className="p-1.5 rounded text-slate-500 hover:bg-slate-100"><Redo size={15} /></button>
        <div className="flex-1" />
        <button onClick={handleExport} className="p-1.5 rounded text-slate-400 hover:text-slate-600" title="导出 Markdown"><Download size={15} /></button>
        <button onClick={handleExtract} disabled={extracting}
          className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50">
          {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          AI 提取任务
        </button>
      </div>

      {/* Voice result toast */}
      {voiceResult && (
        <div className="mx-4 mt-2 p-3 rounded-lg border border-green-200 bg-green-50 animate-slideUp">
          {voiceResult === '__MANUAL__' ? (
            <div>
              <p className="text-sm font-medium mb-2">录音完成，请输入内容：</p>
              <textarea id="voiceInput" rows={2} className="w-full text-sm border rounded p-2 mb-2 resize-none" placeholder="输入录音内容..." />
              <div className="flex gap-2">
                <button onClick={() => { const v = (document.getElementById('voiceInput') as HTMLTextAreaElement)?.value?.trim(); if (v) confirmVoice(v); }}
                  className="px-3 py-1 rounded text-xs font-medium bg-purple-600 text-white">插入</button>
                <button onClick={() => setVoiceResult(null)} className="px-3 py-1 rounded text-xs text-slate-500 border">取消</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm mb-2 p-2 bg-white rounded border">{voiceResult}</p>
              <div className="flex gap-2">
                <button onClick={() => confirmVoice(voiceResult)} className="px-3 py-1 rounded text-xs font-medium bg-purple-600 text-white">插入笔记</button>
                <button onClick={() => setVoiceResult(null)} className="px-3 py-1 rounded text-xs text-slate-500 border">取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100 bg-slate-50/50">
        <button onClick={recording ? stopRec : startRec}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            recording ? 'bg-red-500 text-white' : 'text-slate-500 border border-slate-200 hover:bg-slate-100'
          }`}>
          <Mic size={13} />
          {recording ? `停止 ${fmtTime(recTime)}` : '语音录入'}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-100">
          <ImageIcon size={13} />
          {uploading ? '识别中' : '插入图片'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <div className="flex-1" />
        <span className="text-[11px] text-slate-400">
          {editor?.getText().replace(/\s/g, '').length || 0} 字 · 块编辑器
        </span>
      </div>
    </div>
  );
}
