import { LocationPoint } from '@/types/gps';

/** 日別ルート上に表示する開始/最新地点マーカー。 */
export type EndpointMarker = {
  id: 'start' | 'latest';
  label: string;
  color: string;
  point: LocationPoint;
};

/** 日別ルートの開始地点と最新地点をラベル付きマーカーとして返す。 */
export function getEndpointMarkers(points: LocationPoint[]): EndpointMarker[] {
  const first = points[0];

  if (!first) {
    return [];
  }

  if (points.length === 1) {
    return [
      {
        id: 'start',
        label: '開始',
        color: '#1f7a5c',
        point: first,
      },
    ];
  }

  return [
    {
      id: 'start',
      label: '開始',
      color: '#1f7a5c',
      point: first,
    },
    {
      id: 'latest',
      label: '最新',
      color: '#d94b64',
      point: points[points.length - 1],
    },
  ];
}
