import { LocationPoint } from '../../../types/gps';
import { getEndpointMarkers } from '../endpointMarkers';

function point(id: number): LocationPoint {
  return {
    id,
    recordedAt: `2026-05-04T00:0${id}:00.000Z`,
    localDate: '2026-05-04',
    latitude: 35 + id,
    longitude: 139 + id,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('日別ルート端点マーカー getEndpointMarkers', () => {
  it('ポイントがない場合はマーカーを返さない', () => {
    expect(getEndpointMarkers([])).toEqual([]);
  });

  it('ポイントが1件の場合は開始マーカーのみ返す', () => {
    const markers = getEndpointMarkers([point(1)]);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'start', label: '開始', color: '#1f7a5c' });
  });

  it('複数ポイントの場合は開始と最新のラベル付きマーカーを返す', () => {
    const markers = getEndpointMarkers([point(1), point(2), point(3)]);

    expect(markers.map((marker) => marker.id)).toEqual(['start', 'latest']);
    expect(markers.map((marker) => marker.label)).toEqual(['開始', '最新']);
    expect(markers[0].point.id).toBe(1);
    expect(markers[1].point.id).toBe(3);
  });
});
