export interface Notebook {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}
export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export interface TaskItem {
  id: string;
  noteId: string;
  notebookId: string;
  title: string;
  priority: 'high'|'medium'|'low';
  status: 'pending'|'done';
  dueDate: string|null;
  createdAt: string;
}
export interface AppSettings {
  aiMode: 'rule'|'llm';
  llmEndpoint: string;
  llmApiKey: string;
  llmModel: string;
}
