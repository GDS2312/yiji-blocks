import { useRef, useState, useEffect, useCallback } from 'react';
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
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  List, ListOrdered, CheckSquare, Quote, Minus, Undo, Redo,
  Heading1, Heading2, Heading3,
  Mic, MicOff, ImageIcon, Download, Star, Tag, X, Loader2
} from 'lucide-react';

interface Props {
  note: Note | null;
  onUpdate: (updates: Partial<Note>) => void;
  onToggleStar: (id: string) => void;
  settings: AppSettings;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function Editor({ note, onUpdate, onToggleStar, settings }: Props) {
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<any>(null);
  const noteIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
      Placeholder.configure({ placeholder: '开始写作，或输入 / 选择块类型...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Link.configure({ openOnClick: false }),
      Image.configure({ allowBase64: true }),
      Underline,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (noteIdRef.current) {
        onUpdate({ content: editor.getHTML() });
      }
    },
    editorProps: {
      attributes: { class: 'yiji-editor focus:outline-none' },
    },
  });

  // Sync note content when switching notes
  useEffect(() => {
    if (!editor) return;
    if (note?.id !== noteIdRef.current) {
      noteIdRef.current = note?.id ?? null;
      editor.commands.setContent(note?.content || '');
    }
  }, [editor, note?.id, note?.content]);

  // Paste image from clipboard
  useEffect(() => {
    if (!editor) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = ev => {
            editor.chain().focus().setImage({ src: ev.target?.result as string }).run();
          };
          reader.readAsDataURL(file);
          e.preventDefault();
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [editor]);

  // Voice input via Web Speech API
  const startVoice = useCallback(() => {
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别，请使用 Chrome 或 Edge');
      return;
    }
    const recog = new SpeechRecognition();
    recog.lang = settings.speechLang || 'zh-CN';
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.continuous = false;

    recog.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setVoiceInterim(interim);
      if (final) {
        editor?.chain().focus().insertContent(`<p>${final}</p>`).run();
        setVoiceInterim('');
      }
    };
    recog.onerror = () => { setVoiceActive(false); setVoiceInterim(''); };
    recog.onend = () => { setVoiceActive(false); setVoiceInterim(''); };

    recogRef.current = recog;
    recog.start();
    setVoiceActive(true);
  }, [editor, settings.speechLang]);

  const stopVoice = () => {
    recogRef.current?.stop();
    setVoiceActive(false);
    setVoiceInterim('');
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      editor.chain().focus().setImage({ src: ev.target?.result as string }).run();
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExport = () => {
    if (!note || !editor) return;
    const md = `# ${note.title || '无标题'}\n\n${editor.getText()}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${note.title || '笔记'}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || !note) return;
    const tags = Array.from(new Set([...(note.tags || []), tag]));
    onUpdate({ tags });
    setTagInput('');
    setShowTagInput(false);
  };

  const removeTag = (tag: string) => {
    if (!note) return;
    onUpdate({ tags: note.tags.filter(t => t !== tag) });
  };

  const wordCount = editor?.getText().replace(/\s/g, '').length || 0;

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-400 select-none">
        <div className="text-5xl mb-4">📝</div>
        <p className="text-sm">选择一篇笔记开始编辑</p>
        <p className="text-xs mt-1 text-slate-300">或在左侧创建新笔记</p>
      </div>
    );
  }

  const ToolBtn = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title?: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
    >{children}</button>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Title bar */}
      <div className="px-8 pt-6 pb-2 flex-shrink-0 border-b border-slate-100">
        <div className="flex items-start gap-2">
          <input
            value={note.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="无标题"
            className="flex-1 text-2xl font-bold text-slate-800 outline-none placeholder-slate-300 bg-transparent"
          />
          <button
            onClick={() => onToggleStar(note.id)}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${note.starred ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-amber-400'}`}
          ><Star size={18} fill={note.starred ? 'currentColor' : 'none'} /></button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {new Date(note.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {wordCount > 0 && ` · ${wordCount} 字`}
        </p>
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {(note.tags || []).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X size={10} /></button>
            </span>
          ))}
          {showTagInput ? (
            <input
              autoFocus
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setShowTagInput(false); }}
              onBlur={addTag}
              placeholder="添加标签"
              className="text-[11px] px-2 py-0.5 border border-violet-300 rounded-full outline-none w-20"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-violet-500 px-1.5 py-0.5 rounded-full hover:bg-violet-50 transition-colors"
            ><Tag size={11} /> 标签</button>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-slate-100 flex-wrap flex-shrink-0 bg-slate-50/60">
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="标题 1">
          <Heading1 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="标题 2">
          <Heading2 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="标题 3">
          <Heading3 size={15} />
        </ToolBtn>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="粗体 Ctrl+B">
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="斜体 Ctrl+I">
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="下划线 Ctrl+U">
          <UnderlineIcon size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="删除线">
          <Strikethrough size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHighlight().run()} active={editor?.isActive('highlight')} title="高亮">
          <span className="text-[13px] font-bold bg-yellow-200 px-0.5 rounded">A</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="行内代码">
          <Code size={15} />
        </ToolBtn>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="无序列表">
          <List size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="有序列表">
          <ListOrdered size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')} title="任务清单">
          <CheckSquare size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="引用">
          <Quote size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="分割线">
          <Minus size={15} />
        </ToolBtn>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="撤销 Ctrl+Z">
          <Undo size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="重做 Ctrl+Y">
          <Redo size={15} />
        </ToolBtn>
        <div className="flex-1" />
        <button onClick={handleExport} title="导出 Markdown" className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <Download size={15} />
        </button>
      </div>

      {/* Voice interim overlay */}
      {voiceInterim && (
        <div className="mx-8 mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 animate-pulse flex-shrink-0">
          🎙️ {voiceInterim}...
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-4">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Bottom multimodal bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
        <button
          onClick={voiceActive ? stopVoice : startVoice}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${voiceActive ? 'bg-red-500 text-white shadow-md shadow-red-200 animate-pulse' : 'text-slate-600 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}
        >
          {voiceActive ? <><MicOff size={13} /> 停止朗读</> : <><Mic size={13} /> 语音输入</>}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
          插入图片
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <span className="text-[11px] text-slate-400 ml-auto">Ctrl+V 粘贴图片</span>
      </div>
    </div>
  );
}
