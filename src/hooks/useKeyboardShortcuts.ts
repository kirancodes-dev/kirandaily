import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DAY_EVENT, isTypingTarget, NEW_TASK_EVENT, NEW_TASK_STATE, resolveShortcut } from '../components/layout/shortcuts';

/**
 * Keyboard shortcuts for Mac/desktop (and iPad with a keyboard):
 * 1–5 tabs, / or ⌘K search, N new task, [ ] previous/next day, T today, ? help.
 * Keys typed into fields and keys pressed while a dialog is open are left alone.
 * Returns the state of the "Keyboard shortcuts" help dialog.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  // The listener is added once; it reads the current page from here.
  const where = useRef(pathname);
  where.current = pathname;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const action = resolveShortcut(e, {
        typing: isTypingTarget(document.activeElement as HTMLInputElement | null),
        dialogOpen: !!document.querySelector('dialog[open]'),
      });
      if (!action) return;
      const onToday = where.current === '/';
      switch (action.type) {
        case 'go':
          navigate(action.to);
          break;
        case 'search':
          if (where.current === '/search') document.querySelector<HTMLInputElement>('main input[type="search"]')?.focus();
          else navigate('/search');
          break;
        case 'new-task':
          if (onToday) window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT));
          else navigate('/', { state: NEW_TASK_STATE });
          break;
        case 'day':
          if (!onToday) return; // only Today has a day to flip; let the key through elsewhere
          window.dispatchEvent(new CustomEvent(DAY_EVENT, { detail: action.delta }));
          break;
        case 'today':
          navigate('/', { replace: onToday });
          break;
        case 'help':
          setHelpOpen(true);
          break;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  return { helpOpen, openHelp, closeHelp };
}
