/** 表記ゆれ（IC有無・全角半角・付記）を落として比較用キーにする。*/
export function normalizeIcName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/(IC|ＩＣ|JCT|ＪＣＴ|SA|ＳＡ|PA|ＰＡ)$/i, '')
    .trim();
}
