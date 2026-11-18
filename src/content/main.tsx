import { createRoot } from 'react-dom/client';
import { FloatingButton } from './floating-button';
import { isLoggedInPage, isFlowGuardScreen, isUnknownConfirmScreen, findFlowGuardRecoverButton } from './site-detect';
import { runSyncStep } from './sync-runner';
import type { OneOffMessage, SyncStepResponse } from '../shared/messages';
import type { SyncStep } from '../shared/types';

function sendMessage<T = unknown>(message: OneOffMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

function mountFloatingButton() {
  if (!isLoggedInPage()) return;
  if (document.getElementById('etc-dashboard-host')) return;

  const host = document.createElement('div');
  host.id = 'etc-dashboard-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(
    <FloatingButton
      retrievedCount={0}
      onClick={() => {
        void sendMessage({ type: 'OPEN_DASHBOARD' }).then(() => driveSyncJob());
      }}
    />,
  );
}

async function driveSyncJob() {
  try {
    await driveSyncJobUnsafe();
  } catch (error) {
    await sendMessage({ type: 'SYNC_ERROR', message: error instanceof Error ? error.message : String(error) });
  }
}

async function driveSyncJobUnsafe() {
  if (isFlowGuardScreen()) {
    // ブラウザの戻る操作等によるフロー崩れ。セッション切れではないので「利用明細へ」で復帰する。
    findFlowGuardRecoverButton()?.click();
    return;
  }

  if (isUnknownConfirmScreen()) {
    // 「確認してください」系だが既知の復帰ボタンが無い想定外の画面（例: 検索条件の入力値エラー）。
    const message = document.body?.innerText?.slice(0, 300) ?? '想定外の確認画面が表示されました。';
    await sendMessage({ type: 'SYNC_ERROR', message });
    return;
  }

  if (!isLoggedInPage()) {
    await sendMessage({ type: 'SESSION_EXPIRED' });
    return;
  }

  const response = await sendMessage<SyncStepResponse>({ type: 'SYNC_REQUEST_STEP' });
  if (response.phase !== 'running') return;

  const advanceStep = (step: SyncStep) => sendMessage<void>({ type: 'SYNC_ADVANCE', step });
  const fetchCsvViaBackground = (url: string) =>
    sendMessage<{ ok: boolean; error?: string }>({ type: 'SYNC_FETCH_CSV_URL', url });
  const result = await runSyncStep(response.step, advanceStep, fetchCsvViaBackground);

  if (result.outcome === 'blocked') {
    await sendMessage({ type: 'SYNC_STEP_BLOCKED' });
  } else if (result.outcome === 'done' && result.trips.length > 0) {
    // fetching-csv ステップは background 側で完結する（SYNC_FETCH_CSV_URL）ので、
    // ここに来るのは runSyncStep がDOMから直接trips を得た場合のみ。
    await sendMessage({ type: 'SYNC_CSV_FETCHED', trips: result.trips });
  }
  // 'navigating' の場合は何もしない。次のページ読み込みでこの関数が再度呼ばれる。
}

mountFloatingButton();
void driveSyncJob();
