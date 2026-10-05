import { useEffect } from 'react';
import { useAppData } from './useAppData';

/** Applies the light/dark/system theme to <html>. */
export function useApplyTheme() {
  const { data } = useAppData();
  const theme = data.profile.theme;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#4f46e5');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
