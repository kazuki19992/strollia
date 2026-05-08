import * as Location from 'expo-location';

import { NewLocationPoint } from '../../types/gps';
import { VisitedAdminAreaInput, upsertVisitedAdminArea } from './adminAreaRepository';

/** 逆ジオコーディング結果から訪問行政区域を作る。 */
export function toVisitedAdminAreas(point: NewLocationPoint, address: Location.LocationGeocodedAddress): VisitedAdminAreaInput[] {
  const prefectureName = address.region?.trim();

  if (!prefectureName) {
    return [];
  }

  const municipalityName = (address.city ?? address.district ?? address.subregion)?.trim() || null;
  const visitedAt = point.recordedAt;
  const areas: VisitedAdminAreaInput[] = [
    {
      areaType: 'prefecture',
      areaCode: null,
      prefectureName,
      municipalityName: null,
      normalizedName: normalizeAdminAreaName(prefectureName),
      visitedAt,
    },
  ];

  if (municipalityName) {
    areas.push({
      areaType: 'municipality',
      areaCode: null,
      prefectureName,
      municipalityName,
      normalizedName: normalizeAdminAreaName(`${prefectureName}:${municipalityName}`),
      visitedAt,
    });
  }

  return areas;
}

/** 行政区域名を重複判定しやすい形へ正規化する。 */
export function normalizeAdminAreaName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/** GPSポイントから行政区域を解決し、訪問済みとして保存する。 */
export async function recordVisitedAdminAreasForPoint(point: NewLocationPoint): Promise<void> {
  const addresses = await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude });
  const address = addresses[0];

  if (!address) {
    return;
  }

  const areas = toVisitedAdminAreas(point, address);

  for (const area of areas) {
    await upsertVisitedAdminArea(area);
  }
}
