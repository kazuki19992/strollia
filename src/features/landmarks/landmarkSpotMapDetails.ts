/** 緯度1度あたりのメートル数(概算)。経度側は cos(緯度) を掛けて求める。 */
export const METERS_PER_DEGREE_LATITUDE = 111320;

/**
 * スポットへ寄るときの余白倍率。到達エリアの直径に掛けた範囲を短辺に収める。
 * 円の端が分かるよう外側に余白を取りつつ、バッジ上下のスポット名・解放条件ラベルも枠内に収まる大きさにしている。
 */
export const LANDMARK_SPOT_FOCUS_PADDING_RATIO = 1.6;

/**
 * 詳細表示の許容倍率。寄る範囲(直径 × 余白倍率)にこの倍率を掛けた短辺まで縮小しても表示を維持する。
 * 寄った直後のわずかな縮小・ネイティブ地図の丸め誤差で表示がちらつかないようにしつつ、パック全体を見渡す範囲では出さない。
 */
export const LANDMARK_SPOT_DISPLAY_TOLERANCE_RATIO = 1.5;

/** cos(緯度) の下限。極付近で経度差が無限大になるのを防ぐ。 */
const MIN_COS_LATITUDE = 0.01;

/** 緯度経度の中心点。 */
export type LandmarkMapCenter = {
  latitude: number;
  longitude: number;
};

/** 地図の表示範囲(react-native-maps の Region と互換)。 */
export type LandmarkMapRegion = LandmarkMapCenter & {
  latitudeDelta: number;
  longitudeDelta: number;
};

/** 緯度から経度方向のメートル換算係数 cos(緯度) を求める。極付近は下限でクランプする。 */
function longitudeScale(latitude: number): number {
  return Math.max(Math.cos((latitude * Math.PI) / 180), MIN_COS_LATITUDE);
}

/**
 * スポットの解放条件を表す文言を返す。
 *
 * 分は切り上げる(必要な滞在時間を実際より短く見せないため)。切り上げて60分に達した場合も時間表記にする。
 * NaN・負数・Infinity などの不正値は滞在条件が読み取れないため、0秒と同じ「到達で解放」にフォールバックする。
 * 到達済みの表示はこの関数の対象外(UI側の定数で扱う)。
 */
export function formatLandmarkUnlockCondition(dwellSeconds: number): string {
  if (!Number.isFinite(dwellSeconds) || dwellSeconds <= 0) {
    return '到達で解放';
  }

  const totalMinutes = Math.ceil(dwellSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes}分以上滞在で解放`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');

  return `${hours}時間${minutes}分以上滞在で解放`;
}

/**
 * スポットの到達エリア(円)が余白付きで収まる表示範囲を返す。
 *
 * 地図枠は横長でネイティブ地図が region を枠の比率に広げるため、短辺側が直径 × 余白倍率に一致するよう
 * 緯度差・経度差の両方を同じメートル数から求める(経度差は cos(緯度) で補正)。
 */
export function createLandmarkSpotFocusRegion(center: LandmarkMapCenter, radiusMeters: number): LandmarkMapRegion {
  const spanMeters = radiusMeters * 2 * LANDMARK_SPOT_FOCUS_PADDING_RATIO;

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: spanMeters / METERS_PER_DEGREE_LATITUDE,
    longitudeDelta: spanMeters / (METERS_PER_DEGREE_LATITUDE * longitudeScale(center.latitude)),
  };
}

/**
 * 現在の表示範囲でスポットの詳細(名前・解放条件・円)を表示するか判定する。
 *
 * 見えている範囲の短辺(メートル)が、円の直径 × 余白倍率 × 許容倍率 以下なら表示する。
 * スポットごとに半径が違うため、一律の緯度差ではなく半径に連動させている。
 */
export function shouldShowLandmarkSpotDetails(region: LandmarkMapRegion, radiusMeters: number): boolean {
  const heightMeters = region.latitudeDelta * METERS_PER_DEGREE_LATITUDE;
  const widthMeters = region.longitudeDelta * METERS_PER_DEGREE_LATITUDE * longitudeScale(region.latitude);
  const shortSideMeters = Math.min(heightMeters, widthMeters);

  return shortSideMeters <= radiusMeters * 2 * LANDMARK_SPOT_FOCUS_PADDING_RATIO * LANDMARK_SPOT_DISPLAY_TOLERANCE_RATIO;
}
