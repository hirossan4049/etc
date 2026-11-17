import { useMemo, useState } from 'react';
import type { RouteAgg } from '../lib/aggregate';
import { curvePath, pointForName } from '../lib/geo';
import s from './Explore.module.css';

const VB_W = 1280;
const VB_H = 800;

interface ExploreMapProps {
  routes: RouteAgg[];
  mode: 'freq' | 'flat';
  selectedKey?: string;
  onSelect: (key: string) => void;
}

export function ExploreMap({ routes, mode, selectedKey, onSelect }: ExploreMapProps) {
  const [hoveredKey, setHoveredKey] = useState<string | undefined>();
  const maxFreq = useMemo(() => Math.max(1, ...routes.map((r) => r.freq)), [routes]);
  const selected = routes.find((r) => r.key === selectedKey);

  return (
    <svg className={s.map} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="走行ルート地図">
      {routes.map((route) => {
        const a = pointForName(route.entryName, VB_W, VB_H);
        const b = pointForName(route.exitName, VB_W, VB_H);
        const d = curvePath(a, b);
        const isSelected = route.key === selectedKey;
        const isHovered = route.key === hoveredKey;
        const freqRatio = route.freq / maxFreq;
        const width = mode === 'freq' ? 1.1 + 3.4 * Math.sqrt(freqRatio) : 2.2;
        const opacity = mode === 'freq' ? 0.2 + 0.64 * Math.sqrt(freqRatio) : 0.62;
        const dimmed = Boolean(selectedKey) && !isSelected;

        return (
          <g key={route.key}>
            <path className={s.routeCase} d={d} strokeWidth={width + 2.5} />
            <path
              className={s.route}
              d={d}
              strokeWidth={isHovered ? 3.2 : width}
              style={{ opacity: dimmed ? opacity * 0.3 : isHovered ? 0.9 : opacity }}
            />
            <path
              className={s.routeHit}
              d={d}
              onMouseEnter={() => setHoveredKey(route.key)}
              onMouseLeave={() => setHoveredKey(undefined)}
              onClick={() => onSelect(route.key)}
            />
          </g>
        );
      })}

      {selected &&
        (() => {
          const a = pointForName(selected.entryName, VB_W, VB_H);
          const b = pointForName(selected.exitName, VB_W, VB_H);
          const d = curvePath(a, b);
          return (
            <g>
              <path className={s.routeHighlightCase} d={d} />
              <path className={s.routeHighlight} d={d} />
              <circle className={s.pinStart} cx={a.x} cy={a.y} r={5.5} />
              <circle className={s.pinEnd} cx={b.x} cy={b.y} r={6} />
              <text className={s.pinLabel} x={a.x + 10} y={a.y + 4}>
                {selected.entryName}
              </text>
              <text className={s.pinLabel} x={b.x + 10} y={b.y + 4}>
                {selected.exitName}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}
