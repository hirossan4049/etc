import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { RouteAgg } from '../lib/aggregate';
import { getIcCoordinate } from '../../shared/ic-coordinates';
import { fetchRouteGeometry } from '../lib/route-geometry';
import s from './Explore.module.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

/**
 * Mapbox GL + Mapbox Directions(driving)。IC間の直線ではなく、実際の道路線形に
 * スナップした経路を描く(§5 Phase1の発展形)。「車線」単位ではなくセンターライン
 * 単位のトレースであることに注意(Mapboxはレーン単位のジオメトリを提供しない)。
 * 区間ごとの経路ジオメトリは`route-geometry.ts`がIndexedDBに永続キャッシュする。
 */
const MAPBOX_STYLE = 'mapbox://styles/mapbox/navigation-day-v1';

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };
const DEFAULT_CENTER: [number, number] = [135.6, 34.75];

type GeometryCache = Record<string, [number, number][]>;

interface ExploreMapProps {
  routes: RouteAgg[];
  mode: 'freq' | 'flat';
  selectedKey?: string;
  onSelect: (key: string) => void;
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>;
}

function themeColor(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || '#888888';
}

/** 実道路ジオメトリのキャッシュがあればそれを、無ければIC間の直線を返す。 */
function routeLineCoordinates(route: RouteAgg, geometryCache: GeometryCache): [number, number][] | undefined {
  const cached = geometryCache[route.key];
  if (cached) return cached;
  const a = getIcCoordinate(route.entryName);
  const b = getIcCoordinate(route.exitName);
  if (!a || !b) return undefined;
  return [
    [a.lon, a.lat],
    [b.lon, b.lat],
  ];
}

function buildRoutesFeatureCollection(
  routes: RouteAgg[],
  mode: 'freq' | 'flat',
  selectedKey: string | undefined,
  hoveredKey: string | undefined,
  geometryCache: GeometryCache,
): FeatureCollection {
  const maxFreq = Math.max(1, ...routes.map((r) => r.freq));
  const features: Feature[] = [];
  for (const route of routes) {
    const coordinates = routeLineCoordinates(route, geometryCache);
    if (!coordinates) continue;

    const isSelected = route.key === selectedKey;
    const isHovered = route.key === hoveredKey;
    const dimmed = Boolean(selectedKey) && !isSelected;
    const freqRatio = route.freq / maxFreq;
    const width = isHovered ? 3.2 : mode === 'freq' ? 1.1 + 3.4 * Math.sqrt(freqRatio) : 2.2;
    const baseOpacity = mode === 'freq' ? 0.2 + 0.64 * Math.sqrt(freqRatio) : 0.62;
    const opacity = dimmed ? baseOpacity * 0.3 : isHovered ? 0.9 : baseOpacity;

    features.push({
      type: 'Feature',
      properties: {
        key: route.key,
        width,
        opacity,
        entryName: route.entryName,
        exitName: route.exitName,
        freq: route.freq,
        traced: Boolean(geometryCache[route.key]),
      },
      geometry: { type: 'LineString', coordinates },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildSelectedFeatureCollections(
  routes: RouteAgg[],
  selectedKey: string | undefined,
  geometryCache: GeometryCache,
): { line: FeatureCollection; pins: FeatureCollection } {
  const selected = routes.find((r) => r.key === selectedKey);
  if (!selected) return { line: EMPTY_FC, pins: EMPTY_FC };
  const coordinates = routeLineCoordinates(selected, geometryCache);
  if (!coordinates) return { line: EMPTY_FC, pins: EMPTY_FC };

  const [startLon, startLat] = coordinates[0];
  const [endLon, endLat] = coordinates[coordinates.length - 1];

  const line: FeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }],
  };
  const pins: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: selected.entryName, role: 'start' }, geometry: { type: 'Point', coordinates: [startLon, startLat] } },
      { type: 'Feature', properties: { name: selected.exitName, role: 'end' }, geometry: { type: 'Point', coordinates: [endLon, endLat] } },
    ],
  };
  return { line, pins };
}

