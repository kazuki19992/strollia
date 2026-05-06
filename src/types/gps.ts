/** SQLiteに保存済みのGPSポイントを表す。 */
export type LocationPoint = {
  id: number;
  recordedAt: string;
  localDate: string;
  latitude: number;
  longitude: number;
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
};
