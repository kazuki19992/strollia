import { LocationPoint } from '@/types/gps';
import {
  createInitialRegion,
  filterRouteCoordinatesByRegion,
  filterRouteSegmentsByRegion,
  simplifyRouteCoordinates,
  toRenderRouteSegments,
  toRenderRouteCoordinates,
  toRouteCoordinates,
} from '@/features/map/routeMapper';

function point(latitude: number, longitude: number, recordedAt = '2026-05-04T00:00:00.000Z'): LocationPoint {
  return {
    id: 1,
    recordedAt,
    localDate: '2026-05-04',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('ルート描画変換', () => {
  it('保存済みポイントを地図座標へ変換する', () => {
    expect(toRouteCoordinates([point(35.1, 139.1)])).toEqual([{ latitude: 35.1, longitude: 139.1 }]);
  });

  it('保存済みポイントの不正な座標を地図座標から除外する', () => {
    const coordinates = toRouteCoordinates([point(Number.NaN, 139), point(35, Number.POSITIVE_INFINITY), point(35.1, 139.1)]);

    expect(coordinates).toHaveLength(1);
    expect(coordinates[0]).toEqual({ latitude: 35.1, longitude: 139.1 });
  });

  it('保存済みポイントがすべて不正な座標の場合は空の地図座標を返す', () => {
    expect(toRouteCoordinates([point(Number.NaN, 139), point(35, Number.POSITIVE_INFINITY)])).toEqual([]);
  });

  it('ほぼ直線のルートは端点を残して簡略化する', () => {
    const route = [
      { latitude: 35, longitude: 139 },
      { latitude: 35.00001, longitude: 139.00001 },
      { latitude: 35.00002, longitude: 139.00002 },
      { latitude: 35.001, longitude: 139.001 },
    ];

    expect(simplifyRouteCoordinates(route, 10)).toEqual([route[0], route[3]]);
  });

  it('許容誤差を超える形状点は残す', () => {
    const route = [
      { latitude: 35, longitude: 139 },
      { latitude: 35.001, longitude: 139.002 },
      { latitude: 35.002, longitude: 139 },
    ];

    expect(simplifyRouteCoordinates(route, 10)).toEqual(route);
  });

  it('保存済みポイントから描画用座標を生成する', () => {
    const coordinates = toRenderRouteCoordinates([point(35, 139), point(35.00001, 139), point(35.001, 139)], 10);

    expect(coordinates[0]).toEqual({ latitude: 35, longitude: 139 });
    expect(coordinates.at(-1)).toEqual({ latitude: 35.001, longitude: 139 });
  });

  it('異常区間を別RouteSegmentへ分割して単一点区間を描画しない', () => {
    const segments = toRenderRouteSegments([
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.0001, 139, '2026-05-23T00:00:10.000Z'),
      point(35.05, 139, '2026-05-23T00:00:20.000Z'),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].coordinates).toHaveLength(2);
  });

  it('各RouteSegmentを個別に簡略化する', () => {
    const segments = toRenderRouteSegments(
      [
        point(35, 139, '2026-05-23T00:00:00.000Z'),
        point(35.00001, 139.00001, '2026-05-23T00:00:10.000Z'),
        point(35.001, 139.001, '2026-05-23T00:00:20.000Z'),
        point(36, 140, '2026-05-23T00:15:00.000Z'),
        point(36.00001, 140.00001, '2026-05-23T00:15:10.000Z'),
        point(36.001, 140.001, '2026-05-23T00:15:20.000Z'),
      ],
      10,
    );

    expect(segments).toHaveLength(2);
    expect(segments[0].coordinates).toEqual([
      { latitude: 35, longitude: 139 },
      { latitude: 35.001, longitude: 139.001 },
    ]);
    expect(segments[1].coordinates).toEqual([
      { latitude: 36, longitude: 140 },
      { latitude: 36.001, longitude: 140.001 },
    ]);
  });

  it('余白付き表示範囲に関係するルート座標だけを残す', () => {
    const route = [
      { latitude: 34, longitude: 138 },
      { latitude: 35, longitude: 139 },
      { latitude: 35.01, longitude: 139.01 },
      { latitude: 36, longitude: 140 },
      { latitude: 37, longitude: 141 },
    ];
    const region = {
      latitude: 35,
      longitude: 139,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    expect(filterRouteCoordinatesByRegion(route, region, 0)).toEqual([route[0], route[1], route[2], route[3]]);
  });

  it('表示範囲に関係するRouteSegmentだけを残す', () => {
    const segments = [
      {
        id: 'inside',
        coordinates: [
          { latitude: 35, longitude: 139 },
          { latitude: 35.005, longitude: 139.005 },
        ],
      },
      {
        id: 'outside',
        coordinates: [
          { latitude: 36, longitude: 140 },
          { latitude: 36.005, longitude: 140.005 },
        ],
      },
      {
        id: 'boundary',
        coordinates: [
          { latitude: 35.01, longitude: 139.01 },
          { latitude: 35.02, longitude: 139.02 },
        ],
      },
    ];
    const region = {
      latitude: 35,
      longitude: 139,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    expect(filterRouteSegmentsByRegion(segments, region).map((segment) => segment.id)).toEqual(['inside', 'boundary']);
    expect(filterRouteSegmentsByRegion([], region)).toEqual([]);
  });

  it('すべてのポイントを含む初期表示範囲を作る', () => {
    const region = createInitialRegion([point(35, 139), point(36, 140)]);

    expect(region.latitude).toBeCloseTo(35.5);
    expect(region.longitude).toBeCloseTo(139.5);
    expect(region.latitudeDelta).toBeGreaterThan(1);
    expect(region.longitudeDelta).toBeGreaterThan(1);
  });

  it('不正な座標を初期表示範囲から除外する', () => {
    const region = createInitialRegion([point(Number.NaN, 139), point(35, 139), point(36, 140)]);

    expect(region.latitude).toBeCloseTo(35.5);
    expect(region.longitude).toBeCloseTo(139.5);
  });

  it('有効な座標がない場合は既定の初期表示範囲を使う', () => {
    const region = createInitialRegion([point(Number.NaN, 139), point(35, Number.POSITIVE_INFINITY)]);

    expect(region.latitude).toBe(35.681236);
    expect(region.longitude).toBe(139.767125);
    expect(region.latitudeDelta).toBe(0.08);
    expect(region.longitudeDelta).toBe(0.08);
  });
});
