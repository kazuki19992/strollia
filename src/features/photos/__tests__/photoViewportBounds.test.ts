import type { Region } from 'react-native-maps';

import {
  getPhotoViewportBounds,
  isPhotoViewportBoundsContained,
  isWithinPhotoViewportBounds,
  PHOTO_VIEWPORT_PADDING_RATIO,
  type PhotoViewportBounds,
} from '@/features/photos/photoViewportBounds';

/** テスト用の表示範囲を作る。 */
function region(latitude: number, longitude: number, latitudeDelta: number, longitudeDelta: number): Region {
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

/** テスト用の緯度経度境界を作る。 */
function bounds(overrides: Partial<PhotoViewportBounds> = {}): PhotoViewportBounds {
  return {
    minLatitude: 34,
    maxLatitude: 36,
    westLongitude: 138,
    eastLongitude: 140,
    crossesAntimeridian: false,
    ...overrides,
  };
}

describe('写真座標の範囲内判定 isWithinPhotoViewportBounds', () => {
  it('境界の内側にある座標はtrueを返す', () => {
    expect(isWithinPhotoViewportBounds(bounds(), 35, 139)).toBe(true);
  });

  it('境界そのものの座標は範囲内として扱う(SQLのBETWEENと同じ両端閉区間)', () => {
    expect(isWithinPhotoViewportBounds(bounds(), 34, 138)).toBe(true);
    expect(isWithinPhotoViewportBounds(bounds(), 36, 140)).toBe(true);
  });

  it('緯度が範囲外の座標はfalseを返す', () => {
    expect(isWithinPhotoViewportBounds(bounds(), 33.9, 139)).toBe(false);
    expect(isWithinPhotoViewportBounds(bounds(), 36.1, 139)).toBe(false);
  });

  it('経度が範囲外の座標はfalseを返す', () => {
    expect(isWithinPhotoViewportBounds(bounds(), 35, 137.9)).toBe(false);
    expect(isWithinPhotoViewportBounds(bounds(), 35, 140.1)).toBe(false);
  });

  it('日付変更線をまたぐ場合は西端以上または東端以下を範囲内とする', () => {
    const crossing = bounds({ westLongitude: 170, eastLongitude: -170, crossesAntimeridian: true });

    expect(isWithinPhotoViewportBounds(crossing, 35, 175)).toBe(true);
    expect(isWithinPhotoViewportBounds(crossing, 35, -175)).toBe(true);
    // またぐ範囲の「反対側」(=範囲外)は除外する
    expect(isWithinPhotoViewportBounds(crossing, 35, 0)).toBe(false);
  });
});

describe('写真ビューポート範囲 getPhotoViewportBounds', () => {
  it('余白を指定しない場合は表示範囲そのままの緯度経度境界を返す', () => {
    const bounds = getPhotoViewportBounds(region(35, 139, 0.1, 0.2));

    expect(bounds.minLatitude).toBeCloseTo(34.95, 10);
    expect(bounds.maxLatitude).toBeCloseTo(35.05, 10);
    expect(bounds.westLongitude).toBeCloseTo(138.9, 10);
    expect(bounds.eastLongitude).toBeCloseTo(139.1, 10);
    expect(bounds.crossesAntimeridian).toBe(false);
  });

  it('余白比率の分だけ表示範囲の外側へ広がる', () => {
    const bounds = getPhotoViewportBounds(region(35, 139, 0.1, 0.2), { paddingRatio: 0.5 });

    expect(bounds.minLatitude).toBeCloseTo(34.925, 10);
    expect(bounds.maxLatitude).toBeCloseTo(35.075, 10);
    expect(bounds.westLongitude).toBeCloseTo(138.85, 10);
    expect(bounds.eastLongitude).toBeCloseTo(139.15, 10);
  });

  it('負の余白比率は0として扱う', () => {
    const bounds = getPhotoViewportBounds(region(35, 139, 0.1, 0.2), { paddingRatio: -1 });

    expect(bounds.minLatitude).toBeCloseTo(34.95, 10);
    expect(bounds.maxLatitude).toBeCloseTo(35.05, 10);
  });

  it('極付近では緯度が±90度を超えないようクランプされる', () => {
    const bounds = getPhotoViewportBounds(region(89, 0, 4, 4));

    expect(bounds.maxLatitude).toBe(90);
    expect(bounds.minLatitude).toBeCloseTo(87, 10);

    const southBounds = getPhotoViewportBounds(region(-89, 0, 4, 4));

    expect(southBounds.minLatitude).toBe(-90);
    expect(southBounds.maxLatitude).toBeCloseTo(-87, 10);
  });

  it('日付変更線をまたぐ場合は経度を正規化しcrossesAntimeridianを立てる', () => {
    const bounds = getPhotoViewportBounds(region(0, 179.5, 1, 2));

    expect(bounds.crossesAntimeridian).toBe(true);
    expect(bounds.westLongitude).toBeCloseTo(178.5, 10);
    // 180度を越えた東端は -179.5 として保持し、SQL側でOR条件へ分岐できるようにする
    expect(bounds.eastLongitude).toBeCloseTo(-179.5, 10);
  });

  it('西側で日付変更線をまたぐ場合も正規化される', () => {
    const bounds = getPhotoViewportBounds(region(0, -179.5, 1, 2));

    expect(bounds.crossesAntimeridian).toBe(true);
    expect(bounds.westLongitude).toBeCloseTo(179.5, 10);
    expect(bounds.eastLongitude).toBeCloseTo(-178.5, 10);
  });

  it('経度180度ちょうどに接する範囲はまたぎ扱いにしない', () => {
    const bounds = getPhotoViewportBounds(region(0, 179, 1, 2));

    expect(bounds.crossesAntimeridian).toBe(false);
    expect(bounds.westLongitude).toBeCloseTo(178, 10);
    expect(bounds.eastLongitude).toBeCloseTo(180, 10);
  });

  it('経度が全周を覆う場合はまたぎ扱いにせず-180〜180を返す', () => {
    const bounds = getPhotoViewportBounds(region(0, 0, 10, 400));

    expect(bounds.crossesAntimeridian).toBe(false);
    expect(bounds.westLongitude).toBe(-180);
    expect(bounds.eastLongitude).toBe(180);
  });

  it('余白を足した結果が全周を覆う場合も-180〜180を返す', () => {
    const bounds = getPhotoViewportBounds(region(0, 0, 10, 300), { paddingRatio: PHOTO_VIEWPORT_PADDING_RATIO });

    expect(bounds.crossesAntimeridian).toBe(false);
    expect(bounds.westLongitude).toBe(-180);
    expect(bounds.eastLongitude).toBe(180);
  });
});

describe('写真ビューポート範囲の内包判定 isPhotoViewportBoundsContained', () => {
  /** テスト用の境界を作る。crossesAntimeridian は west > east から導く。 */
  function bounds(minLatitude: number, maxLatitude: number, westLongitude: number, eastLongitude: number): PhotoViewportBounds {
    return {
      minLatitude,
      maxLatitude,
      westLongitude,
      eastLongitude,
      crossesAntimeridian: westLongitude > eastLongitude,
    };
  }

  it('内側の範囲が外側に完全に含まれる場合はtrueを返す', () => {
    expect(isPhotoViewportBoundsContained(bounds(34, 36, 138, 140), bounds(34.5, 35.5, 138.5, 139.5))).toBe(true);
  });

  it('内側と外側が完全に一致する場合もtrueを返す', () => {
    expect(isPhotoViewportBoundsContained(bounds(34, 36, 138, 140), bounds(34, 36, 138, 140))).toBe(true);
  });

  it('経度が外側からはみ出す場合はfalseを返す', () => {
    expect(isPhotoViewportBoundsContained(bounds(34, 36, 138, 140), bounds(34.5, 35.5, 139.5, 141))).toBe(false);
  });

  it('緯度が外側からはみ出す場合はfalseを返す', () => {
    expect(isPhotoViewportBoundsContained(bounds(34, 36, 138, 140), bounds(33.5, 35.5, 138.5, 139.5))).toBe(false);
  });

  it('日付変更線をまたぐ外側範囲は、東半球側の内側範囲を含むと判定する', () => {
    expect(isPhotoViewportBoundsContained(bounds(-1, 1, 170, -170), bounds(-0.5, 0.5, 175, 179))).toBe(true);
  });

  it('日付変更線をまたぐ外側範囲は、西半球側の内側範囲を含むと判定する', () => {
    expect(isPhotoViewportBoundsContained(bounds(-1, 1, 170, -170), bounds(-0.5, 0.5, -175, -172))).toBe(true);
  });

  it('日付変更線をまたぐ内側範囲は、より広いまたぎ範囲に含まれる', () => {
    expect(isPhotoViewportBoundsContained(bounds(-1, 1, 170, -170), bounds(-0.5, 0.5, 175, -175))).toBe(true);
  });

  it('日付変更線をまたがない外側範囲は、またぐ内側範囲を含まない', () => {
    expect(isPhotoViewportBoundsContained(bounds(-1, 1, 170, 180), bounds(-0.5, 0.5, 175, -175))).toBe(false);
  });
});
