import { afterEach, describe, expect, it } from 'vitest';
import { findButtonByText, findLinkByText } from './dom-helpers';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('findButtonByText', () => {
  it('matches a real <button> element', () => {
    document.body.innerHTML = '<button>検索</button>';
    expect(findButtonByText('検索')?.tagName).toBe('BUTTON');
  });

  it('matches <input type="button"> by its value, trimming whitespace (実サイトの実際の構造)', () => {
    document.body.innerHTML = '<input type="button" value="  検索  ">';
    const el = findButtonByText('検索');
    expect(el?.tagName).toBe('INPUT');
  });

  it('matches <input type="submit"> by its value', () => {
    document.body.innerHTML = '<input type="submit" value="利用明細へ">';
    expect(findButtonByText('利用明細へ')?.tagName).toBe('INPUT');
  });

  it('returns undefined when nothing matches', () => {
    document.body.innerHTML = '<input type="button" value="別のボタン">';
    expect(findButtonByText('検索')).toBeUndefined();
  });
});

describe('findLinkByText', () => {
  it('matches an <a> element by its trimmed text', () => {
    document.body.innerHTML = '<a href="/x">  全頁選択  </a>';
    expect(findLinkByText('全頁選択')?.tagName).toBe('A');
  });

  it('matches full-width (zenkaku) Latin letters against a half-width query (実サイトの実際の表記)', () => {
    document.body.innerHTML = '<a href="/csv">明細ＣＳＶ</a>';
    expect(findLinkByText('明細CSV')?.getAttribute('href')).toBe('/csv');
  });
});
