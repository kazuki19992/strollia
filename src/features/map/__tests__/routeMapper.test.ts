import { LocationPoint } from '../../../types/gps';
import {
  createInitialRegion,
  filterRouteCoordinatesByRegion,
  simplifyRouteCoordinates,
  toRenderRouteSegments,
  toRenderRouteCoordinates,
  toRouteCoordinates,
} from '../routeMapper';

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
    expect(toRouteCoordinates([point(35.1, 139.1)])).toEqual([
      { latitude: 35.1, longitude: 139.1 },
    ]);
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
      ],
      10,
    );

    expect(segments[0].coordinates).toEqual([
      { latitude: 35, longitude: 139 },
      { latitude: 35.001, longitude: 139.001 },
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

  it('すべてのポイントを含む初期表示範囲を作る', () => {
    const region = createInitialRegion([point(35, 139), point(36, 140)]);

    expect(region.latitude).toBeCloseTo(35.5);
    expect(region.longitude).toBeCloseTo(139.5);
    expect(region.latitudeDelta).toBeGreaterThan(1);
    expect(region.longitudeDelta).toBeGreaterThan(1);
  });
});
