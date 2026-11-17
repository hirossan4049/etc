import { useMemo, useState } from 'react';
import type { Trip } from '../../shared/types';
import { groupByMonth } from '../lib/aggregate';
import { useDashboardContext } from '../lib/context';
import {
  formatDateShort,
  formatDuration,
  formatKm,
  formatMonthLabel,
  formatTime,
  formatYen,
  recordCode,
} from '../lib/format';
import { curvePath, pointForName } from '../lib/geo';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, ExportIcon, FilterIcon, SearchIcon } from '../components/Icon';
import { Chip, IconButton, LabelButton, Tag } from '../components/Primitives';
import { EmptyState } from '../components/EmptyState';
import s from './Records.module.css';

type SortKey = 'date' | 'time' | 'route' | 'road' | 'km' | 'duration' | 'speed' | 'fare';
type Dir = 'asc' | 'desc';

const PERIODS = [
  { label: '直近30日', days: 30 },
  { label: '直近90日', days: 90 },
  { label: '全期間', days: Infinity },
] as const;

const DISCOUNT_FILTERS = [
  { value: 'all', label: 'すべて' },
  { value: 'with', label: '割引あり' },
  { value: 'without', label: '割引なし' },
] as const;
type DiscountFilter = (typeof DISCOUNT_FILTERS)[number]['value'];

const COLUMN_LABELS: Record<SortKey, string> = {
  date: '日付',
  time: '時刻',
  route: '区間',
  road: '道路',
  km: '距離',
  duration: '所要',
  speed: 'km/h',
  fare: '料金',
};

function durationMinutes(trip: Trip): number {
  if (!trip.entryAt) return 0;
  return (new Date(trip.exitAt).getTime() - new Date(trip.entryAt).getTime()) / 60000;
}

function compare(a: Trip, b: Trip, key: SortKey): number {
  switch (key) {
    case 'date':
    case 'time':
      return a.exitAt.localeCompare(b.exitAt);
    case 'route':
      return a.exitName.localeCompare(b.exitName);
    case 'road':
      return (a.road ?? '').localeCompare(b.road ?? '');
    case 'km':
      return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    case 'duration':
      return durationMinutes(a) - durationMinutes(b);
    case 'speed':
      return (a.speedKmh ?? 0) - (b.speedKmh ?? 0);
    case 'fare':
      return a.fare - b.fare;
  }
}

