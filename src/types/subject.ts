export type WorkStatus = 'not_started' | 'in_progress' | 'completed';

export interface SubjectTopic {
  id: string;
  title: string;
  done: boolean;
}

export interface Subject {
  id: string;
  name: string;
  topics: SubjectTopic[];
  notes: string;
  assignmentStatus: WorkStatus;
  revisionStatus: WorkStatus;
  examPrepStatus: WorkStatus;
}

export interface SemesterEntry {
  id: string;
  semester: number;
  sgpa: number;
  /** Optional credits. If every entry has credits, CGPA is credit-weighted. */
  credits?: number;
}

export interface CgpaData {
  current: number;
  target: number;
  totalSemesters: number;
  semesters: SemesterEntry[];
}
