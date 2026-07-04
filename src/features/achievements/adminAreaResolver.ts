import * as Location from 'expo-location';

import { NewLocationPoint } from '../../types/gps';
import {
  LocationPointAdminAreaInput,
  VisitedAdminAreaInput,
  upsertLocationPointAdminArea,
  upsertVisitedAdminArea,
} from './adminAreaRepository';

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

/** 逆ジオコーディング結果からGPSポイント単位の行政区域履歴を作る。 */
export function toLocationPointAdminArea(
  point: NewLocationPoint,
  address: Location.LocationGeocodedAddress,
  locationPointId: number,
): LocationPointAdminAreaInput | null {
  const prefectureName = address.region?.trim();

  if (!prefectureName) {
    return null;
  }

  const municipalityName = (address.city ?? address.district ?? address.subregion)?.trim() || null;

  return {
    locationPointId,
    recordedAt: point.recordedAt,
    localDate: point.localDate,
    prefectureName,
    municipalityName,
    normalizedPrefectureName: normalizeAdminAreaName(prefectureName),
    normalizedMunicipalityName: municipalityName ? normalizeAdminAreaName(`${prefectureName}:${municipalityName}`) : null,
  };
}

/** 行政区域名を重複判定しやすい形へ正規化する。 */
export function normalizeAdminAreaName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/** GPSポイントから行政区域を解決し、訪問済みとして保存する。 */
export async function recordVisitedAdminAreasForPoint(point: NewLocationPoint, locationPointId?: number): Promise<void> {
  const addresses = await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude });
  const address = addresses[0];

  if (!address) {
    return;
  }

  const areas = toVisitedAdminAreas(point, address);

  for (const area of areas) {
    await upsertVisitedAdminArea(area);
  }

  if (locationPointId != null) {
    const pointArea = toLocationPointAdminArea(point, address, locationPointId);

    if (pointArea) {
      await upsertLocationPointAdminArea(pointArea);
    }
  }
}
