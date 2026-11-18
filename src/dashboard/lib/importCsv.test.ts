import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMeisaiCsvFile } from './importCsv';

const fixturePath = resolve(__dirname, '../../../fixtures/sample-meisai.csv');

// jsdom（このテスト環境）には Blob/File.prototype.arrayBuffer が無いため、
// 実ブラウザでは標準で使えるこのメソッドをテスト用に補う（本番コードには手を入れない）。
if (!('arrayBuffer' in Blob.prototype)) {
  (Blob.prototype as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer = function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

describe('parseMeisaiCsvFile', () => {
  it('parses a real (masked) ETC CSV export File into trips', async () => {
    const buffer = readFileSync(fixturePath);
    const file = new File([buffer], 'sample-meisai.csv', { type: 'text/csv' });

    const trips = await parseMeisaiCsvFile(file);
    expect(trips).toHaveLength(94);
    expect(trips[0]).toMatchObject({ entryName: '堺', exitName: '長原', fare: 630, status: 'confirmed' });
  });
});
