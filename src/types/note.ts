export type NoteCategory = 'college' | 'java' | 'dsa' | 'german' | 'project' | 'personal';

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  date: string; // YYYY-MM-DD
  updatedAt: string; // ISO
}
