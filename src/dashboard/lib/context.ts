import { useOutletContext } from 'react-router-dom';
import type { SyncState, Trip } from '../../shared/types';

export interface DashboardContext {
  trips: Trip[];
  syncState: SyncState;
}

export function useDashboardContext(): DashboardContext {
  return useOutletContext<DashboardContext>();
}