export function ExploreMap({ routes, mode, selectedKey, onSelect, mapRef: externalMapRef }: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const hasFitRef = useRef(false);
  const labelMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const attemptedRef = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | undefined>();
  const [geometryCache, setGeometryCache] = useState<GeometryCache>({});

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: DEFAULT_CENTER,
      zoom: 9,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = map;
    if (externalMapRef) externalMapRef.current = map;
    popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });

    map.on('load', () => {
      map.addSource('routes', { type: 'geojson', data: EMPTY_FC });
      map.addSource('selected-route', { type: 'geojson', data: EMPTY_FC });
      map.addSource('pins', { type: 'geojson', data: EMPTY_FC });

      map.addLayer({
        id: 'routes-case',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': themeColor('--surface'), 'line-width': ['+', ['get', 'width'], 2.5], 'line-opacity': 0.8 },
      });
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': themeColor('--route'),
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      });
      map.addLayer({
        id: 'routes-hit',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 18 },
      });
      map.addLayer({
        id: 'selected-case',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': themeColor('--surface'), 'line-width': 9 },
      });
      map.addLayer({
        id: 'selected-line',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': themeColor('--accent'), 'line-width': 4.5 },
      });
      map.addLayer({
        id: 'pins',
        type: 'circle',
        source: 'pins',
        paint: {
          'circle-radius': 6,
          'circle-color': themeColor('--surface'),
          'circle-stroke-width': 2.5,
          'circle-stroke-color': themeColor('--accent'),
        },
      });

      map.on('mouseenter', 'routes-hit', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'routes-hit', () => {
        map.getCanvas().style.cursor = '';
        setHoveredKey(undefined);
        popupRef.current?.remove();
      });
      map.on('mousemove', 'routes-hit', (e) => {
        const feature = e.features?.[0];
        const key = feature?.properties?.key as string | undefined;
        setHoveredKey(key);
        if (feature && popupRef.current) {
          const { entryName, exitName, freq, traced } = feature.properties as {
            entryName?: string;
            exitName?: string;
            freq?: number;
            traced?: boolean;
          };
          popupRef.current
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-size:12px;font-weight:600;">${entryName ?? ''} → ${exitName ?? ''}</div>` +
                `<div style="font-size:11px;opacity:0.7;">${freq ?? 0}回${traced ? '' : ' ・ 概算(直線距離)'}</div>`,
            )
            .addTo(map);
        }
      });
      map.on('click', 'routes-hit', (e) => {
        const key = e.features?.[0]?.properties?.key as string | undefined;
        if (key) onSelectRef.current(key);
      });

      setReady(true);
    });

    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      if (!map.isStyleLoaded()) return;
      map.setPaintProperty('routes-case', 'line-color', themeColor('--surface'));
      map.setPaintProperty('routes-line', 'line-color', themeColor('--route'));
      map.setPaintProperty('selected-case', 'line-color', themeColor('--surface'));
      map.setPaintProperty('selected-line', 'line-color', themeColor('--accent'));
      map.setPaintProperty('pins', 'circle-color', themeColor('--surface'));
      map.setPaintProperty('pins', 'circle-stroke-color', themeColor('--accent'));
    };
    darkMedia.addEventListener('change', applyTheme);

    return () => {
      darkMedia.removeEventListener('change', applyTheme);
      for (const marker of labelMarkersRef.current) marker.remove();
      labelMarkersRef.current = [];
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      if (externalMapRef) externalMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 各区間の実道路ジオメトリをMapbox Directionsで取得する(初回のみ、以降はIndexedDBキャッシュ)。
  useEffect(() => {
    for (const route of routes) {
      if (attemptedRef.current.has(route.key)) continue;
      const a = getIcCoordinate(route.entryName);
      const b = getIcCoordinate(route.exitName);
      if (!a || !b) continue;
      attemptedRef.current.add(route.key);
      void fetchRouteGeometry(route.key, a, b).then((result) => {
        if (!result) return;
        setGeometryCache((prev) => ({ ...prev, [route.key]: result.coordinates }));
      });
    }
  }, [routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = buildRoutesFeatureCollection(routes, mode, selectedKey, hoveredKey, geometryCache);
    (map.getSource('routes') as mapboxgl.GeoJSONSource | undefined)?.setData(data);

    if (!hasFitRef.current && data.features.length > 0) {
      hasFitRef.current = true;
      const bounds = new mapboxgl.LngLatBounds();
      for (const f of data.features) {
        if (f.geometry.type === 'LineString') {
          for (const c of f.geometry.coordinates) bounds.extend(c as [number, number]);
        }
      }
      map.fitBounds(bounds, { padding: 96, maxZoom: 12, duration: 0 });
    }
  }, [routes, mode, selectedKey, hoveredKey, geometryCache, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const { line, pins } = buildSelectedFeatureCollections(routes, selectedKey, geometryCache);
    (map.getSource('selected-route') as mapboxgl.GeoJSONSource | undefined)?.setData(line);
    (map.getSource('pins') as mapboxgl.GeoJSONSource | undefined)?.setData(pins);

    for (const marker of labelMarkersRef.current) marker.remove();
    labelMarkersRef.current = pins.features.map((f) => {
      const el = document.createElement('div');
      el.className = s.pinLabelHtml;
      el.textContent = String((f.properties as { name?: string })?.name ?? '');
      const [lon, lat] = f.geometry.type === 'Point' ? f.geometry.coordinates : [0, 0];
      return new mapboxgl.Marker({ element: el, anchor: 'left', offset: [10, 0] }).setLngLat([lon, lat]).addTo(map);
    });
  }, [routes, selectedKey, geometryCache, ready]);

  return (
    <div className={s.map} role="img" aria-label="走行ルート地図">
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
