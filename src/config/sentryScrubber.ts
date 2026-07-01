const MASKED_LOCATION_VALUE = '[Filtered]';

const LOCATION_FIELD_NAMES = new Set([
  'accuracy',
  'altitude',
  'altitudeAccuracy',
  'coordinate',
  'coordinates',
  'coords',
  'heading',
  'lat',
  'latitude',
  'latitudeDelta',
  'lng',
  'location',
  'locations',
  'lon',
  'longitude',
  'longitudeDelta',
  'speed',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      LOCATION_FIELD_NAMES.has(key) ? MASKED_LOCATION_VALUE : scrubValue(entryValue),
    ]),
  );
}

/**
 * Sentryへ送るイベントから、GPSログや写真ジオタグに由来しうる位置情報フィールドを伏せる。
 */
export function scrubSentryEventLocationData<T>(event: T): T {
  return scrubValue(event) as T;
}
