import { useEffect, useRef } from 'react';

/**
 * Keeps the CSS variable `name` on the element equal to its own height in px, for CSS that
 * needs it (the sticky offset of Today's overview column, see .kp-today-side in index.css).
 * Set straight on the element, so a change of height never re-renders the page.
 */
export function useHeightVar<T extends HTMLElement>(name: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => el.style.setProperty(name, `${el.offsetHeight}px`));
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);
  return ref;
}
