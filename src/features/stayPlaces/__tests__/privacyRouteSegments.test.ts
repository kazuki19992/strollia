import { toPrivacyRouteSegments } from '@/features/stayPlaces/privacyRouteSegments';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import type { LocationPoint } from '@/types/gps';

/** 1mを緯度の差へ近似変換する。テストの境界座標を手計算で作るために使う。 */
const METERS_PER_LATITUDE_DEGREE = (Math.PI * 6_371_000) / 180;

function point(latitude: number, longitude: number, recordedAt: string): LocationPoint {
  return {
    id: Date.parse(recordedAt),
    recordedAt,
    localDate: '2026-08-19',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

function stayPlace(overrides: Partial<StayPlace> = {}): StayPlace {
  return {
    id: 1,
    name: '自宅',
    iconHexcode: '1F3E0',
    latitude: 35,
    longitude: 139,
    privacyRadiusMeters: 100,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

function coordinates(segments: ReturnType<typeof toPrivacyRouteSegments>) {
  return segments.map((segment) => segment.coordinates);
}

describe('共有用のプライバシールート区間 toPrivacyRouteSegments', () => {
  it('非表示範囲内の点で区間を分割し、範囲をまたぐ線を描かない', () => {
    const result = toPrivacyRouteSegments(
      [
        point(35.002, 139, '2026-08-19T00:00:00.000Z'),
        point(35.003, 139, '2026-08-19T00:01:00.000Z'),
        point(35, 139, '2026-08-19T00:02:00.000Z'),
        point(35.004, 139, '2026-08-19T00:03:00.000Z'),
        point(35.005, 139, '2026-08-19T00:04:00.000Z'),
      ],
      [stayPlace()],
    );

    expect(coordinates(result)).toEqual([
      [
        { latitude: 35.002, longitude: 139 },
        { latitude: 35.003, longitude: 139 },
      ],
      [
        { latitude: 35.004, longitude: 139 },
        { latitude: 35.005, longitude: 139 },
      ],
    ]);
  });

  it('非表示半径がnullの滞在場所は共有ルートから除外しない', () => {
    const result = toPrivacyRouteSegments(
      [point(35, 139, '2026-08-19T00:00:00.000Z'), point(35.001, 139, '2026-08-19T00:01:00.000Z')],
      [stayPlace({ privacyRadiusMeters: null })],
    );

    expect(coordinates(result)).toEqual([
      [
        { latitude: 35, longitude: 139 },
        { latitude: 35.001, longitude: 139 },
      ],
    ]);
  });

  it('非表示半径の境界上にある点も除外する', () => {
    const boundaryLatitude = 35 + 100 / METERS_PER_LATITUDE_DEGREE;
    const result = toPrivacyRouteSegments(
      [
        point(35.002, 139, '2026-08-19T00:00:00.000Z'),
        point(boundaryLatitude, 139, '2026-08-19T00:01:00.000Z'),
        point(35.003, 139, '2026-08-19T00:02:00.000Z'),
      ],
      [stayPlace({ privacyRadiusMeters: 100 })],
    );

    expect(result).toEqual([]);
  });

  it('複数の有効な滞在場所のいずれかの非表示範囲内なら除外する', () => {
    const result = toPrivacyRouteSegments(
      [
        point(35.002, 139, '2026-08-19T00:00:00.000Z'),
        point(35.006, 139, '2026-08-19T00:01:00.000Z'),
        point(35.003, 139, '2026-08-19T00:02:00.000Z'),
      ],
      [stayPlace(), stayPlace({ id: 2, name: '職場', latitude: 35.006, longitude: 139 })],
    );

    expect(result).toEqual([]);
  });

  it('すべての点が非表示範囲内なら空の区間を返す', () => {
    expect(
      toPrivacyRouteSegments([point(35, 139, '2026-08-19T00:00:00.000Z'), point(35.0001, 139, '2026-08-19T00:01:00.000Z')], [stayPlace()]),
    ).toEqual([]);
  });

  it('有効座標を判定と描画に使う', () => {
    const result = toPrivacyRouteSegments(
      [
        { ...point(35.002, 139, '2026-08-19T00:00:00.000Z'), effectiveLatitude: 35, effectiveLongitude: 139 },
        { ...point(35.003, 139, '2026-08-19T00:01:00.000Z'), effectiveLatitude: 35, effectiveLongitude: 139 },
      ],
      [stayPlace()],
    );

    expect(result).toEqual([]);
  });

  it('既存の異常な時間ギャップも別の区間として維持する', () => {
    const result = toPrivacyRouteSegments(
      [
        point(35.002, 139, '2026-08-19T00:00:00.000Z'),
        point(35.003, 139, '2026-08-19T00:01:00.000Z'),
        point(35.004, 139, '2026-08-19T00:20:00.000Z'),
        point(35.005, 139, '2026-08-19T00:21:00.000Z'),
      ],
      [],
    );

    expect(coordinates(result)).toEqual([
      [
        { latitude: 35.002, longitude: 139 },
        { latitude: 35.003, longitude: 139 },
      ],
      [
        { latitude: 35.004, longitude: 139 },
        { latitude: 35.005, longitude: 139 },
      ],
    ]);
  });
});
