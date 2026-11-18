/**
 * サイトの「ボタン」は `<button>` ではなく `<input type="button">` / `<input type="submit">`
 * のことが多い（docs/site-notes.md、実アカウントで確認）。両方を対象に、表示テキスト
 * （`<button>`は textContent、`<input>`は value）で検索する。
 *
 * 「明細ＣＳＶ」のように英数字だけ全角になっているラベルがある（docs/site-notes.md）。
 * NFKC正規化で全角/半角の違いを吸収してから比較する。
 */
function normalizeLabel(s: string | null | undefined): string {
  return (s ?? '').trim().normalize('NFKC');
}

export type ClickableButton = HTMLButtonElement | HTMLInputElement;

export function findButtonByText(text: string): ClickableButton | undefined {
  const target = normalizeLabel(text);
  const candidates = Array.from(
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button, input[type="button"], input[type="submit"]',
    ),
  );
  return candidates.find((el) => {
    const label = el instanceof HTMLInputElement ? el.value : el.textContent;
    return normalizeLabel(label) === target;
  });
}

export function findLinkByText(text: string): HTMLAnchorElement | undefined {
  const target = normalizeLabel(text);
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).find(
    (a) => normalizeLabel(a.textContent) === target,
  );
}
