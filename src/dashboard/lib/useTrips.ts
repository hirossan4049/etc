import { useEffect, useRef, useState } from 'react';
import type { SyncState, Trip } from '../../shared/types';
import { PORT_NAME, type BackgroundToDashboard } from '../../shared/messages';
import { generateMockTrips } from '../../shared/mock-data';
import { enrichTrip } from '../../shared/enrich-trip';
import { parseMeisaiCsvFile } from './importCsv';

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

export interface TripsState {
  trips: Trip[];
  syncState: SyncState;
  retrySync: () => void;
  focusEtcTab: () => void;
  importCsv: (file: File) => Promise<number>;
}

const idleSyncState: SyncState = { phase: 'done', lastSyncedAt: new Date().toISOString() };

export function useTrips(): TripsState {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(idleSyncState);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    if (!hasChrome) {
      setTrips(generateMockTrips().map(enrichTrip));
      return;
    }

    let cancelled = false;
    void import('../../background/store').then(({ getAllTrips }) => {
      void getAllTrips().then((initial) => {
        if (!cancelled) setTrips(initial.map(enrichTrip));
      });
    });

    const port = chrome.runtime.connect({ name: PORT_NAME });
    portRef.current = port;
    port.onMessage.addListener((message: BackgroundToDashboard) => {
      if (message.type === 'SYNC_STATE') setSyncState(message.state);
      if (message.type === 'TRIPS_DELTA') {
        setTrips((prev) => {
          const byId = new Map(prev.map((t) => [t.id, t]));
          for (const t of message.trips) byId.set(t.id, enrichTrip(t));
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

  const importCsv = async (file: File): Promise<number> => {
    const imported = await parseMeisaiCsvFile(file);
    if (hasChrome) {
      await chrome.runtime.sendMessage({ type: 'SYNC_CSV_FETCHED', trips: imported });
    } else {
      setTrips((prev) => {
        const byId = new Map(prev.map((t) => [t.id, t]));
        for (const t of imported) byId.set(t.id, enrichTrip(t));
        return Array.from(byId.values());
      });
      setSyncState({ phase: 'done', lastSyncedAt: new Date().toISOString() });
    }
    return imported.length;
  };

  return {
    trips,
    syncState,
    retrySync: () => portRef.current?.postMessage({ type: 'RETRY_SYNC' }),
    focusEtcTab: () => portRef.current?.postMessage({ type: 'FOCUS_ETC_TAB' }),
    importCsv,
  };
}
