import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { ErrorToast } from './components/Toast';
import { useTrips } from './lib/useTrips';
import { Explore } from './routes/Explore';
import { Insights } from './routes/Insights';
import { Records } from './routes/Records';
import s from './App.module.css';

function Shell() {
  const { trips, syncState, retrySync, focusEtcTab } = useTrips();
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('etc-dashboard-theme') as 'light' | 'dark' | null) ?? 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('etc-dashboard-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  return (
    <div className={s.app}>
      <Header syncState={syncState} cardLast4={trips[0]?.cardLast4 ?? '----'} onToggleTheme={toggleTheme} />
      <Outlet context={{ trips, syncState }} />
      {syncState.phase === 'error' && (
        <ErrorToast
          message={syncState.errorMessage ?? '利用明細を同期できませんでした'}
          onRetry={() => {
            retrySync();
            focusEtcTab();
          }}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/explore" replace />} />
        <Route path="explore" element={<Explore />} />
        <Route path="insights" element={<Insights />} />
        <Route path="records" element={<Records />} />
      </Route>
    </Routes>
  );
}
