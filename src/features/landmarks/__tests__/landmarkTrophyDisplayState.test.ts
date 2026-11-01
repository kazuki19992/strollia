import { resolveLandmarkTrophyDisplayState } from '@/features/landmarks/landmarkTrophyDisplayState';

describe('トロフィー表示状態 resolveLandmarkTrophyDisplayState', () => {
  it('未到達はシルエットになる', () => {
    expect(resolveLandmarkTrophyDisplayState(0)).toBe('silhouette');
  });

  it('到達率50%ちょうどはシルエットのまま', () => {
    expect(resolveLandmarkTrophyDisplayState(0.5)).toBe('silhouette');
  });

  it('過半数を超えると白黒になる', () => {
    expect(resolveLandmarkTrophyDisplayState(2 / 3)).toBe('grayscale');
  });

  it('完走でフルカラーになる', () => {
    expect(resolveLandmarkTrophyDisplayState(1)).toBe('color');
  });

  it('分母0や不正値はシルエットとして扱う', () => {
    expect(resolveLandmarkTrophyDisplayState(Number.NaN)).toBe('silhouette');
  });
});
