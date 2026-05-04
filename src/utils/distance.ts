import { LocationPoint } from '../types/gps';

export type CoordinateLike = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6371000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: CoordinateLike, b: CoordinateLike): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function totalDistanceMeters(points: LocationPoint[]): number {
  return points.reduce((total, point, index) => {
    if (index === 0) {
      return total;
    }

    return total + distanceMeters(points[index - 1], point);
  }, 0);
}
