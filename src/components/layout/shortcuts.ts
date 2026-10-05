import { PRIMARY_NAV } from './navigation';

/** What a key press asks the app to do. */
export type ShortcutAction =
  | { type: 'go'; to: string }
  | { type: 'search' }
  | { type: 'new-task' }
  | { type: 'day'; delta: -1 | 1 }
  | { type: 'today' }
  | { type: 'help' };

/** The parts of a KeyboardEvent the resolver looks at (plain object in tests). */
export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}

export interface ShortcutContext {
  /** Focus is in a text field, select or contenteditable – keys belong to the field. */
  typing: boolean;
  /** A modal <dialog> is open – it owns the keyboard until it closes. */
  dialogOpen: boolean;
}

/** Events Today listens for (fired on window by the keyboard shortcuts). */
export const NEW_TASK_EVENT = 'kp:new-task';
export const DAY_EVENT = 'kp:day';

/** Router state that asks Today to open "Add task" once it has mounted. */
export const NEW_TASK_STATE = 'kp-new-task';

/** Input types that do not take typed text, so single-key shortcuts still work there. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

interface ElementLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

/** True when keys typed now would go into a field (input, textarea, select, contenteditable). */
export function isTypingTarget(el: ElementLike | null | undefined): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((el.type || 'text').toLowerCase());
  return !!el.isContentEditable;
}

/**
 * Maps a key press to an action, or null to let the browser have it.
 * Cmd/Ctrl+K works even inside a text field; single keys never steal typing,
 * and nothing fires while a dialog is open. Other modifier combos (Cmd+1, Cmd+[ …)
 * stay with the browser.
 */
export function resolveShortcut(e: KeyLike, ctx: ShortcutContext): ShortcutAction | null {
  if (e.isComposing || ctx.dialogOpen) return null;
  const key = e.key;
  if ((e.metaKey || e.ctrlKey) && !e.altKey && key.toLowerCase() === 'k') return e.repeat ? null : { type: 'search' };
  if (e.metaKey || e.ctrlKey || e.altKey || ctx.typing) return null;
  // Holding [ or ] keeps flipping days; every other key acts once per press.
  if (key === '[') return { type: 'day', delta: -1 };
  if (key === ']') return { type: 'day', delta: 1 };
  if (e.repeat) return null;
  if (/^[1-9]$/.test(key)) {
    const item = PRIMARY_NAV[Number(key) - 1];
    return item ? { type: 'go', to: item.to } : null;
  }
  switch (key) {
    case '/':
      return { type: 'search' };
    case '?':
      return { type: 'help' };
    case 'n':
    case 'N':
      return { type: 'new-task' };
    case 't':
    case 'T':
      return { type: 'today' };
    default:
      return null;
  }
}

interface NavigatorLike {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string };
}

/** Mac, iPhone or iPad – show ⌘ instead of Ctrl. */
export function isApplePlatform(nav: NavigatorLike | undefined): boolean {
  if (!nav) return false;
  const platform = nav.userAgentData?.platform || nav.platform || '';
  if (/mac|iphone|ipad|ipod/i.test(platform)) return true;
  return /Macintosh|iPhone|iPad|iPod/.test(nav.userAgent || '');
}

export interface ShortcutHelpRow {
  keys: string[][];
  label: string;
}

export interface ShortcutHelpGroup {
  title: string;
  rows: ShortcutHelpRow[];
}

/**
 * Rows for the "Keyboard shortcuts" dialog. Each row lists alternatives,
 * and each alternative is the keys pressed together, e.g. [['/'], ['⌘', 'K']].
 */
export function shortcutHelp(apple: boolean): ShortcutHelpGroup[] {
  const mod = apple ? '⌘' : 'Ctrl';
  return [
    {
      title: 'Go to',
      rows: [...PRIMARY_NAV.map((item, i) => ({ keys: [[String(i + 1)]], label: item.label })), { keys: [['/'], [mod, 'K']], label: 'Search' }],
    },
    {
      title: 'Tasks and days',
      rows: [
        { keys: [['N']], label: 'New task' },
        { keys: [['['], [']']], label: 'Previous / next day (on Today)' },
        { keys: [['T']], label: 'Jump to today' },
      ],
    },
    {
      title: 'Help',
      rows: [
        { keys: [['?']], label: 'Show this list' },
        { keys: [['Esc']], label: 'Close a dialog' },
      ],
    },
  ];
}
