import {
  BarChart3,
  CalendarRange,
  UserRound,
  BookOpen,
  CalendarDays,
  Coffee,
  Code2,
  FolderGit2,
  GraduationCap,
  Languages,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Search,
  Settings,
  Sun,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

/** Bottom navigation on phones. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/study', label: 'Study', icon: Timer },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/more', label: 'More', icon: LayoutGrid },
];

/** Pages listed under "More" (and in the desktop sidebar). */
export const MORE_NAV: NavItem[] = [
  { to: '/profile', label: 'Profile', icon: UserRound, description: 'Photo, links, levels and badges' },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange, description: 'Semester dates, exams, important days' },
  { to: '/java', label: 'Java', icon: Coffee, description: 'Roadmap, phases and topics' },
  { to: '/dsa', label: 'DSA', icon: Code2, description: 'Topics and problems solved' },
  { to: '/german', label: 'German', icon: Languages, description: 'A1 → A2 → B1, vocabulary' },
  { to: '/subjects', label: 'College', icon: BookOpen, description: '9 subjects, assignments, exams' },
  { to: '/cgpa', label: 'CGPA', icon: GraduationCap, description: 'Semester SGPA and target' },
  { to: '/projects', label: 'Projects', icon: FolderGit2, description: 'Ideas to completed' },
  { to: '/goals', label: 'Goals', icon: Target, description: 'Short and long term' },
  { to: '/notes', label: 'Notes', icon: NotebookPen, description: 'Quick notes by category' },
  { to: '/progress?tab=weekly', label: 'Weekly review', icon: ListChecks, description: 'Reflect every Sunday' },
  { to: '/search', label: 'Search', icon: Search, description: 'Tasks, topics, notes…' },
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Timetable, theme, backup' },
];
