import { PORT_NAME, type DashboardToBackground, type OneOffMessage, type SyncStepResponse } from '../shared/messages';
import { decodeShiftJis, hashId, meisaiRowToTrip, parseCsvRows, tripDedupeKey } from '../shared/parse-csv';
import type { Trip } from '../shared/types';
import { loadSyncState, saveSyncState } from './sync-controller';
import { upsertTrips } from './store';

/**
 * ページ（content script）からの fetch は、レスポンスが Content-Disposition: attachment
 * だとChromeのダウンロードマネージャに横取りされ "Failed to fetch" になる（実機で確認）。
 * service worker（このファイル）からのfetchなら横取りされず中身を読める。
 */
async function fetchCsvAsTrips(url: string): Promise<Trip[]> {
  const response = await fetch(url, { credentials: 'include' });
  const buffer = await response.arrayBuffer();
  const text = decodeShiftJis(buffer);
  const rows = parseCsvRows(text);

  const trips: Trip[] = [];
  for (const row of rows) {
    const fields = meisaiRowToTrip(row);
    if (!fields) continue;
    const id = await hashId(tripDedupeKey(fields));
    trips.push({ id, ...fields });
  }
  return trips;
}

const dashboardPorts = new Set<chrome.runtime.Port>();
let activeEtcTabId: number | undefined;

chrome.runtime.onMessage.addListener((message: OneOffMessage, sender, sendResponse) => {
  void handleOneOffMessage(message, sender).then(sendResponse);
  return true; // sendResponse は非同期で呼ぶ
});

async function handleOneOffMessage(
  message: OneOffMessage,
  sender: chrome.runtime.MessageSender,
): Promise<SyncStepResponse | { ok: boolean; error?: string } | void> {
  switch (message.type) {
    case 'OPEN_DASHBOARD': {
      if (sender.tab?.id !== undefined) activeEtcTabId = sender.tab.id;
      void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      const state = await loadSyncState();
      state.phase = 'running';
      state.step = 'opening-search-form';
      state.errorMessage = undefined;
      await saveSyncState(state);
      broadcastState(state);
      return;
    }
    case 'SYNC_REQUEST_STEP': {
      const state = await loadSyncState();
      if (state.phase === 'running' && state.step && state.step !== 'done') {
        return { phase: 'running', step: state.step };
      }
      return { phase: 'idle' };
    }
    case 'SYNC_ADVANCE': {
      const state = await loadSyncState();
      state.step = message.step;
      await saveSyncState(state);
      return;
    }
    case 'SYNC_STEP_BLOCKED': {
      const state = await loadSyncState();
      state.phase = 'error';
      state.errorMessage = '利用明細ページの操作中に想定外の画面になりました。もう一度お試しください。';
      await saveSyncState(state);
      broadcastState(state);
      return;
    }
    case 'SYNC_CSV_FETCHED': {
      await upsertTrips(message.trips);
      const state = await loadSyncState();
      state.phase = 'done';
      state.step = 'done';
      state.lastSyncedAt = new Date().toISOString();
      state.errorMessage = undefined;
      await saveSyncState(state);
      broadcastState(state);
      broadcastDelta(message.trips);
      return;
    }
    case 'SYNC_FETCH_CSV_URL': {
      try {
        const trips = await fetchCsvAsTrips(message.url);
        await upsertTrips(trips);
        const state = await loadSyncState();
        state.phase = 'done';
        state.step = 'done';
        state.lastSyncedAt = new Date().toISOString();
        state.errorMessage = undefined;
        await saveSyncState(state);
        broadcastState(state);
        broadcastDelta(trips);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const state = await loadSyncState();
        state.phase = 'error';
        state.errorMessage = message;
        await saveSyncState(state);
        broadcastState(state);
        return { ok: false, error: message };
      }
    }
    case 'SYNC_ERROR': {
      const state = await loadSyncState();
      state.phase = 'error';
      state.errorMessage = message.message;
      await saveSyncState(state);
      broadcastState(state);
      return;
    }
    case 'SESSION_EXPIRED': {
      const state = await loadSyncState();
      state.phase = 'error';
      state.errorMessage = 'ETC照会に再ログインしてください';
      await saveSyncState(state);
      broadcastState(state);
      return;
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  dashboardPorts.add(port);
  port.onDisconnect.addListener(() => dashboardPorts.delete(port));
  void loadSyncState().then((state) => port.postMessage({ type: 'SYNC_STATE', state }));

  port.onMessage.addListener((message: DashboardToBackground) => {
    void handleDashboardMessage(message, port);
  });
});

async function handleDashboardMessage(message: DashboardToBackground, port: chrome.runtime.Port): Promise<void> {
  switch (message.type) {
    case 'REQUEST_SYNC_STATE': {
      const state = await loadSyncState();
      port.postMessage({ type: 'SYNC_STATE', state });
      break;
    }
    case 'RETRY_SYNC': {
      const state = await loadSyncState();
      state.phase = 'running';
      state.step = 'opening-search-form';
      state.errorMessage = undefined;
      await saveSyncState(state);
      broadcastState(state);
      break;
    }
    case 'FOCUS_ETC_TAB': {
      if (activeEtcTabId !== undefined) await chrome.tabs.update(activeEtcTabId, { active: true });
      break;
    }
  }
}

function broadcastState(state: Awaited<ReturnType<typeof loadSyncState>>) {
  for (const port of dashboardPorts) port.postMessage({ type: 'SYNC_STATE', state });
}

function broadcastDelta(trips: Parameters<typeof upsertTrips>[0]) {
  for (const port of dashboardPorts) port.postMessage({ type: 'TRIPS_DELTA', trips });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeEtcTabId) {
    activeEtcTabId = undefined;
    void loadSyncState().then((state) => {
      if (state.phase === 'running') {
        state.phase = 'paused';
        void saveSyncState(state);
        broadcastState(state);
      }
    });
  }
});
