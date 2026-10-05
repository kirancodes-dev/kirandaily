import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Keyboard, Pause, Search } from 'lucide-react';
import {
  isSidebarActive,
  isTabActive,
  isWidePage,
  PRIMARY_NAV,
  SIDEBAR_FOOTER_NAV,
  SIDEBAR_PROFILE_PATH,
  SIDEBAR_SECTIONS,
  type NavItem,
} from './navigation';
import { isApplePlatform } from './shortcuts';
import { ShortcutsHelp } from './ShortcutsHelp';
import { useMoreBelow } from './useMoreBelow';
import { useAppData } from '../../hooks/useAppData';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { Banner } from '../common/Feedback';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { formatClock } from '../../utils/timer';
import { useApplyTheme } from '../../hooks/useTheme';
import { SyncBadge } from '../sync/SyncBadge';
import { SyncChoiceDialog } from '../sync/SyncChoiceDialog';
import { Avatar } from '../profile/Avatar';
import { ReminderEngine } from '../reminders/ReminderEngine';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

const BASE = import.meta.env.BASE_URL;
const APPLE = typeof navigator !== 'undefined' && isApplePlatform(navigator);

/** Browser UI colour (Safari tab bar, Android status bar) for the light and dark app themes. */
const THEME_COLOR = { light: '#4f46e5', dark: '#020617' };

/**
 * index.html has one theme-color per system scheme; the in-app theme can differ from
 * the system one, so both follow the `dark` class on <html>.
 */
function useThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const color = root.classList.contains('dark') ? THEME_COLOR.dark : THEME_COLOR.light;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        if (m.getAttribute('content') !== color) m.setAttribute('content', color);
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
}

/** True once the page has scrolled a little (top bar gets its hairline and shadow). */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