export function Records() {
  const { trips } = useDashboardContext();
  const [query, setQuery] = useState('');
  const [periodIdx, setPeriodIdx] = useState(1);
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: 'date', dir: 'desc' });
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const period = PERIODS[periodIdx];

  const filtered = useMemo(() => {
    const q = query.trim();
    return trips.filter((t) => {
      if (Number.isFinite(period.days) && Date.now() - new Date(t.exitAt).getTime() > period.days * 86400000) return false;
      if (discountFilter === 'with' && !t.discount) return false;
      if (discountFilter === 'without' && t.discount) return false;
      if (q && !`${t.entryName ?? ''}${t.exitName}${t.road ?? ''}`.includes(q)) return false;
      return true;
    });
  }, [trips, query, period, discountFilter]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => dir * compare(a, b, sort.key));
  }, [filtered, sort]);

  const groups = useMemo(() => groupByMonth(sorted), [sorted]);

  const selectedTrip = sorted.find((t) => t.id === selectedId);
  const selectedIndex = selectedTrip ? sorted.findIndex((t) => t.id === selectedTrip.id) : -1;

  const sumKm = filtered.reduce((a, t) => a + (t.distanceKm ?? 0), 0);
  const sumFare = filtered.reduce((a, t) => a + t.fare, 0);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  }

  function th(key: SortKey, right = false) {
    return (
      <button type="button" className={`${s.th} ${right ? s.right : ''}`} onClick={() => toggleSort(key)}>
        {COLUMN_LABELS[key]}
        {sort.key === key && <span className={s.sortArrow}>{sort.dir === 'desc' ? '↓' : '↑'}</span>}
      </button>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <span className={s.title}>
          すべての走行 <span className={`${s.titleCount} num`}>{filtered.length}</span>
        </span>
        <div className={s.search}>
          <SearchIcon />
          <input placeholder="IC・道路で絞り込み" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Chip active onClick={() => setPeriodIdx((i) => (i + 1) % PERIODS.length)}>
          <CalendarIcon /> 期間 <b>{period.label}</b>
        </Chip>
        {DISCOUNT_FILTERS.map((f) => (
          <Chip key={f.value} active={discountFilter === f.value} onClick={() => setDiscountFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
        <Chip dashed>
          <FilterIcon /> フィルタ
        </Chip>
        <div className={s.spacer} />
        <span className={s.sortLabel}>
          並び順 {COLUMN_LABELS[sort.key]} {sort.dir === 'desc' ? '↓' : '↑'}
        </span>
        <LabelButton>
          <ExportIcon /> CSV
        </LabelButton>
      </div>

      <div className={s.body}>
        <div className={s.tableWrap}>
          <div className={s.grid} role="table" aria-label="走行記録">
            <div className={`${s.tr} ${s.headRow}`} role="row">
              {th('date')}
              {th('time')}
              {th('route')}
              {th('road')}
              {th('km', true)}
              {th('duration', true)}
              {th('speed', true)}
              {th('fare', true)}
              <span className={`${s.th} ${s.right}`}>割引</span>
            </div>

            {groups.length === 0 ? (
              <div className={s.emptyWrap}>
                <EmptyState
                  variant="filtered"
                  title="一致する記録がありません"
                  body="検索語やフィルタを変更してください。"
                  action={{
                    label: 'フィルタをリセット',
                    onClick: () => {
                      setQuery('');
                      setDiscountFilter('all');
                      setPeriodIdx(2);
                    },
                  }}
                />
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key} className={s.row}>
                  <div className={s.grpRow}>
                    <span>▾</span>
                    <b>{formatMonthLabel(group.key)}</b>
                    <span className={s.grpCount}>{group.trips.length}件</span>
                    <span className={s.grpSpacer} />
                    <span className={`${s.grpSum} num`}>
                      {formatKm(group.sumKm)} · {formatYen(group.sumFare)}
                    </span>
                  </div>
                  {group.trips.map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      role="row"
                      className={`${s.tr} ${trip.id === selectedId ? s.sel : ''}`}
                      onClick={() => setSelectedId(trip.id)}
                    >
                      <span className="num">{formatDateShort(trip.exitAt)}</span>
                      <span className="num">{formatTime(trip.exitAt)}</span>
                      <span className={s.cellEllipsis}>
                        {trip.entryName} → {trip.exitName}
                      </span>
                      <span className={s.cellEllipsis} style={{ color: 'var(--text-2)' }}>
                        {trip.road}
                      </span>
                      <span className={`${s.cellRight} num`}>{trip.distanceKm?.toFixed(1)}</span>
                      <span className={`${s.cellRight} num`} style={{ color: 'var(--text-2)' }}>
                        {trip.entryAt ? formatDuration(durationMinutes(trip)) : '—'}
                      </span>
                      <span className={`${s.cellRight} num`} style={{ color: 'var(--text-2)' }}>
                        {trip.speedKmh ?? '—'}
                      </span>
                      <span className={`${s.cellRight} num`} style={{ fontWeight: 500 }}>
                        {formatYen(trip.fare)}
                      </span>
                      <span className={s.cellRight}>{trip.discount && <Tag>{trip.discount}</Tag>}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {selectedTrip && (
          <RecordPanel
            trip={selectedTrip}
            onClose={() => setSelectedId(undefined)}
            onPrev={() => setSelectedId(sorted[selectedIndex - 1]?.id)}
            onNext={() => setSelectedId(sorted[selectedIndex + 1]?.id)}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex >= 0 && selectedIndex < sorted.length - 1}
          />
        )}
      </div>

      <div className={`${s.footerBar} num`}>
        <span>{filtered.length} 件</span>
        <span>合計 {formatKm(sumKm)}</span>
        <span>料金 {formatYen(sumFare)}</span>
      </div>
    </div>
  );
}

interface RecordPanelProps {
  trip: Trip;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function RecordPanel({ trip, onClose, onPrev, onNext, hasPrev, hasNext }: RecordPanelProps) {
  const a = pointForName(trip.entryName ?? trip.exitName, 300, 150, 24);
  const b = pointForName(trip.exitName, 300, 150, 24);
  const d = curvePath(a, b);

  return (
    <div className={s.panel}>
      <div className={s.panelTop}>
        <span className={`${s.panelCode} mono`}>{recordCode(trip.id, trip.exitAt)}</span>
        <IconButton label="前の記録" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeftIcon />
        </IconButton>
        <IconButton label="次の記録" onClick={onNext} disabled={!hasNext}>
          <ChevronRightIcon />
        </IconButton>
        <IconButton label="閉じる" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      <div className={s.panelTitleBlock}>
        <div className={`${s.panelMeta} num`}>
          {formatDateShort(trip.exitAt)} {formatTime(trip.exitAt)}
        </div>
        <div className={s.panelH2}>
          {trip.entryName} → {trip.exitName}
        </div>
        <div className={s.panelRoad}>{trip.road}</div>
      </div>

      <div className={s.miniMap}>
        <svg width="100%" height="100%" viewBox="0 0 300 150" preserveAspectRatio="xMidYMid meet">
          <path d={d} fill="none" stroke="var(--surface)" strokeWidth={6} strokeLinecap="round" />
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={a.x} cy={a.y} r={5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
          <circle cx={b.x} cy={b.y} r={5.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        </svg>
        <LabelButton variant="primary" className={s.miniMapLink}>
          地図で見る
        </LabelButton>
      </div>

      <dl className={s.statGrid}>
        <div className={s.statCell}>
          <div className={s.statLabel}>距離</div>
          <div className={`${s.statValue} num`}>{formatKm(trip.distanceKm ?? 0)}</div>
        </div>
        <div className={s.statCell}>
          <div className={s.statLabel}>所要</div>
          <div className={`${s.statValue} num`}>{trip.entryAt ? formatDuration(durationMinutes(trip)) : '—'}</div>
        </div>
        <div className={s.statCell}>
          <div className={s.statLabel}>平均</div>
          <div className={`${s.statValue} num`}>{trip.speedKmh ? `${trip.speedKmh} km/h` : '—'}</div>
        </div>
        <div className={s.statCell}>
          <div className={s.statLabel}>料金</div>
          <div className={`${s.statValue} num`}>{formatYen(trip.fare)}</div>
        </div>
      </dl>

      <div className={s.sectionTitle}>通過記録</div>
      <div className={s.stops}>
        <div className={s.stop}>
          <span className={s.stopDotStart} />
          <span className={s.stopLine} />
          <span className={s.stopBody}>
            <span>{trip.entryName ?? '不明'}</span>
            <span className={`${s.stopTime} num`}>{trip.entryAt ? formatTime(trip.entryAt) : '—'}</span>
          </span>
        </div>
        <div className={s.stop}>
          <span className={s.stopDotEnd} />
          <span className={s.stopBody}>
            <span>{trip.exitName}</span>
            <span className={`${s.stopTime} num`}>{formatTime(trip.exitAt)}</span>
          </span>
        </div>
      </div>

      <div className={s.sectionTitle}>明細</div>
      <div className={`${s.breakdown} num`}>
        <div className={s.breakdownRow}>
          <span>通常料金</span>
          <span>{formatYen(trip.fareBase ?? trip.fare)}</span>
        </div>
        <div className={s.breakdownRow}>
          <span>割引</span>
          <span className={trip.discount ? s.breakdownWarn : s.breakdownMuted}>
            {trip.discount ? `${trip.discount} −${formatYen((trip.fareBase ?? trip.fare) - trip.fare)}` : '—'}
          </span>
        </div>
        <div className={s.breakdownDivider} />
        <div className={`${s.breakdownRow} ${s.breakdownTotal}`}>
          <span>請求額</span>
          <span>{formatYen(trip.fare)}</span>
        </div>
        <div className={s.breakdownDivider} />
        <div className={s.breakdownRow}>
          <span>車種区分</span>
          <span>{trip.vehicleClass}</span>
        </div>
        <div className={s.breakdownRow}>
          <span>ETCカード</span>
          <span className="mono">•••• {trip.cardLast4}</span>
        </div>
      </div>
    </div>
  );
}
