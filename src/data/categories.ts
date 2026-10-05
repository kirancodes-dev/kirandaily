import type { CategoryDef } from '../types/task';

/** Learning areas (count as study) plus system categories (gym, classes, routine). */
export const defaultCategories: CategoryDef[] = [
  { id: 'college', label: 'College', isStudy: true, builtIn: true, color: 'indigo' },
  { id: 'java', label: 'Java', isStudy: true, builtIn: true, color: 'orange' },
  { id: 'dsa', label: 'DSA', isStudy: true, builtIn: true, color: 'emerald' },
  { id: 'german', label: 'German', isStudy: true, builtIn: true, color: 'amber' },
  { id: 'project', label: 'Project', isStudy: true, builtIn: true, color: 'sky' },
  { id: 'revision', label: 'Revision', isStudy: true, builtIn: true, color: 'violet' },
  { id: 'test', label: 'Test', isStudy: true, builtIn: true, color: 'rose' },
  { id: 'other', label: 'Other', isStudy: true, builtIn: true, color: 'slate' },
  { id: 'gym', label: 'Gym', isStudy: false, builtIn: true, color: 'red' },
  { id: 'classes', label: 'Classes', isStudy: false, builtIn: true, color: 'teal' },
  { id: 'routine', label: 'Routine', isStudy: false, builtIn: true, color: 'slate' },
];