// Plain <Link>s with our own aria-current: NavLink would also mark "Progress" current on the weekly review.
// Rows are 44px for touch (iPad) and a denser 32px with a mouse or trackpad, so the whole list fits a MacBook window.
function SidebarLink({ item, shortcut, compact = false }: { item: NavItem; shortcut?: string; compact?: boolean }) {
  const { pathname, search } = useLocation();
  const active = isSidebarActive(item.to, pathname, search);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-keyshortcuts={shortcut}
      className={`group relative flex min-h-touch min-w-0 items-center rounded-xl text-[15px] font-medium transition-colors [@media(pointer:fine)]:min-h-[2rem] ${
        compact ? 'gap-2 px-2.5' : 'gap-3 px-3'
      } ${
        active
          ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" />}
      <Icon size={19} aria-hidden className={`shrink-0 ${active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {shortcut && (
        <kbd
          aria-hidden
          className="hidden h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-slate-200 px-1 font-sans text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 dark:border-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300 [@media(hover:hover)]:inline-flex"
        >
          {shortcut}
        </kbd>
      )}
    </Link>
  );
}

/** Desktop sidebar's profile card: stands in for the "Profile" link, so it lights up on that page. */
function SidebarProfile() {
  const { data } = useAppData();
  const { pathname, search } = useLocation();
  const active = isSidebarActive(SIDEBAR_PROFILE_PATH, pathname, search);
  return (
    <Link
      to={SIDEBAR_PROFILE_PATH}
      aria-current={active ? 'page' : undefined}
      className={`relative mb-2 flex min-h-touch items-center gap-3 rounded-xl px-3 py-1.5 transition-colors ${
        active ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" />}
      <Avatar size={36} />
      <span className="min-w-0">
        <span className={`block truncate font-semibold ${active ? 'text-brand-700 dark:text-brand-200' : ''}`}>{data.profile.name}</span>
        <span className="block truncate text-xs text-slate-600 dark:text-slate-400">{data.profileExtra.headline || 'View profile'}</span>
      </span>
    </Link>
  );
}

/** Desktop sidebar (Mac, iPad landscape): everything in one list that fits a MacBook window, Search and Settings at the foot. */
function Sidebar({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const [listRef, moreBelow] = useMoreBelow<HTMLDivElement>();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 supports-[height:100dvh]:h-dvh lg:flex">
      {/* Below the status bar of an installed iPad app (0 elsewhere). */}
      <div
        ref={listRef}
        data-more-below={moreBelow || undefined}
        className="kp-fade-more flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-2 pt-[calc(0.75rem+var(--kp-safe-top))]"
      >
        <div className="mb-1.5 flex min-h-[2.25rem] items-center gap-2 px-3">
          <img src={`${BASE}favicon.svg`} alt="" className="h-7 w-7" />
          <span className="text-[17px] font-bold tracking-tight">Kiran Planner</span>
        </div>
        <SidebarProfile />
        <nav aria-label="Main" className="flex flex-col gap-px">
          {PRIMARY_NAV.map((item, i) => (
            <SidebarLink key={item.to} item={item} shortcut={String(i + 1)} />
          ))}
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.title} className="mt-2 flex flex-col gap-px">
              <p className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{section.title}</p>
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-slate-200 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 dark:border-slate-800">
        <nav aria-label="Search and settings" className="grid grid-cols-2 gap-1">
          {SIDEBAR_FOOTER_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} compact />
          ))}
        </nav>
        <button
          type="button"
          onClick={onShowShortcuts}
          aria-keyshortcuts="?"
          className="mt-1 hidden min-h-[2rem] w-full items-center gap-2 rounded-xl px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white [@media(hover:hover)]:flex"
        >
          <Keyboard size={18} aria-hidden />
          <span>
            Press <kbd className="rounded-md border border-slate-300 px-1.5 font-sans text-xs font-semibold dark:border-slate-600">?</kbd> for
            shortcuts
          </span>
        </button>
      </div>
    </aside>
  );
}

function TimerPill() {
  const timer = useStudyTimer();
  const navigate = useNavigate();
  if (timer.state.status === 'idle') return null;
  const paused = timer.state.status === 'paused';
  const label = timer.pomodoro
    ? `${timer.pomodoro.phase === 'focus' ? 'Focus' : 'Break'} ${formatClock(timer.pomodoro.phaseRemainingMs)}`
    : formatClock(timer.elapsed);
  return (
    <button
      type="button"
      onClick={() => navigate('/study')}
      className={`inline-flex min-h-touch shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold tabular-nums shadow-sm ${
        paused ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100' : 'bg-brand-600 text-white hover:bg-brand-700'
      }`}
      aria-label={`Study timer ${paused ? 'paused' : 'running'}: ${label}. Open Study page`}
    >
      {paused ? <Pause size={16} aria-hidden /> : <span aria-hidden className="kp-pulse h-2 w-2 rounded-full bg-emerald-300" />}
      {/* Phones: the pause icon says it; the word comes back where there is room. */}
      {paused && <span className="hidden sm:inline">Paused · </span>}
      {label}
    </button>
  );
}

/** Phone top bar: logo and name. The name gives way to the timer pill on narrow screens (the logo stays). */
function BrandLink() {
  const timerOn = useStudyTimer().state.status !== 'idle';
  return (
    <Link to="/" className="flex min-h-touch min-w-touch items-center gap-2 rounded-xl lg:hidden" aria-label="Kiran Planner, go to Today">
      <img src={`${BASE}favicon.svg`} alt="" className="h-7 w-7 shrink-0" />
      <span className={`truncate text-[17px] font-bold tracking-tight ${timerOn ? 'hidden sm:inline' : ''}`}>Kiran Planner</span>
    </Link>
  );
}

/** Smooth scrolling, unless the system asks for reduced motion. */
const scrollBehavior = (): ScrollBehavior =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export function AppLayout() {
  useApplyTheme();
  useThemeColorSync();
  const shortcuts = useKeyboardShortcuts();
  const { warnings, dismissWarnings, saveError } = useAppData();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const scrolled = useScrolled();

  // New page → start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const wide = isWidePage(pathname);

  return (
    <div className="min-h-screen min-h-dvh lg:flex">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only z-50 rounded-xl bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-[max(0.5rem,env(safe-area-inset-top))]"
      >
        Skip to content
      </a>

      {/* Installed on iPhone the status bar text is always white: give it a coloured strip in light mode. */}
      <div aria-hidden className="kp-statusbar" />

      <Sidebar onShowShortcuts={shortcuts.openHelp} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: blurred, below the Dynamic Island / status bar */}
        <header
          className={`kp-topbar sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-slate-50/85 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] backdrop-blur-xl backdrop-saturate-150 transition-[border-color,box-shadow] dark:bg-slate-950/85 lg:px-8 ${
            scrolled ? 'border-slate-200/80 shadow-[0_1px_8px_rgba(15,23,42,0.06)] dark:border-slate-800' : 'border-transparent'
          }`}
        >
          <BrandLink />
          <div className="hidden min-w-0 flex-1 lg:block">
            {pathname !== '/search' && (
              <button
                type="button"
                onClick={() => navigate('/search')}
                aria-label="Search"
                aria-keyshortcuts={`/ ${APPLE ? 'Meta' : 'Control'}+K`}
                className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-left text-[15px] text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
              >
                <Search size={18} aria-hidden />
                <span className="flex-1 truncate">Search tasks, topics, notes…</span>
                <kbd
                  aria-hidden
                  className="rounded-md border border-slate-200 px-1.5 font-sans text-xs font-semibold text-slate-500 dark:border-slate-700"
                >
                  {APPLE ? '⌘K' : 'Ctrl K'}
                </kbd>
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <TimerPill />
            <SyncBadge />
            {pathname !== '/search' && (
              <button
                type="button"
                onClick={() => navigate('/search')}
                aria-label="Search"
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
              >
                <Search size={22} aria-hidden />
              </button>
            )}
            <Link
              to="/profile"
              aria-label="Your profile"
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl lg:hidden"
            >
              <Avatar size={30} />
            </Link>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className={`mx-auto w-full flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 outline-none lg:px-8 lg:pb-12 lg:pt-6 ${
            wide ? 'max-w-5xl xl:max-w-6xl 2xl:max-w-7xl' : 'max-w-5xl'
          }`}
        >
          <div className="mb-3 space-y-2 empty:hidden">
            {warnings.length > 0 && (
              <Banner tone="warning" onDismiss={dismissWarnings}>
                <p className="font-medium">Some saved data needed repair:</p>
                <ul className="mt-1 list-disc pl-5">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Banner>
            )}
            {saveError && <Banner tone="error">{saveError}</Banner>}
          </div>
          <ErrorBoundary resetKey={pathname + search}>
            <div key={pathname} className="kp-page">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>

      <SyncChoiceDialog />
      <ReminderEngine />
      <ShortcutsHelp open={shortcuts.helpOpen} onClose={shortcuts.closeHelp} />

      {/* Phone tab bar: above the home indicator, clear of the rounded corners in landscape */}
      <nav
        aria-label="Main"
        className="kp-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800 dark:bg-slate-900/90 lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = isTabActive(item.to, pathname);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    // Like iOS: tapping the tab you are on scrolls back to the top.
                    if (`${pathname}${search}` === item.to) {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: scrollBehavior() });
                    }
                  }}
                  className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 pt-1 text-xs ${
                    active ? 'font-semibold text-brand-700 dark:text-brand-300' : 'font-medium text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-brand-100 dark:bg-brand-500/20' : ''
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
