/** SQLiteに保存済みのGPSポイントを表す。 */
export type LocationPoint = {
  id: number;
  recordedAt: string;
  localDate: string;
  latitude: number;
  longitude: number;
  /** 記録時に決定した有効緯度。旧ログではNULL。 */
  effectiveLatitude?: number | null;
  /** 記録時に決定した有効経度。旧ログではNULL。 */
  effectiveLongitude?: number | null;
  /** 吸着した滞在場所ID。吸着なし・旧ログではNULL。 */
  snappedStayPlaceId?: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
};

/** SQLite採番前の新規GPSポイントを表す。 */
export type NewLocationPoint = Omit<LocationPoint, 'id'>;

/** 日別ログ一覧で使う集計済みサマリーを表す。 */
export type DailyLogSummary = {
  localDate: string;
  pointCount: number;
  startedAt: string | null;
  endedAt: string | null;
  distanceMeters: number | null;
  startLocationPointId: number | null;
  endLocationPointId: number | null;
};
