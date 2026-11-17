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
 */
export function isFlowGuardScreen(): boolean {
  return document.title.includes('確認してください') || Boolean(findFlowGuardRecoverButton());
}

export function findFlowGuardRecoverButton(): HTMLButtonElement | undefined {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  return buttons.find((b) => b.textContent?.trim() === '利用明細へ');
}
