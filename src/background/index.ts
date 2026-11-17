import { PORT_NAME, type ContentToBackground, type DashboardToBackground } from '../shared/messages';
import { loadSyncState, saveSyncState, nextPendingMonth } from './sync-controller';
import { upsertTrips } from './store';

const dashboardPorts = new Set<chrome.runtime.Port>();
let activeEtcTabId: number | undefined;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'OPEN_DASHBOARD' && sender.tab?.id !== undefined) {
    activeEtcTabId = sender.tab.id;
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    void loadSyncState().then((state) => {
      state.phase = 'running';
      void saveSyncState(state);
      broadcastState(state);
    });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  const isDashboard = port.sender?.url?.includes('dashboard.html');
  if (isDashboard) {
    dashboardPorts.add(port);
    port.onDisconnect.addListener(() => dashboardPorts.delete(port));
    void loadSyncState().then((state) => port.postMessage({ type: 'SYNC_STATE', state }));
  }

  port.onMessage.addListener((message: ContentToBackground | DashboardToBackground) => {
    void handleMessage(message, port);
  });
});

async function handleMessage(
  message: ContentToBackground | DashboardToBackground,
  port: chrome.runtime.Port,
): Promise<void> {
  switch (message.type) {
    case 'START_SYNC': {
      activeEtcTabId = message.tabId;
      const state = await loadSyncState();
      state.phase = 'running';
      await saveSyncState(state);
      broadcastState(state);
      const month = nextPendingMonth(state);
      if (month) port.postMessage({ type: 'FETCH_MONTH', month });
      break;
    }
    case 'MONTH_RESULT': {
      await upsertTrips(message.trips);
      const state = await loadSyncState();
      const entry = state.months.find((m) => m.month === message.month);
      if (entry) entry.status = 'done';
      const next = nextPendingMonth(state);
      if (!next) {
        state.phase = 'done';
        state.lastSyncedAt = new Date().toISOString();
      }
      await saveSyncState(state);
      broadcastState(state);
      broadcastDelta(message.trips);
      if (next) port.postMessage({ type: 'FETCH_MONTH', month: next });
      break;
    }
    case 'MONTH_ERROR': {
      const state = await loadSyncState();
      const entry = state.months.find((m) => m.month === message.month);
      if (entry) {
        entry.status = 'error';
        entry.error = message.error;
      }
      state.phase = 'error';
      state.errorMessage = message.error;
      await saveSyncState(state);
      broadcastState(state);
      break;
    }
    case 'SESSION_EXPIRED': {
      const state = await loadSyncState();
      state.phase = 'error';
      state.errorMessage = 'ETC照会に再ログインしてください';
      await saveSyncState(state);
      broadcastState(state);
      break;
    }
    case 'REQUEST_SYNC_STATE': {
      const state = await loadSyncState();
      port.postMessage({ type: 'SYNC_STATE', state });
      break;
    }
    case 'RETRY_SYNC': {
      if (activeEtcTabId !== undefined) {
        port.postMessage({ type: 'FETCH_MONTH', month: nextPendingMonth(await loadSyncState()) });
      }
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
