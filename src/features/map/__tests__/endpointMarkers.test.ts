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

describe('getEndpointMarkers', () => {
  it('returns no markers when there are no points', () => {
    expect(getEndpointMarkers([])).toEqual([]);
  });

  it('returns only start marker for a single point', () => {
    const markers = getEndpointMarkers([point(1)]);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'start', label: '開始', color: '#1f7a5c' });
  });

  it('returns labeled start and latest markers for multiple points', () => {
    const markers = getEndpointMarkers([point(1), point(2), point(3)]);

    expect(markers.map((marker) => marker.id)).toEqual(['start', 'latest']);
    expect(markers.map((marker) => marker.label)).toEqual(['開始', '最新']);
    expect(markers[0].point.id).toBe(1);
    expect(markers[1].point.id).toBe(3);
  });
});
