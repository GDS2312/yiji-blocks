export interface Notebook {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  tags: string[];
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id?: string;
  theme: 'light' | 'dark';
  speechLang: string;
}
