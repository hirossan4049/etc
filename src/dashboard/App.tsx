import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { ErrorToast, SuccessToast } from './components/Toast';
import { useTrips } from './lib/useTrips';
import { Explore } from './routes/Explore';
import { Insights } from './routes/Insights';
import { Records } from './routes/Records';
import s from './App.module.css';

function Shell() {
  const { trips, syncState, retrySync, focusEtcTab, importCsv } = useTrips();
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('etc-dashboard-theme') as 'light' | 'dark' | null) ?? 'light',
  );
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('etc-dashboard-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  const handleImportCsv = useCallback(
    async (file: File) => {
      setImportError(null);
      try {
        const count = await importCsv(file);
        setImportResult({ count });
      } catch (error) {
        setImportError(error instanceof Error ? error.message : String(error));
      }
    },
    [importCsv],
  );

  return (
    <div className={s.app}>
      <Header
        syncState={syncState}
        cardLast4={trips[0]?.cardLast4 ?? '----'}
        onToggleTheme={toggleTheme}
        onImportCsv={(file) => void handleImportCsv(file)}
      />
      <Outlet context={{ trips, syncState }} />
      {importResult && (
        <SuccessToast
          message={`${importResult.count}件の明細を読み込みました`}
          onDismiss={() => setImportResult(null)}
        />
      )}
      {importError && <ErrorToast message={`CSVの読み込みに失敗しました: ${importError}`} onRetry={() => setImportError(null)} />}
      {!importError && syncState.phase === 'error' && (
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
