import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, Timer } from 'lucide-react';
import { MORE_NAV, PRIMARY_NAV, type NavItem } from './navigation';
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

function isActive(item: NavItem, pathname: string) {
  const path = item.to.split('?')[0];
  if (path === '/') return pathname === '/';
  if (item.to === '/more') return pathname === '/more' || MORE_NAV.some((m) => m.to.split('?')[0] === pathname && m.to !== '/progress?tab=weekly');
  return pathname.startsWith(path);
}

function SidebarLink({ item }: { item: NavItem }) {
  const { pathname, search } = useLocation();
  const active = item.to.includes('?') ? `${pathname}${search}` === item.to : isActive(item, pathname);
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-touch items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <Icon size={20} aria-hidden />
      {item.label}
    </NavLink>
  );
}

function TimerPill() {
  const timer = useStudyTimer();
  const navigate = useNavigate();
  if (timer.state.status === 'idle') return null;
  const label = timer.pomodoro ? `${timer.pomodoro.phase === 'focus' ? 'Focus' : 'Break'} ${formatClock(timer.pomodoro.phaseRemainingMs)}` : formatClock(timer.elapsed);
  return (
    <button
      type="button"
      onClick={() => navigate('/study')}
      className="inline-flex min-h-touch items-center gap-1.5 rounded-full bg-brand-600 px-3 text-sm font-semibold tabular-nums text-white"
      aria-label={`Study timer ${timer.state.status === 'paused' ? 'paused' : 'running'}: ${label}. Open Study page`}
    >
      <Timer size={16} aria-hidden />
      {timer.state.status === 'paused' ? 'Paused · ' : ''}
      {label}
    </button>
  );
}

export function AppLayout() {
  useApplyTheme();
  useKeyboardShortcuts();
  const { data, warnings, dismissWarnings, saveError } = useAppData();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  // New page → start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only z-50 rounded-xl bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="mb-2 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
          <span className="text-lg font-bold">Kiran Planner</span>
        </div>
        <NavLink
          to="/profile"
          className="mb-3 flex min-h-touch items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Avatar size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{data.profile.name}</span>
            <span className="block truncate text-xs text-slate-600 dark:text-slate-400">{data.profileExtra.headline || 'View profile'}</span>
          </span>
        </NavLink>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {PRIMARY_NAV.filter((n) => n.to !== '/more').map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          <div className="mx-3 my-2 border-t border-slate-200 dark:border-slate-800" />
          {MORE_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <span className="text-base font-bold lg:hidden">Kiran Planner</span>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-1">
            <TimerPill />
            <SyncBadge />
            {pathname !== '/search' && (
              <button
                type="button"
                onClick={() => navigate('/search')}
                aria-label="Search"
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Search size={22} aria-hidden />
              </button>
            )}
            <NavLink to="/profile" aria-label="Your profile" className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl lg:hidden">
              <Avatar size={30} />
            </NavLink>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 outline-none lg:px-8 lg:pb-10">
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
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <SyncChoiceDialog />
      <ReminderEngine />

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className={`rounded-full px-4 py-1 ${active ? 'bg-brand-100 dark:bg-brand-500/20' : ''}`}>
                    <Icon size={22} aria-hidden />
                  </span>
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
