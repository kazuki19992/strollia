import type { AnnualReportCoordinate, AnnualReportTimedCoordinate } from '@/features/annualReport/annualReportTypes';
import {
  FARTHEST_DAY_POINT_BUDGET,
  MONTH_ROUTE_POINT_BUDGET,
  YEAR_ROUTE_POINT_BUDGET,
  thinRouteSegments,
  thinTimedRoute,
} from '@/features/annualReport/annualReportRouteThinning';

/** ジグザグに動く座標列を作る(単純化で簡単には消えない形)。 */
function zigzag(count: number, baseLat = 35): AnnualReportCoordinate[] {
  return Array.from({ length: count }, (_, i) => ({
    latitude: baseLat + i * 0.0005,
    longitude: 139 + (i % 2 === 0 ? 0 : 0.0004) + i * 0.0001,
  }));
}

const total = (segments: AnnualReportCoordinate[][]) => segments.reduce((sum, s) => sum + s.length, 0);

describe('年次レポートのルート間引き', () => {
  test('予算定数が仕様の値になっている', () => {
    expect(YEAR_ROUTE_POINT_BUDGET).toBe(2000);
    expect(FARTHEST_DAY_POINT_BUDGET).toBe(500);
    expect(MONTH_ROUTE_POINT_BUDGET).toBe(166);
  });

  test('予算内ならそのまま返す', () => {
    const segments = [zigzag(5), zigzag(4, 36)];

    expect(thinRouteSegments(segments, 100)).toEqual(segments);
  });

  test('短い区間が多く予算が厳しくても、出力の区間はすべて描画できる2点以上になる', () => {
    const tinySegments = Array.from({ length: 50 }, (_, i) => zigzag(3, 40 + i * 0.01));
    const segments = [...tinySegments, zigzag(5000, 36)];

    const result = thinRouteSegments(segments, 60);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((segment) => segment.length >= 2)).toBe(true);
  });

  test('合計点数が予算以下になる', () => {
    const segments = [zigzag(1500), zigzag(1500, 36), zigzag(1000, 37)];

    const result = thinRouteSegments(segments, 300);

    expect(total(result)).toBeLessThanOrEqual(300);
  });

  test('各区間の先頭と末尾は残る', () => {
    const segments = [zigzag(1500), zigzag(1500, 36)];

    const result = thinRouteSegments(segments, 100);

    expect(result).toHaveLength(2);
    result.forEach((segment, index) => {
      expect(segment[0]).toEqual(segments[index][0]);
      expect(segment[segment.length - 1]).toEqual(segments[index][segments[index].length - 1]);
    });
  });

  test('1点だけの区間は捨てる', () => {
    const result = thinRouteSegments([zigzag(1), zigzag(3)], 100);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });
});

describe('時刻付きルートの間引き', () => {
  const timed = (count: number): AnnualReportTimedCoordinate[] =>
    Array.from({ length: count }, (_, i) => ({
      latitude: 35 + i * 0.0001,
      longitude: 139,
      recordedAt: new Date(Date.UTC(2026, 5, 1, 0, 0, i)).toISOString(),
    }));

  test('予算内ならそのまま返す', () => {
    const points = timed(10);

    expect(thinTimedRoute(points, 50)).toEqual(points);
  });

  test('予算以下に減らし、先頭と末尾を残し、時刻順を保つ', () => {
    const points = timed(1234);

    const result = thinTimedRoute(points, 100);

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].recordedAt > result[i - 1].recordedAt).toBe(true);
    }
  });
});
