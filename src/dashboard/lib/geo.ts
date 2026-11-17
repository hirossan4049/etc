/**
 * ICの実座標（国土数値情報 N06）は未投入。現状はIC名から決定的な仮の位置を
 * 生成して、相対的な配置のある地図として描画する（§5 Phase1未着手のための暫定実装）。
 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Point {
  x: number;
  y: number;
}

export function pointForName(name: string, width: number, height: number, margin = 110): Point {
  const h = hash(name);
  const h2 = hash(name + '#');
  const x = margin + ((h % 10000) / 10000) * (width - margin * 2);
  const y = margin + ((h2 % 10000) / 10000) * (height - margin * 2);
  return { x, y };
}

export function curvePath(a: Point, b: Point, bend = 0.12): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}
