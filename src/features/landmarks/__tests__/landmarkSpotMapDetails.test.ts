import {
  LANDMARK_SPOT_DISPLAY_TOLERANCE_RATIO,
  LANDMARK_SPOT_FOCUS_PADDING_RATIO,
  METERS_PER_DEGREE_LATITUDE,
  createLandmarkSpotFocusRegion,
  formatLandmarkUnlockCondition,
  shouldShowLandmarkSpotDetails,
} from '@/features/landmarks/landmarkSpotMapDetails';

describe('スポット解放条件の文言 formatLandmarkUnlockCondition', () => {
  test('0秒は到達で解放と表示する', () => {
    expect(formatLandmarkUnlockCondition(0)).toBe('到達で解放');
  });

  test('60分未満は分単位で表示する', () => {
    expect(formatLandmarkUnlockCondition(180)).toBe('3分以上滞在で解放');
    expect(formatLandmarkUnlockCondition(3540)).toBe('59分以上滞在で解放');
  });

  test('端数は分に切り上げる', () => {
    expect(formatLandmarkUnlockCondition(1)).toBe('1分以上滞在で解放');
    expect(formatLandmarkUnlockCondition(61)).toBe('2分以上滞在で解放');
    expect(formatLandmarkUnlockCondition(3541)).toBe('1時間00分以上滞在で解放');
  });

  test('ちょうど60分以上は時間と分(2桁)で表示する', () => {
    expect(formatLandmarkUnlockCondition(3600)).toBe('1時間00分以上滞在で解放');
    expect(formatLandmarkUnlockCondition(5400)).toBe('1時間30分以上滞在で解放');
    expect(formatLandmarkUnlockCondition(3601)).toBe('1時間01分以上滞在で解放');
    expect(formatLandmarkUnlockCondition(7200)).toBe('2時間00分以上滞在で解放');
  });

  test('不正値(NaN・負数・Infinity)は到達で解放として扱う', () => {
    expect(formatLandmarkUnlockCondition(Number.NaN)).toBe('到達で解放');
    expect(formatLandmarkUnlockCondition(-10)).toBe('到達で解放');
    expect(formatLandmarkUnlockCondition(Number.POSITIVE_INFINITY)).toBe('到達で解放');
  });
});

describe('スポットへ寄る範囲 createLandmarkSpotFocusRegion', () => {
  test('緯度差は直径に余白倍率を掛けた距離に一致する', () => {
    const region = createLandmarkSpotFocusRegion({ latitude: 0, longitude: 139 }, 200);

    expect(region.latitude).toBe(0);
    expect(region.longitude).toBe(139);
    expect(region.latitudeDelta).toBeCloseTo((400 * LANDMARK_SPOT_FOCUS_PADDING_RATIO) / METERS_PER_DEGREE_LATITUDE, 10);
    expect(region.longitudeDelta).toBeCloseTo(region.latitudeDelta, 10);
  });

  test('高緯度では経度差が緯度差より広がる', () => {
    const region = createLandmarkSpotFocusRegion({ latitude: 60, longitude: 10 }, 300);

    expect(region.longitudeDelta).toBeCloseTo(region.latitudeDelta / Math.cos((60 * Math.PI) / 180), 10);
  });

  test('極付近でも経度差が有限値になる', () => {
    const region = createLandmarkSpotFocusRegion({ latitude: 90, longitude: 0 }, 300);

    expect(Number.isFinite(region.longitudeDelta)).toBe(true);
  });
});

describe('スポット詳細の表示判定 shouldShowLandmarkSpotDetails', () => {
  const center = { latitude: 35, longitude: 139 };

  test('寄る範囲ちょうどでは表示する', () => {
    const region = createLandmarkSpotFocusRegion(center, 300);

    expect(shouldShowLandmarkSpotDetails(region, 300)).toBe(true);
  });

  test('パック全体を見渡す広い範囲では表示しない', () => {
    expect(shouldShowLandmarkSpotDetails({ ...center, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 300)).toBe(false);
  });

  test('許容倍率の境界内は表示し、超えると非表示にする', () => {
    const focus = createLandmarkSpotFocusRegion(center, 300);
    const scale = (ratio: number) => ({
      ...center,
      latitudeDelta: focus.latitudeDelta * ratio,
      longitudeDelta: focus.longitudeDelta * ratio,
    });

    expect(shouldShowLandmarkSpotDetails(scale(LANDMARK_SPOT_DISPLAY_TOLERANCE_RATIO * 0.99), 300)).toBe(true);
    expect(shouldShowLandmarkSpotDetails(scale(LANDMARK_SPOT_DISPLAY_TOLERANCE_RATIO * 1.01), 300)).toBe(false);
  });

  test('短辺で判定する(横長でも縦が狭ければ表示する)', () => {
    const focus = createLandmarkSpotFocusRegion(center, 300);

    expect(
      shouldShowLandmarkSpotDetails({ ...center, latitudeDelta: focus.latitudeDelta, longitudeDelta: focus.longitudeDelta * 10 }, 300),
    ).toBe(true);
  });

  test('半径が大きいスポットほど広い範囲まで表示する', () => {
    const region = createLandmarkSpotFocusRegion(center, 650);

    expect(shouldShowLandmarkSpotDetails(region, 650)).toBe(true);
    expect(shouldShowLandmarkSpotDetails(region, 150)).toBe(false);
  });
});
