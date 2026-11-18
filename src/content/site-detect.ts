import { findButtonByText } from './dom-helpers';

/**
 * ログイン前とログイン後は同一URL（docs/site-notes.md）なので、DOM内容で判定する。
 */
export function isLoggedInPage(): boolean {
  const bodyText = document.body?.innerText ?? '';
  return bodyText.includes('ログアウト') && bodyText.includes('利用明細の表示');
}

export function isLoginScreen(): boolean {
  return Boolean(document.querySelector('input[type="password"]')) && !isLoggedInPage();
}

/**
 * ブラウザの「戻る」・30分超の古い画面への再アクセス・お気に入りからの直接アクセス等で出る
 * 画面遷移ガード（セッション切れではない）。「利用明細へ」ボタンで再ログインなしに復帰できる。
 * 実際のボタンは `<input type="button">`（docs/site-notes.md）。
 *
 * 注意: 「利用明細検索 -確認してください-」（検索条件の入力値エラー、ボタンは「再入力」）など、
 * タイトルに「確認してください」を含む別のエラー画面もあるため、タイトルだけでは判定しない。
 * 「利用明細へ」ボタンの有無で判定する。
 */
export function isFlowGuardScreen(): boolean {
  return Boolean(findFlowGuardRecoverButton());
}

export function findFlowGuardRecoverButton() {
  return findButtonByText('利用明細へ');
}

/**
 * タイトルに「確認してください」を含むが、既知の復帰ボタン（利用明細へ）が無いページ。
 * 検索条件の入力値エラーなど、想定外の失敗として扱う。
 */
export function isUnknownConfirmScreen(): boolean {
  return document.title.includes('確認してください') && !isFlowGuardScreen();
}
