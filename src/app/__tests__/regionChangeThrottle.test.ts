import { shouldApplyThrottledRegionChange } from '../regionChangeThrottle';

describe('表示範囲更新のスロットル判定 shouldApplyThrottledRegionChange', () => {
  const THROTTLE_MS = 150;

  it('前回適用からの経過がthrottle未満なら適用しない（ジェスチャー中の連続更新を抑制）', () => {
    expect(shouldApplyThrottledRegionChange(1000, 1000 + 10, THROTTLE_MS)).toBe(false);
    expect(shouldApplyThrottledRegionChange(1000, 1000 + 149, THROTTLE_MS)).toBe(false);
  });

  it('throttle以上経過していれば適用する（追従を維持）', () => {
    expect(shouldApplyThrottledRegionChange(1000, 1000 + 150, THROTTLE_MS)).toBe(true);
    expect(shouldApplyThrottledRegionChange(1000, 1000 + 400, THROTTLE_MS)).toBe(true);
  });

  it('連続更新では throttle 間隔ごとにのみ適用される', () => {
    let last = 0;
    const applied: number[] = [];
    // 50msごとに更新が来る想定で、150msスロットルでは3回に1回だけ適用される
    for (let now = 0; now <= 600; now += 50) {
      if (shouldApplyThrottledRegionChange(last, now, THROTTLE_MS)) {
        applied.push(now);
        last = now;
      }
    }
    // now=0(初回,差0は<150で不適用)... 実際の適用は 150,300,450,600
    expect(applied).toEqual([150, 300, 450, 600]);
  });
});
