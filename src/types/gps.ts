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

export type NewLocationPoint = Omit<LocationPoint, 'id'>;

export type DailyLogSummary = {
  localDate: string;
  pointCount: number;
  startedAt: string | null;
  endedAt: string | null;
  distanceMeters: number | null;
};
