import { buildRouteGif } from '@/features/export/routeGifBuilder';

function fakeEncoder() {
  const frames: number[] = [];
  return {
    frames,
    addFrame: (_rgba: Uint8Array, _w: number, _h: number, delayMs: number) => frames.push(delayMs),
    finish: () => new Uint8Array([1, 2, 3]),
  };
}

const capture = async () => ({ data: new Uint8Array(4), width: 1, height: 1 });

describe('buildRouteGif（GIF生成オーケストレーション）', () => {
  it('全フレームを capture/encode して GIF バイト列と進捗を返す', async () => {
    const encoder = fakeEncoder();
    const progress: [number, number][] = [];
    const result = await buildRouteGif({
      frameCount: 3,
      delayMs: 500,
      capture,
      createEncoder: () => encoder,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(encoder.frames).toEqual([500, 500, 500]);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('途中で shouldAbort が true になったら、それ以上 capture せず null を返す', async () => {
    const encoder = fakeEncoder();
    const result = await buildRouteGif({
      frameCount: 5,
      delayMs: 500,
      capture,
      createEncoder: () => encoder,
      // 2コマ取り込んだ時点で中断する。
      shouldAbort: () => encoder.frames.length >= 2,
    });
    expect(result).toBeNull();
    expect(encoder.frames.length).toBe(2);
  });

  it('開始時点で中断済みなら capture を一度も呼ばず null を返す', async () => {
    const encoder = fakeEncoder();
    const captureSpy = jest.fn(capture);
    const result = await buildRouteGif({
      frameCount: 5,
      delayMs: 500,
      capture: captureSpy,
      createEncoder: () => encoder,
      shouldAbort: () => true,
    });
    expect(result).toBeNull();
    expect(captureSpy).not.toHaveBeenCalled();
    expect(encoder.frames.length).toBe(0);
  });
});
