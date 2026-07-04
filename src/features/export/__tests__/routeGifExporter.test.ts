/**
 * routeGifExporter のテスト。
 *
 * captureFrameRgba 内では react-native-view-shot / upng-js / buffer を利用するため、
 * これらのネイティブ依存部分はモックで代替する。
 * GIFエンコード（gifenc）も同様にモックし、制御フロー（中断・共有可否エラー）を検証する。
 */

// jest.mock はホイストされるため、以下の import より先に実行される
jest.mock('gifenc', () => ({
  GIFEncoder: jest.fn(() => ({
    writeFrame: jest.fn(),
    finish: jest.fn(() => new Uint8Array([0x47, 0x49, 0x46])),
    bytes: jest.fn(() => new Uint8Array([0x47, 0x49, 0x46])),
  })),
  quantize: jest.fn(() => [[0, 0, 0]]),
  applyPalette: jest.fn(() => new Uint8Array([0])),
}));

jest.mock('upng-js', () => ({
  decode: jest.fn(() => ({ width: 2, height: 2, data: new Uint8Array(4) })),
  toRGBA8: jest.fn(() => [new ArrayBuffer(16)]),
}));

jest.mock('buffer', () => ({
  Buffer: {
    from: jest.fn((data: unknown, encoding?: string) => {
      if (encoding === 'base64') {
        // base64 デコード: 長さのある ArrayBuffer を返す
        return { buffer: new ArrayBuffer(4), byteOffset: 0, byteLength: 4, toString: jest.fn(() => 'base64-gif-string') };
      }
      // Uint8Array → base64 変換のシミュレーション
      return { toString: jest.fn(() => 'base64-gif-string') };
    }),
  },
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('base64png=='),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as FileSystem from 'expo-file-system/legacy'; // eslint-disable-line import/first
import * as Sharing from 'expo-sharing'; // eslint-disable-line import/first
import { exportRouteGif, ExportRouteGifOptions } from '@/features/export/routeGifExporter'; // eslint-disable-line import/first

/** テスト用の最小 ExportRouteGifOptions を生成する。 */
function makeOptions(overrides: Partial<ExportRouteGifOptions> = {}): ExportRouteGifOptions {
  return {
    captureTarget: jest.fn(() => ({})),
    frameCount: 2,
    renderFrame: jest.fn().mockResolvedValue(undefined),
    delayMs: 500,
    fileName: 'test-route',
    ...overrides,
  };
}

describe('routeGifExporter GIF生成・共有フロー', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトモックを再設定
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('正常フローで true を返し shareAsync が呼ばれる', async () => {
    const options = makeOptions();

    const result = await exportRouteGif(options);

    expect(result).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  });

  it('GIF生成前の中断で false を返す', async () => {
    // shouldAbort が常に true を返すとフレームループが即中断される
    const options = makeOptions({ shouldAbort: () => true });

    const result = await exportRouteGif(options);

    expect(result).toBe(false);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('GIF生成後・書き込み前の中断で false を返す', async () => {
    // フレーム処理終了後に writeAsStringAsync が呼ばれる前にキャンセルをシミュレートする。
    // buildRouteGif の shouldAbort チェック（フレームループ終了後）が2フレーム分（各フレームで1回ずつ）
    // + 最終チェックで true を返すよう、フレームが終わったあとのタイミングを狙う。
    // ここでは frameCount=1 で、フレームの shouldAbort チェック（index=0 先頭, index=0 末尾）の
    // 次の gif null チェック / 書き込み前チェックで true を返すよう呼び出し回数で制御する。
    let callCount = 0;
    const shouldAbort = () => {
      callCount += 1;
      // 3回目以降（ループ後の gif || shouldAbort() チェック）でキャンセル
      return callCount >= 3;
    };

    const options = makeOptions({ frameCount: 1, shouldAbort });

    const result = await exportRouteGif(options);

    expect(result).toBe(false);
  });

  it('共有が利用できない場合は Error をスローする', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const options = makeOptions();

    await expect(exportRouteGif(options)).rejects.toThrow('この端末では共有機能を利用できません。');
  });

  it('frameCount=0 の場合もクラッシュせずに true を返す', async () => {
    const options = makeOptions({ frameCount: 0 });

    const result = await exportRouteGif(options);

    expect(result).toBe(true);
  });

  it('ファイル名が正しい URI に組み立てられる', async () => {
    const options = makeOptions({ fileName: 'my-route' });

    await exportRouteGif(options);

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/my-route.gif', expect.any(String), {
      encoding: 'base64',
    });
  });

  it('onProgress コールバックがフレーム数分呼ばれる', async () => {
    const onProgress = jest.fn();
    const options = makeOptions({ frameCount: 3, onProgress });

    await exportRouteGif(options);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });
});
