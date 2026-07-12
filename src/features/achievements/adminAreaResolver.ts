import * as Location from 'expo-location';

import { NewLocationPoint } from '@/types/gps';
import { distanceMeters } from '@/utils/distance';
import {
  LocationPointAdminAreaInput,
  VisitedAdminAreaInput,
  upsertLocationPointAdminArea,
  upsertVisitedAdminArea,
} from './adminAreaRepository';

/** 直近の逆ジオコーディング結果をこの距離内なら再利用する(メートル)。行政区域の判定精度として十分小さい値。 */
const GEOCODE_REUSE_DISTANCE_METERS = 300;

/** 逆ジオコーディングAPIを呼ぶ最短間隔(ミリ秒)。OSのジオコーダのレート制限を超えないための下限。 */
const GEOCODE_MIN_INTERVAL_MS = 10_000;

/** レート制限エラーを受けた後、逆ジオコーディングを試さない時間(ミリ秒)。 */
const GEOCODE_RATE_LIMIT_COOLDOWN_MS = 60_000;

/** 直近の逆ジオコーディング成功結果のキャッシュ。 */
let lastGeocodeResult: {
  latitude: number;
  longitude: number;
  address: Location.LocationGeocodedAddress;
  geocodedAtMs: number;
} | null = null;

/** レート制限エラー後のクールダウン終了時刻(ミリ秒エポック)。 */
let geocodeCooldownUntilMs = 0;

/** テスト用: スロットリング状態を初期化する。 */
export function resetGeocodeThrottleForTest(): void {
  lastGeocodeResult = null;
  geocodeCooldownUntilMs = 0;
}

/** OSジオコーダのレート制限エラーか判定する。 */
function isGeocodeRateLimitError(error: unknown): boolean {
  return error instanceof Error && /rate limit/i.test(error.message);
}

/**
 * レート制限を避けながらGPSポイントの住所を解決する。
 *
 * - 直近の結果から {@link GEOCODE_REUSE_DISTANCE_METERS} 以内ならAPIを呼ばず再利用する
 * - 前回呼び出しから {@link GEOCODE_MIN_INTERVAL_MS} 未満、またはクールダウン中は
 *   解決をスキップする(誤った行政区域を記録しないため、遠い地点の結果は再利用しない)
 * - レート制限エラーを受けたら {@link GEOCODE_RATE_LIMIT_COOLDOWN_MS} のクールダウンに入る
 */
async function resolveAddressThrottled(point: NewLocationPoint): Promise<Location.LocationGeocodedAddress | null> {
  const nowMs = Date.now();

  if (lastGeocodeResult && distanceMeters(lastGeocodeResult, point) < GEOCODE_REUSE_DISTANCE_METERS) {
    return lastGeocodeResult.address;
  }

  if (nowMs < geocodeCooldownUntilMs) {
    return null;
  }

  if (lastGeocodeResult && nowMs - lastGeocodeResult.geocodedAtMs < GEOCODE_MIN_INTERVAL_MS) {
    return null;
  }

  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude });
    const address = addresses[0] ?? null;

    if (address) {
      lastGeocodeResult = { latitude: point.latitude, longitude: point.longitude, address, geocodedAtMs: nowMs };
    }

    return address;
  } catch (error: unknown) {
    if (isGeocodeRateLimitError(error)) {
      // レート制限中はエラーを伝播せず、しばらく解決をスキップする
      geocodeCooldownUntilMs = nowMs + GEOCODE_RATE_LIMIT_COOLDOWN_MS;
      return null;
    }

    throw error;
  }
}

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

/**
 * GPSポイントから行政区域を解決し、訪問済みとして保存する。
 *
 * 逆ジオコーディングはスロットリング付きで呼び出し、レート制限中や
 * 呼び出し間隔が短すぎる場合はスキップする(次回以降のポイントで解決される)。
 */
export async function recordVisitedAdminAreasForPoint(point: NewLocationPoint, locationPointId?: number): Promise<void> {
  const address = await resolveAddressThrottled(point);

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
