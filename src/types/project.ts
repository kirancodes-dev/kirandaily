export type ProjectStatus = 'idea' | 'planning' | 'development' | 'testing' | 'completed';

export interface Project {
  id: string;
  name: string;
  description: string;
  technology: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  progress: number; // 0-100
  githubUrl: string;
  notes: string;
}
