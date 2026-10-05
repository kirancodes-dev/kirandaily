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
  /** Section on the More page and in the desktop sidebar (falls back to "More"). */
  group?: NavGroup;
}

export type NavGroup = 'You' | 'Plan & reflect' | 'Learning tracks' | 'College' | 'App';

/** Bottom navigation on phones. Keys 1–5 jump to these on a keyboard. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/study', label: 'Study', icon: Timer },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/more', label: 'More', icon: LayoutGrid },
];

/** Pages listed under "More" (and in the desktop sidebar), in group order. */
export const MORE_NAV: NavItem[] = [
  { to: '/profile', label: 'Profile', icon: UserRound, description: 'Photo, links, levels and badges', group: 'You' },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange, description: 'Semester dates, exams, important days', group: 'Plan & reflect' },
  { to: '/goals', label: 'Goals', icon: Target, description: 'Short and long term', group: 'Plan & reflect' },
  { to: '/progress?tab=weekly', label: 'Weekly review', icon: ListChecks, description: 'Reflect every Sunday', group: 'Plan & reflect' },
  { to: '/notes', label: 'Notes', icon: NotebookPen, description: 'Quick notes by category', group: 'Plan & reflect' },
  { to: '/java', label: 'Java', icon: Coffee, description: 'Roadmap, phases and topics', group: 'Learning tracks' },
  { to: '/dsa', label: 'DSA', icon: Code2, description: 'Topics and problems solved', group: 'Learning tracks' },
  { to: '/german', label: 'German', icon: Languages, description: 'A1 → A2 → B1, vocabulary', group: 'Learning tracks' },
  { to: '/projects', label: 'Projects', icon: FolderGit2, description: 'Ideas to completed', group: 'Learning tracks' },
  { to: '/subjects', label: 'College', icon: BookOpen, description: '9 subjects, assignments, exams', group: 'College' },
  { to: '/cgpa', label: 'CGPA', icon: GraduationCap, description: 'Semester SGPA and target', group: 'College' },
  { to: '/search', label: 'Search', icon: Search, description: 'Tasks, topics, notes…', group: 'App' },
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Timetable, theme, backup', group: 'App' },
];

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** MORE_NAV split into titled sections, keeping first-seen order (items without a group land in "More"). */
export function groupNav(items: NavItem[]): NavSection[] {
  const sections: NavSection[] = [];
  for (const item of items) {
    const title = item.group ?? 'More';
    let section = sections.find((s) => s.title === title);
    if (!section) {
      section = { title, items: [] };
      sections.push(section);
    }
    section.items.push(item);
  }
  return sections;
}

const pathOf = (to: string) => to.split('?')[0];

/** True when `pathname` is `path` or a sub-path of it ("/java" matches "/java/x", not "/javascript"). */
function underPath(path: string, pathname: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Every query parameter in `to` is present with the same value in `search`. */
function queryMatches(to: string, search: string) {
  const want = new URLSearchParams(to.split('?')[1] ?? '');
  const have = new URLSearchParams(search);
  for (const [key, value] of want) if (have.get(key) !== value) return false;
  return true;
}

/**
 * Bottom tab bar: which of the 5 tabs is lit. Pages from "More" light the More tab,
 * except the weekly review, which is really the Progress page.
 */
export function isTabActive(to: string, pathname: string): boolean {
  const path = pathOf(to);
  if (path === '/') return pathname === '/';
  if (path === '/more') {
    return pathname === '/more' || MORE_NAV.some((m) => !m.to.includes('?') && underPath(pathOf(m.to), pathname));
  }
  return underPath(path, pathname);
}

/**
 * Desktop sidebar: exactly one link is lit. Items with a query ("Weekly review")
 * match on their parameters, and then the plain item for the same page steps aside.
 */
export function isSidebarActive(to: string, pathname: string, search = ''): boolean {
  const path = pathOf(to);
  if (to.includes('?')) return pathname === path && queryMatches(to, search);
  if (path === '/') return pathname === '/';
  const claimed = MORE_NAV.some((m) => m.to.includes('?') && pathOf(m.to) === path && pathname === path && queryMatches(m.to, search));
  return !claimed && underPath(path, pathname);
}

/** Pages that use the extra width on big screens (timelines, week grids, charts, month grids). */
const WIDE_PATHS = ['/', '/schedule', '/progress', '/calendar'];

export function isWidePage(pathname: string): boolean {
  return WIDE_PATHS.includes(pathname);
}
