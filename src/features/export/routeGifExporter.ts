import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { buildRouteGif } from './routeGifBuilder';

/** GIF生成・共有の引数。 */
export type ExportRouteGifOptions = {
  /** キャプチャ対象（GifFrameRendererのView ref）の current。 */
  captureTarget: () => unknown;
  /** 総フレーム数。 */
  frameCount: number;
  /** index のコマを描画させ、描画完了（次フレーム）まで待つ。 */
  renderFrame: (index: number) => Promise<void>;
  /** 1コマの表示時間（ミリ秒）。 */
  delayMs: number;
  /** 出力ファイル名（拡張子なし）。 */
  fileName: string;
  /** 進捗通知。 */
  onProgress?: (done: number, total: number) => void;
  /** 中断判定。 */
  shouldAbort?: () => boolean;
};

/** PNGの一時ファイルをRGBAへデコードする。 */
async function captureFrameRgba(captureTarget: () => unknown): Promise<{ data: Uint8Array; width: number; height: number }> {
  const base64 = await captureRef(captureTarget() as never, { format: 'png', quality: 1, result: 'base64', width: 480, height: 480 });
  const pngBuffer = Buffer.from(base64, 'base64');
  const arrayBuffer = pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength);
  const image = UPNG.decode(arrayBuffer);
  const rgba = UPNG.toRGBA8(image)[0];
  return { data: new Uint8Array(rgba), width: image.width, height: image.height };
}

/**
 * その日の移動軌跡をアニメーションGIFとして生成し、共有シートを開く。
 * 中断された場合は何もせず false を返す。
 */
export async function exportRouteGif(options: ExportRouteGifOptions): Promise<boolean> {
  const { captureTarget, frameCount, renderFrame, delayMs, fileName, onProgress, shouldAbort } = options;

  const gif = await buildRouteGif({
    frameCount,
    delayMs,
    onProgress,
    shouldAbort,
    createEncoder: () => {
      const encoder = GIFEncoder();
      return {
        addFrame: (rgba: Uint8Array, width: number, height: number, frameDelayMs: number) => {
          const palette = quantize(rgba, 256);
          const index = applyPalette(rgba, palette);
          encoder.writeFrame(index, width, height, { palette, delay: frameDelayMs });
        },
        finish: () => {
          encoder.finish();
          return encoder.bytes();
        },
      };
    },
    capture: async (index: number) => {
      await renderFrame(index);
      return captureFrameRgba(captureTarget);
    },
  });

  if (!gif) {
    return false;
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}.gif`;
  const base64Gif = Buffer.from(gif).toString('base64');
  await FileSystem.writeAsStringAsync(fileUri, base64Gif, { encoding: FileSystem.EncodingType.Base64 });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('この端末では共有機能を利用できません。');
  }

  await Sharing.shareAsync(fileUri, { mimeType: 'image/gif', dialogTitle: `${fileName}.gif`, UTI: 'com.compuserve.gif' });
  return true;
}
