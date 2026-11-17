import { useMemo, useState } from 'react';
import type { Trip } from '../../shared/types';
import { aggregateRoutes, groupByDate } from '../lib/aggregate';
import { useDashboardContext } from '../lib/context';
import {
  formatDateLong,
  formatDuration,
  formatKm,
  formatRelativeDay,
  formatTimeRange,
  formatYen,
} from '../lib/format';
import {
  CloseIcon,
  ExpandIcon,
  ResetIcon,
  SearchIcon,
  SidebarIcon,
} from '../components/Icon';
import { Divider, IconButton, LabelButton, Segmented, Tag } from '../components/Primitives';
import { EmptyState } from '../components/EmptyState';
import { ExploreMap } from './ExploreMap';
import s from './Explore.module.css';
import p from '../components/primitives.module.css';

const PERIODS = [
  { value: '7', label: '7日' },
  { value: '30', label: '30日' },
  { value: '90', label: '90日' },
  { value: 'all', label: '全期間' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

const MODES = [
  { value: 'freq', label: '頻度' },
  { value: 'flat', label: '均一' },
] as const;
type Mode = (typeof MODES)[number]['value'];

function withinPeriod(trip: Trip, period: Period): boolean {
  if (period === 'all') return true;
  const days = Number(period);
  return Date.now() - new Date(trip.exitAt).getTime() <= days * 86400000;
}

export function Explore() {
  const { trips } = useDashboardContext();
  const [period, setPeriod] = useState<Period>('30');
  const [mode, setMode] = useState<Mode>('freq');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>();

  const periodTrips = useMemo(() => trips.filter((t) => withinPeriod(t, period)), [trips, period]);
  const filteredTrips = useMemo(() => {
    const q = query.trim();
    if (!q) return periodTrips;
    return periodTrips.filter((t) => `${t.entryName ?? ''}${t.exitName}${t.road ?? ''}`.includes(q));
  }, [periodTrips, query]);

  const groups = useMemo(() => groupByDate(filteredTrips), [filteredTrips]);
  const routes = useMemo(() => aggregateRoutes(periodTrips), [periodTrips]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const selectedCorridorKey = selectedTrip ? [selectedTrip.entryName, selectedTrip.exitName].sort().join('__') : undefined;
  const corridorTrips = selectedCorridorKey ? routes.find((r) => r.key === selectedCorridorKey)?.trips ?? [] : [];
  const corridorOccurrence = selectedTrip
    ? [...corridorTrips].sort((a, b) => a.exitAt.localeCompare(b.exitAt)).findIndex((t) => t.id === selectedTrip.id) + 1
    : 0;

  const sumKm = filteredTrips.reduce((acc, t) => acc + (t.distanceKm ?? 0), 0);
  const sumFare = filteredTrips.reduce((acc, t) => acc + t.fare, 0);

  const toolbarLeft = sidebarOpen ? 364 : 68;

  return (
    <div className={s.body}>
      <ExploreMap
        routes={routes}
        mode={mode}
        selectedKey={selectedCorridorKey}
        onSelect={(key) => {
          const route = routes.find((r) => r.key === key);
          const latest = route ? [...route.trips].sort((a, b) => b.exitAt.localeCompare(a.exitAt))[0] : undefined;
          setSelectedTripId(latest?.id);
        }}
      />

      <div className={`${s.toolbar} ${p.float}`} style={{ left: toolbarLeft }}>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <Divider vertical />
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </div>

      <div className={`${s.zoomGroup} ${p.float}`}>
        <IconButton label="拡大">
          <ExpandIcon />
        </IconButton>
        <IconButton label="縮小">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 8h10" strokeLinecap="round" />
          </svg>
        </IconButton>
        <IconButton label="全ルートを表示" onClick={() => setSelectedTripId(undefined)}>
          <ResetIcon />
        </IconButton>
      </div>

      <div className={`${s.legend} ${p.float}`} style={{ left: toolbarLeft }}>
        <span>走行頻度</span>
        <span className={s.legendSample}>
          <span className={s.legendLine} style={{ opacity: 0.3, borderTopWidth: 1.4 }} />
          1–5
        </span>
        <span className={s.legendSample}>
          <span className={s.legendLine} style={{ opacity: 0.55, borderTopWidth: 2.6 }} />
          10–20
        </span>
        <span className={s.legendSample}>
          <span className={s.legendLine} style={{ opacity: 0.82, borderTopWidth: 4.2 }} />
          50+
        </span>
        <Divider vertical />
        <span className={s.legendScale} />
        <span>10 km</span>
      </div>

      {!selectedTrip && (
        <div className={`${s.hint} ${p.float}`}>ルートまたは履歴を選択すると詳細を表示します</div>
      )}

      {sidebarOpen ? (
        <div className={`${s.sidebar} ${p.float}`}>
          <div className={s.sidebarHeader}>
            <span className={s.sidebarTitle}>走行履歴</span>
            <IconButton label="サイドバーを閉じる" onClick={() => setSidebarOpen(false)}>
              <CloseIcon />
            </IconButton>
          </div>
          <div className={s.search}>
            <SearchIcon />
            <input
              placeholder="IC・道路名で検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className={p.kbd}>/</span>
          </div>
          <div className={`${s.summaryRow} num`}>
            <span><b>{filteredTrips.length}</b> 回</span>
            <span><b>{formatKm(sumKm)}</b></span>
            <span><b>{formatYen(sumFare)}</b></span>
          </div>
          <div className={s.scroll}>
            {groups.length === 0 ? (
              <EmptyState
                variant="filtered"
                title="該当する走行がありません"
                body="期間を広げるか、別のIC名で検索してください。"
                action={{ label: '条件をクリア', onClick: () => setQuery('') }}
              />
            ) : (
              groups.map((group) => (
                <div key={group.key}>
                  <div className={`${s.dateHeader} num`}>
                    <span>{formatRelativeDay(group.trips[0].exitAt)}</span>
                    <span>
                      {formatKm(group.sumKm)} · {formatYen(group.sumFare)}
                    </span>
                  </div>
                  {group.trips.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      className={`${s.item} ${trip.id === selectedTripId ? s.sel : ''}`}
                      onClick={() => setSelectedTripId(trip.id)}
                    >
                      <span className={`${s.itemTime} num`}>{formatTimeRange(undefined, trip.exitAt)}</span>
                      <span className={s.itemRoute}>
                        <div className={s.itemRouteLine}>
                          {trip.entryName} → {trip.exitName}
                        </div>
                        <div className={s.itemSub}>
                          {trip.road} · {formatKm(trip.distanceKm ?? 0)}
                        </div>
                      </span>
                      <span className={s.itemFare}>
                        <span className="num">{formatYen(trip.fare)}</span>
                        {trip.discount && <Tag>{trip.discount}</Tag>}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className={`${s.sidebarCollapsed} ${p.float}`}>
          <IconButton label="サイドバーを開く" onClick={() => setSidebarOpen(true)}>
            <SidebarIcon />
          </IconButton>
          <IconButton label="検索">
            <SearchIcon />
          </IconButton>
          <span className={`${s.sidebarCount} num`}>{filteredTrips.length}</span>
        </div>
      )}

      {selectedTrip && (
        <div className={`${s.detail} ${p.float}`}>
          <div className={s.detailHeader}>
            <div>
              <div className={`${s.detailMeta} num`}>
                {formatDateLong(selectedTrip.exitAt)} {formatTimeRange(selectedTrip.entryAt, selectedTrip.exitAt)}
              </div>
              <div className={s.detailTitle}>
                {selectedTrip.entryName} → {selectedTrip.exitName}
              </div>
              <div className={s.detailRoad}>{selectedTrip.road}</div>
            </div>
            <IconButton label="閉じる" onClick={() => setSelectedTripId(undefined)}>
              <CloseIcon />
            </IconButton>
          </div>

          <dl className={s.statGrid}>
            <div className={s.statCell}>
              <div className={s.statLabel}>距離</div>
              <div className={`${s.statValue} num`}>{formatKm(selectedTrip.distanceKm ?? 0)}</div>
            </div>
            <div className={s.statCell}>
              <div className={s.statLabel}>所要時間</div>
              <div className={`${s.statValue} num`}>
                {selectedTrip.entryAt
                  ? formatDuration(
                      (new Date(selectedTrip.exitAt).getTime() - new Date(selectedTrip.entryAt).getTime()) / 60000,
                    )
                  : '—'}
              </div>
            </div>
            <div className={s.statCell}>
              <div className={s.statLabel}>平均速度</div>
              <div className={`${s.statValue} num`}>{selectedTrip.speedKmh ? `${selectedTrip.speedKmh} km/h` : '—'}</div>
            </div>
            <div className={s.statCell}>
              <div className={s.statLabel}>通行料金</div>
              <div className={`${s.statValue} num`}>{formatYen(selectedTrip.fare)}</div>
            </div>
          </dl>

          <div className={s.sectionTitle}>経路</div>
          <div className={s.stops}>
            <div className={s.stop}>
              <span className={s.stopDotStart} />
              <span className={s.stopLine} />
              <span className={s.stopBody}>
                <span>{selectedTrip.entryName ?? '不明'}</span>
                <span className={`${s.stopTime} num`}>{selectedTrip.entryAt ? formatTimeRange(undefined, selectedTrip.entryAt) : '—'}</span>
              </span>
            </div>
            <div className={s.stop}>
              <span className={s.stopDotEnd} />
              <span className={s.stopBody}>
                <span>{selectedTrip.exitName}</span>
                <span className={`${s.stopTime} num`}>{formatTimeRange(undefined, selectedTrip.exitAt)}</span>
              </span>
            </div>
          </div>

          <div className={s.sectionTitle}>料金内訳</div>
          <div className={s.fareRows}>
            <div className={`${s.fareRow} num`}>
              <span>通常料金</span>
              <span>{formatYen(selectedTrip.fareBase ?? selectedTrip.fare)}</span>
            </div>
            {selectedTrip.discount && (
              <div className={`${s.fareRow} ${s.fareDiscount} num`}>
                <span>{selectedTrip.discount}</span>
                <span>−{formatYen((selectedTrip.fareBase ?? selectedTrip.fare) - selectedTrip.fare)}</span>
              </div>
            )}
            <div className={s.fareDivider} />
            <div className={`${s.fareRow} ${s.fareTotal} num`}>
              <span>請求額</span>
              <span>{formatYen(selectedTrip.fare)}</span>
            </div>
            <div className={s.fareNote}>
              {selectedTrip.vehicleClass} · この区間 {corridorOccurrence || 1} 回目
            </div>
          </div>

          <div className={s.footerRow}>
            <LabelButton variant="primary">Recordsで開く</LabelButton>
            <LabelButton>コピー</LabelButton>
          </div>
        </div>
      )}
    </div>
  );
}
