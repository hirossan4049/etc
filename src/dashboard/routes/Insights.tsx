import { Fragment, useMemo, useState } from 'react';
import {
  TIME_BLOCKS,
  WEEKDAYS_JA,
  hourHistogram,
  monthlyTotals,
  pctDelta,
  rankByIc,
  rankByRoad,
  recentMonthKeys,
  recordsOfMonth,
  tripsInMonth,
  weekdayTimeHeatmap,
  type MonthTotals,
} from '../lib/aggregate';
import { useDashboardContext } from '../lib/context';
import { formatDuration, formatKm, formatMonthLabel, formatYen, monthKey } from '../lib/format';
import { ChevronLeftIcon, ChevronRightIcon, ExportIcon } from '../components/Icon';
import { IconButton, LabelButton, Segmented } from '../components/Primitives';
import s from './Insights.module.css';

const METRICS = [
  { value: 'km', label: '距離' },
  { value: 'fare', label: '料金' },
  { value: 'speed', label: '平均速度' },
] as const;
type Metric = (typeof METRICS)[number]['value'];

const SCALES = [
  { value: 'month', label: '月' },
  { value: 'quarter', label: '四半期' },
  { value: 'year', label: '年' },
] as const;
type Scale = (typeof SCALES)[number]['value'];

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

function metricValue(m: MonthTotals, metric: Metric): number {
  return metric === 'km' ? m.km : metric === 'fare' ? m.fare : Math.round(m.avgSpeed);
}

