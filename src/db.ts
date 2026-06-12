import Dexie, { type Table } from 'dexie';
import type { Notebook, Note, TaskItem, AppSettings } from './types';
class YijiDB extends Dexie {
  notebooks!: Table<Notebook,string>;
  notes!: Table<Note,string>;
  tasks!: Table<TaskItem,string>;
  settings!: Table<AppSettings,string>;
  constructor() {
    super('yiji_blocks');
    this.version(1).stores({
      notebooks: 'id,updatedAt',
      notes: 'id,notebookId,updatedAt',
      tasks: 'id,noteId,notebookId,status',
      settings: 'id',
    });
  }
}
export const db = new YijiDB();
export const genId = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
export async function getSettings():Promise<AppSettings>{
  const s=await db.settings.get('main');
  return s||{aiMode:'rule',llmEndpoint:'',llmApiKey:'',llmModel:'gpt-4o-mini'};
}
export async function saveSettings(s:AppSettings){await db.settings.put({...s,id:'main'} as any);}
