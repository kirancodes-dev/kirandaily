import { useEffect, useRef, useState } from 'react';

/**
 * For a scroll area: true while there is more content below what is shown, so the area can
 * fade out at its bottom edge (macOS hides scrollbars, so otherwise nothing says "scroll me").
 * Follows scrolling, resizing and content that grows or shrinks (e.g. a card appearing).
 */
export function useMoreBelow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    if (typeof ResizeObserver === 'undefined') return () => el.removeEventListener('scroll', check);

    // The area itself (window resizes) and each child (content changes inside it).
    const resize = new ResizeObserver(check);
    const observeAll = () => {
      resize.disconnect();
      resize.observe(el);
      for (const child of Array.from(el.children)) resize.observe(child);
      check();
    };
    observeAll();
    const children = new MutationObserver(observeAll);
    children.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', check);
      resize.disconnect();
      children.disconnect();
    };
  }, []);

  return [ref, moreBelow] as const;
}
