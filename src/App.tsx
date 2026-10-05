import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './state/AppDataContext';
import { TimerProvider } from './state/TimerContext';
import { SyncProvider } from './state/SyncContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Today from './pages/Today';
import Schedule from './pages/Schedule';
import Study from './pages/Study';
// Charts (Recharts) are loaded only when the Progress page opens.
const Progress = lazy(() => import('./pages/Progress'));
import More from './pages/More';
import Projects from './pages/Projects';
import Subjects from './pages/Subjects';
import Java from './pages/Java';
import Dsa from './pages/Dsa';
import German from './pages/German';
import Goals from './pages/Goals';
import Cgpa from './pages/Cgpa';
import Notes from './pages/Notes';
import Search from './pages/Search';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

/**
 * HashRouter keeps deep links working on any static host (GitHub Pages
 * has no server-side rewrites) and inside the installed PWA.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <SyncProvider>
        <TimerProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Today />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="study" element={<Study />} />
                <Route
                  path="progress"
                  element={
                    <Suspense fallback={<p className="p-4 text-slate-600">Loading charts…</p>}>
                      <Progress />
                    </Suspense>
                  }
                />
                <Route path="more" element={<More />} />
                <Route path="projects" element={<Projects />} />
                <Route path="subjects" element={<Subjects />} />
                <Route path="java" element={<Java />} />
                <Route path="dsa" element={<Dsa />} />
                <Route path="german" element={<German />} />
                <Route path="goals" element={<Goals />} />
                <Route path="cgpa" element={<Cgpa />} />
                <Route path="notes" element={<Notes />} />
                <Route path="search" element={<Search />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </HashRouter>
        </TimerProvider>
        </SyncProvider>
      </AppDataProvider>
    </ErrorBoundary>
  );
}
