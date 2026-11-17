import { useEffect, useRef, useState } from 'react';
import type { SyncState, Trip } from '../../shared/types';
import { PORT_NAME, type BackgroundToDashboard } from '../../shared/messages';
import { generateMockTrips } from '../../shared/mock-data';

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

export interface TripsState {
  trips: Trip[];
  syncState: SyncState;
  retrySync: () => void;
  focusEtcTab: () => void;
}

const idleSyncState: SyncState = { phase: 'done', months: [], lastSyncedAt: new Date().toISOString() };

export function useTrips(): TripsState {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(idleSyncState);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    if (!hasChrome) {
      setTrips(generateMockTrips());
      return;
    }

    let cancelled = false;
    void import('../../background/store').then(({ getAllTrips }) => {
      void getAllTrips().then((initial) => {
        if (!cancelled) setTrips(initial);
      });
    });

    const port = chrome.runtime.connect({ name: PORT_NAME });
    portRef.current = port;
    port.onMessage.addListener((message: BackgroundToDashboard) => {
      if (message.type === 'SYNC_STATE') setSyncState(message.state);
      if (message.type === 'TRIPS_DELTA') {
        setTrips((prev) => {
          const byId = new Map(prev.map((t) => [t.id, t]));
          for (const t of message.trips) byId.set(t.id, t);
          return Array.from(byId.values());
        });
      }
    });
    port.postMessage({ type: 'REQUEST_SYNC_STATE' });

    return () => {
      cancelled = true;
      port.disconnect();
    };
  }, []);

  return {
    trips,
    syncState,
    retrySync: () => portRef.current?.postMessage({ type: 'RETRY_SYNC' }),
    focusEtcTab: () => portRef.current?.postMessage({ type: 'FOCUS_ETC_TAB' }),
  };
}
