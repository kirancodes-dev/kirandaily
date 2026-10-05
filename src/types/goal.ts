export type GoalTerm = 'short' | 'long';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'paused';

export interface Goal {
  id: string;
  term: GoalTerm;
  title: string;
  description: string;
  deadline: string; // YYYY-MM-DD or ''
  progress: number; // 0-100
  status: GoalStatus;
}
