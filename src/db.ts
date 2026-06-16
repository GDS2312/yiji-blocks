import Dexie, { type Table } from 'dexie';
import type { Notebook, Note, AppSettings } from './types';

class YijiDB extends Dexie {
  notebooks!: Table<Notebook, string>;
  notes!: Table<Note, string>;
  settings!: Table<AppSettings, string>;
  constructor() {
    super('yiji_v4');
    this.version(1).stores({
      notebooks: 'id,updatedAt',
      notes: 'id,notebookId,updatedAt,starred,*tags',
      settings: 'id',
    });
  }
}

export const db = new YijiDB();
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('main');
  return s || { theme: 'light', speechLang: 'zh-CN' };
}
export async function saveSettings(s: AppSettings) {
  await db.settings.put({ ...s, id: 'main' } as AppSettings & { id: string });
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
