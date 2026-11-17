import s from './Skeleton.module.css';

const ROW_WIDTHS: [string, string][] = [
  ['78%', '46%'],
  ['64%', '52%'],
  ['84%', '38%'],
];

export function SkeletonList() {
  return (
    <div className={s.card} aria-busy="true" aria-label="読み込み中">
      {ROW_WIDTHS.map(([textWidth, amountWidth], i) => (
        <div className={s.row} key={i}>
          <div className={s.icon} />
          <div className={s.bar} style={{ width: textWidth }} />
          <div className={s.bar} style={{ width: amountWidth }} />
        </div>
      ))}
    </div>
  );
}
