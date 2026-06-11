/** RGBAフレームのキャプチャ結果。 */
export type CapturedFrame = { data: Uint8Array; width: number; height: number };

/** 指定インデックスのフレームをRGBAでキャプチャする。 */
export type GifFrameCapture = (frameIndex: number) => Promise<CapturedFrame>;

/** GIFエンコーダの最小インターフェース。 */
export type GifFrameEncoder = {
  addFrame: (rgba: Uint8Array, width: number, height: number, delayMs: number) => void;
  finish: () => Uint8Array;
};

/** buildRouteGif の引数。 */
export type BuildRouteGifOptions = {
  /** 総フレーム数。 */
  frameCount: number;
  /** 1コマの表示時間（ミリ秒）。 */
  delayMs: number;
  /** フレームのキャプチャ関数。 */
  capture: GifFrameCapture;
  /** エンコーダ生成関数。 */
  createEncoder: () => GifFrameEncoder;
  /** 進捗通知（任意）。 */
  onProgress?: (done: number, total: number) => void;
  /** 中断判定（任意）。true を返すと中断し null を返す。 */
  shouldAbort?: () => boolean;
};

/**
 * フレームを順にキャプチャ・エンコードしてGIFバイト列を返す。
 * 各フレーム後に中断判定を行い、中断された場合は null を返す。
 */
export async function buildRouteGif(options: BuildRouteGifOptions): Promise<Uint8Array | null> {
  const { frameCount, delayMs, capture, createEncoder, onProgress, shouldAbort } = options;
  const encoder = createEncoder();

  for (let index = 0; index < frameCount; index += 1) {
    const frame = await capture(index);
    encoder.addFrame(frame.data, frame.width, frame.height, delayMs);
    onProgress?.(index + 1, frameCount);

    if (shouldAbort?.()) {
      return null;
    }
  }

  return encoder.finish();
}