function formatTick(value: number, metric: Metric): string {
  if (metric === 'fare') return value >= 10000 ? `${value / 10000}万` : String(value);
  if (metric === 'speed') return String(value);
  return String(value);
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / (values.length - 1 || 1)) * 88},${28 - (v / max) * 26 - 1}`);
  const last = points[points.length - 1]?.split(',').map(Number) ?? [88, 27];
  return (
    <svg width="88" height="28" className={s.sparkline}>
      <polyline points={points.join(' ')} fill="none" stroke="var(--text-3)" strokeWidth={1.25} opacity={0.7} />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--accent)" />
    </svg>
  );
}

export function Insights() {
  const { trips } = useDashboardContext();
  const [cursor, setCursor] = useState(() => new Date());
  const [metric, setMetric] = useState<Metric>('km');
  const [scale, setScale] = useState<Scale>('month');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const selectedKey = monthKey(cursor.toISOString());
  const monthTrips = useMemo(() => tripsInMonth(trips, selectedKey), [trips, selectedKey]);
  const prevCursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  const prevTrips = useMemo(() => tripsInMonth(trips, monthKey(prevCursor.toISOString())), [trips, prevCursor]);

  const months12 = useMemo(() => recentMonthKeys(12, cursor), [cursor]);
  const totals = useMemo(() => monthlyTotals(trips, months12), [trips, months12]);

  const periodTotals: MonthTotals[] = useMemo(() => {
    if (scale === 'month') return totals;
    const bucketSize = scale === 'quarter' ? 3 : 12;
    const buckets: MonthTotals[] = [];
    for (let i = 0; i < totals.length; i += bucketSize) {
      const chunk = totals.slice(i, i + bucketSize);
      const km = chunk.reduce((a, m) => a + m.km, 0);
      const fare = chunk.reduce((a, m) => a + m.fare, 0);
      const count = chunk.reduce((a, m) => a + m.count, 0);
      const speeds = chunk.filter((m) => m.avgSpeed).map((m) => m.avgSpeed);
      buckets.push({
        key: chunk[0].key,
        km,
        fare,
        count,
        avgSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      });
    }
    return buckets;
  }, [totals, scale]);

  const sumKm = monthTrips.reduce((a, t) => a + (t.distanceKm ?? 0), 0);
  const sumFare = monthTrips.reduce((a, t) => a + t.fare, 0);
  const avgSpeedValues = monthTrips.filter((t) => t.speedKmh).map((t) => t.speedKmh as number);
  const avgSpeed = avgSpeedValues.length ? avgSpeedValues.reduce((a, b) => a + b, 0) / avgSpeedValues.length : 0;
  const discounted = monthTrips.filter((t) => t.discount);
  const savings = discounted.reduce((a, t) => a + ((t.fareBase ?? t.fare) - t.fare), 0);
  const morningShare = monthTrips.length
    ? Math.round(
        (monthTrips.filter((t) => new Date(t.exitAt).getHours() < 9 && new Date(t.exitAt).getHours() >= 6).length /
          monthTrips.length) *
          100,
      )
    : 0;

  const prevSumKm = prevTrips.reduce((a, t) => a + (t.distanceKm ?? 0), 0);
  const prevSumFare = prevTrips.reduce((a, t) => a + t.fare, 0);
  const prevSpeeds = prevTrips.filter((t) => t.speedKmh).map((t) => t.speedKmh as number);
  const prevAvgSpeed = prevSpeeds.length ? prevSpeeds.reduce((a, b) => a + b, 0) / prevSpeeds.length : 0;

  const kpis = [
    { label: '総距離', value: formatKm(sumKm, 0), delta: pctDelta(sumKm, prevSumKm), raw: months12.map((k) => totals.find((t) => t.key === k)?.km ?? 0) },
    { label: '通行料金', value: formatYen(sumFare), delta: pctDelta(sumFare, prevSumFare), raw: months12.map((k) => totals.find((t) => t.key === k)?.fare ?? 0) },
    { label: '走行回数', value: `${monthTrips.length} 回`, delta: pctDelta(monthTrips.length, prevTrips.length), raw: months12.map((k) => totals.find((t) => t.key === k)?.count ?? 0) },
    { label: '平均速度', value: `${Math.round(avgSpeed)} km/h`, delta: pctDelta(avgSpeed, prevAvgSpeed), raw: months12.map((k) => totals.find((t) => t.key === k)?.avgSpeed ?? 0) },
  ];

  const roads = rankByRoad(monthTrips);
  const maxRoadCount = Math.max(1, ...roads.map((r) => r.count));
  const ics = rankByIc(monthTrips).slice(0, 8);
  const hours = hourHistogram(monthTrips);
  const maxHour = Math.max(1, ...hours);
  const heatmap = weekdayTimeHeatmap(monthTrips);
  const maxHeat = Math.max(1, ...heatmap.flat());
  const records = recordsOfMonth(monthTrips);

  const max = niceMax(Math.max(...periodTotals.map((m) => metricValue(m, metric)), 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const avgVal = periodTotals.reduce((a, m) => a + metricValue(m, metric), 0) / (periodTotals.length || 1);
  const now = new Date();
  const isCurrentMonth = (key: string) => key === monthKey(now.toISOString());

  return (
    <div className={s.page}>
      <div className={s.main}>
        <div className={s.toolbar}>
          <div className={s.monthStep}>
            <IconButton label="前の月" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeftIcon />
            </IconButton>
            <span className={`${s.monthLabel} num`}>{formatMonthLabel(selectedKey)}</span>
            <IconButton label="次の月" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRightIcon />
            </IconButton>
          </div>
          <Segmented options={SCALES} value={scale} onChange={setScale} />
          <div className={s.spacer} />
          <LabelButton>
            <ExportIcon /> CSVを書き出す
          </LabelButton>
        </div>

        <div className={s.headline}>
          <h1 className={`${s.h1} num`}>
            {Number(selectedKey.split('-')[1])}月は<b>{monthTrips.length}回</b>、<b>{formatKm(sumKm, 0)}</b> を走行しました。
          </h1>
          <p className={`${s.sub} num`}>
            通行料金は<b>{formatYen(sumFare)}</b>。休日・深夜割引で <span className={s.pos}>{formatYen(savings)}</span>{' '}
            節約し、平日朝（6–9時）の利用が全体の {morningShare}% を占めています。
          </p>
        </div>

        <div className={s.kpis}>
          {kpis.map((kpi) => (
            <div className={s.kpi} key={kpi.label}>
              <div>
                <div className={s.kpiLabel}>{kpi.label}</div>
                <div className={`${s.kpiValueRow} num`}>
                  <span className={s.kpiValue}>{kpi.value}</span>
                </div>
                <div className={`${s.kpiDelta} ${kpi.delta !== undefined && kpi.delta > 0 ? s.up : ''} num`}>
                  {kpi.delta !== undefined ? `${kpi.delta > 0 ? '+' : ''}${kpi.delta.toFixed(1)}% 前月比` : '—'}
                </div>
              </div>
              <Sparkline values={kpi.raw.slice(-6)} />
            </div>
          ))}
        </div>

        <div className={s.sectionHead}>
          <div className={s.chartRow}>
            <div>
              <h2 className={s.h2}>月別の推移</h2>
              <p className={s.sectionDesc}>
                {METRICS.find((m) => m.value === metric)?.label}
                {isCurrentMonth(months12[months12.length - 1]) ? ` · ${now.getMonth() + 1}月は${now.getDate()}日までの途中集計` : ''}
              </p>
            </div>
            <Segmented options={METRICS} value={metric} onChange={setMetric} />
          </div>

          <div className={s.chart}>
            <div className={s.yAxis}>
              {[...ticks].reverse().map((t) => (
                <span key={t}>{formatTick(t, metric)}</span>
              ))}
            </div>
            <div className={s.plot}>
              {ticks.map((t) => (
                <div key={t} className={s.gridLine} style={{ bottom: `${(t / max) * 100}%` }} />
              ))}
              <div className={s.avgLine} style={{ bottom: `${Math.min(100, (avgVal / max) * 100)}%` }}>
                <span className={s.avgLabel}>平均 {formatTick(Math.round(avgVal), metric)}</span>
              </div>
              {periodTotals.map((m, i) => {
                const val = metricValue(m, metric);
                const height = Math.min(100, (val / max) * 100);
                const current = m.key === selectedKey;
                const partial = scale === 'month' && isCurrentMonth(m.key);
                return (
                  <div
                    key={m.key}
                    className={s.col}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {hoveredBar === i && (
                      <div className={s.tip}>
                        {formatMonthLabel(m.key)} {formatTick(val, metric)}
                      </div>
                    )}
                    <div
                      className={`${s.bar} ${current ? s.current : ''} ${partial ? s.partial : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className={s.monthLabels}>
            {periodTotals.map((m, i) => {
              const [y, mm] = m.key.split('-');
              const showYear = i === 0 || i === 1;
              return (
                <span key={m.key} className={s.monthTick}>
                  {Number(mm)}月{showYear ? y : ''}
                </span>
              );
            })}
          </div>
        </div>

        <div className={s.split}>
          <div>
            <h2 className={s.h2}>利用道路</h2>
            <div className={s.rankHead}>
              <span>#</span>
              <span>道路</span>
              <span />
              <span>回数</span>
              <span>距離</span>
              <span>料金</span>
            </div>
            {roads.map((road, i) => (
              <div className={s.rankRow} key={road.name}>
                <span className={s.rankNum}>{i + 1}</span>
                <span className={s.rankName}>{road.name}</span>
                <span
                  className={s.rankBar}
                  style={{ width: `${(road.count / maxRoadCount) * 100}%` }}
                />
                <span className={`${s.rankCount} num`}>{road.count}</span>
                <span className={`${s.rankMeta} num`}>{formatKm(road.km, 1)}</span>
                <span className={`${s.rankMeta} num`}>{formatYen(road.fare)}</span>
              </div>
            ))}

            <h2 className={s.h2} style={{ marginTop: 32 }}>
              よく使うIC
            </h2>
            <div className={s.icList}>
              {ics.map((ic, i) => (
                <div className={s.icRow} key={ic.name}>
                  <span>
                    {i + 1}. {ic.name}
                  </span>
                  <span className="num">{ic.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className={s.h2}>時間帯</h2>
            <div className={s.histogram}>
              {hours.map((n, h) => (
                <div
                  key={h}
                  className={s.histBar}
                  title={`${h}時台 ${n}回`}
                  style={{ height: `${(n / maxHour) * 100}%` }}
                />
              ))}
            </div>
            <div className={s.histLabels}>
              <span>0時</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24時</span>
            </div>

            <h2 className={s.h2} style={{ marginTop: 32 }}>
              曜日 × 時間帯
            </h2>
            <div className={s.heatmap}>
              <span />
              {TIME_BLOCKS.map((b) => (
                <span key={b} className={s.heatHead}>
                  {b}
                </span>
              ))}
              {WEEKDAYS_JA.map((day, row) => (
                <Fragment key={day}>
                  <span className={s.heatRowLabel}>{day}</span>
                  {heatmap[row].map((value, col) => (
                    <div
                      key={`${day}-${col}`}
                      className={s.heatCell}
                      style={{
                        background:
                          value === 0
                            ? 'var(--hover)'
                            : `color-mix(in srgb, var(--accent) ${Math.round((value / maxHeat) * 100)}%, var(--surface))`,
                      }}
                      onMouseEnter={() => setHoveredCell({ row, col })}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  ))}
                </Fragment>
              ))}
              <div className={s.heatFooter}>
                <span>
                  {hoveredCell
                    ? `${WEEKDAYS_JA[hoveredCell.row]}曜 ${TIME_BLOCKS[hoveredCell.col]}時 — ${heatmap[hoveredCell.row][hoveredCell.col]}回`
                    : 'セルをホバーすると詳細を表示します'}
                </span>
                <span className={s.heatLegend}>
                  少
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <span
                      key={f}
                      className={s.heatSwatch}
                      style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(f * 100)}%, var(--surface))` }}
                    />
                  ))}
                  多
                </span>
              </div>
            </div>

            <h2 className={s.h2} style={{ marginTop: 32 }}>
              この月の記録
            </h2>
            <div className={s.records}>
              <div className={s.recordRow}>
                <span className={s.recordLabel}>最長</span>
                <div>
                  <div className={`${s.recordValue} num`}>{formatKm(records.longest?.distanceKm ?? 0)}</div>
                  <div className={s.recordMeta}>
                    {records.longest ? `${records.longest.entryName} → ${records.longest.exitName}` : '—'}
                  </div>
                </div>
              </div>
              <div className={s.recordRow}>
                <span className={s.recordLabel}>最高平均速度</span>
                <div>
                  <div className={`${s.recordValue} num`}>{records.fastestAvg?.speedKmh ?? '—'} km/h</div>
                  <div className={s.recordMeta}>
                    {records.fastestAvg ? `${records.fastestAvg.entryName} → ${records.fastestAvg.exitName}` : '—'}
                  </div>
                </div>
              </div>
              <div className={s.recordRow}>
                <span className={s.recordLabel}>割引適用</span>
                <div>
                  <div className={`${s.recordValue} num`}>
                    {records.discountCount}回 −{formatYen(records.discountSavings)}
                  </div>
                </div>
              </div>
              <div className={s.recordRow}>
                <span className={s.recordLabel}>最多区間</span>
                <div>
                  <div className={`${s.recordValue} num`}>{records.topCorridor?.count ?? 0}回</div>
                  <div className={s.recordMeta}>
                    {records.topCorridor
                      ? `${records.topCorridor.label} · 平均 ${formatDuration(records.topCorridor.avgMinutes)}`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className={s.footnote}>表示中の値は取り込み済みの明細から集計しています。料金は請求確定前の見込みを含む場合があります。</p>
      </div>
    </div>
  );
}
