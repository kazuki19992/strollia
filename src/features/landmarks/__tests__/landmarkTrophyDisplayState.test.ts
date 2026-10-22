import { resolveLandmarkTrophyDisplayState } from '@/features/landmarks/landmarkTrophyDisplayState';

describe('トロフィー表示状態 resolveLandmarkTrophyDisplayState', () => {
  it('未到達は白黒+減光になる', () => {
    expect(resolveLandmarkTrophyDisplayState(0)).toBe('dim');
  });

  it('到達率50%ちょうどは白黒+減光のまま', () => {
    expect(resolveLandmarkTrophyDisplayState(0.5)).toBe('dim');
  });

  it('過半数を超えると白黒になる', () => {
    expect(resolveLandmarkTrophyDisplayState(2 / 3)).toBe('grayscale');
  });

  it('完走でフルカラーになる', () => {
    expect(resolveLandmarkTrophyDisplayState(1)).toBe('color');
  });

  it('分母0や不正値は白黒+減光として扱う', () => {
    expect(resolveLandmarkTrophyDisplayState(Number.NaN)).toBe('dim');
  });
});
