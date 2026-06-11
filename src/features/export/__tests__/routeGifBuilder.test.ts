import { buildRouteGif } from '../routeGifBuilder';

function fakeEncoder() {
  const frames: number[] = [];
  return {
    frames,
    addFrame: (_rgba: Uint8Array, _w: number, _h: number, delayMs: number) => frames.push(delayMs),
    finish: () => new Uint8Array([1, 2, 3]),
  };
}

const capture = async () => ({ data: new Uint8Array(4), width: 1, height: 1 });

describe('buildRouteGif', () => {
  it('全フレームを capture/encode し GIF バイト列を返す', async () => {
    const encoder = fakeEncoder();
    const progress: Array<[number, number]> = [];
    const result = await buildRouteGif({
      frameCount: 3,
      delayMs: 500,
      capture,
      createEncoder: () => encoder,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(encoder.frames).toEqual([500, 500, 500]);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it('shouldAbort が true を返したら中断して null を返す', async () => {
    const encoder = fakeEncoder();
    let calls = 0;
    const result = await buildRouteGif({
      frameCount: 5,
      delayMs: 500,
      capture,
      createEncoder: () => encoder,
      shouldAbort: () => {
        calls += 1;
        return calls >= 2; // 2フレーム目の後で中断
      },
    });
    expect(result).toBeNull();
    expect(encoder.frames.length).toBe(2);
  });
});
