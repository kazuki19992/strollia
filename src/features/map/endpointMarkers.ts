import { LocationPoint } from '../../types/gps';

export type EndpointMarker = {
  id: 'start' | 'latest';
  label: string;
  color: string;
  point: LocationPoint;
};

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
