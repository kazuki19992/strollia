import {
  computeGifFrameMinutesInRange,
  resolveGifFrameStepMinutes,
  GIF_FRAME_STEP_MINUTES,
  GIF_FRAME_DELAY_MS,
  GIF_MIN_DURATION_MS,
  GIF_MIN_RANGE_MINUTES,
} from '../routeGifFrames';

describe('GIF出力の定数', () => {
  it('15分刻み・0.5秒/コマ・最短5秒・最短15分区間を公開する', () => {
    expect(GIF_FRAME_STEP_MINUTES).toBe(15);
    expect(GIF_FRAME_DELAY_MS).toBe(500);
    expect(GIF_MIN_DURATION_MS).toBe(5000);
    expect(GIF_MIN_RANGE_MINUTES).toBe(15);
  });
});

describe('resolveGifFrameStepMinutes', () => {
  it('長い区間は既定の15分刻みを使う', () => {
    // 135分以上なら15分刻みで10コマ以上（=5秒以上）になる
    expect(resolveGifFrameStepMinutes(135)).toBe(15);
    expect(resolveGifFrameStepMinutes(300)).toBe(15);
  });

  it('5秒に満たない短い区間は15分より細かい刻みにして最低コマ数を満たす', () => {
    // 最短15分区間: 10コマ以上にするため刻みは1分
    expect(resolveGifFrameStepMinutes(15)).toBe(1);
    // 60分: floor(60/9)=6分刻み
    expect(resolveGifFrameStepMinutes(60)).toBe(6);
  });

  it('解決した刻みで必ず最低コマ数（5秒ぶん）以上になる', () => {
    const minFrames = Math.ceil(GIF_MIN_DURATION_MS / GIF_FRAME_DELAY_MS);
    for (const range of [15, 20, 45, 90, 134, 135, 200]) {
      const step = resolveGifFrameStepMinutes(range);
      const frames = computeGifFrameMinutesInRange(0, range, step);
      expect(frames.length).toBeGreaterThanOrEqual(minFrames);
    }
  });
});

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
