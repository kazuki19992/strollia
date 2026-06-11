import { computeGifFrameMinutesInRange } from '../routeGifFrames';

describe('computeGifFrameMinutesInRange', () => {
  it('開始から終了まで15分刻みにし終了を必ず含める', () => {
    expect(computeGifFrameMinutesInRange(60, 150, 15)).toEqual([60, 75, 90, 105, 120, 135, 150]);
  });

  it('刻みに満たない端数でも終了時刻を最後に含める', () => {
    expect(computeGifFrameMinutesInRange(0, 20, 15)).toEqual([0, 15, 20]);
  });

  it('終了が刻みちょうどなら重複しない', () => {
    expect(computeGifFrameMinutesInRange(0, 30, 15)).toEqual([0, 15, 30]);
  });

  it('開始と終了が同じなら1コマ', () => {
    expect(computeGifFrameMinutesInRange(60, 60, 15)).toEqual([60]);
  });

  it('終了が開始以下なら開始のみ', () => {
    expect(computeGifFrameMinutesInRange(60, 50, 15)).toEqual([60]);
  });
});
