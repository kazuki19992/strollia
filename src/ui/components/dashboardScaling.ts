import { classifyMovementSpeed, FAST_SPEED_MIN_KMH, VEHICLE_SPEED_MIN_KMH } from '@/features/location/locationSpeed';

/** マップ上の計器UIはOS文字サイズで崩れないよう固定する。 */
export const FIXED_MAP_UI_TEXT_PROPS = { allowFontScaling: false };

/** 大きい端末で既存表示を維持するためのダッシュボード基準幅。 */
export const SMALL_DASHBOARD_BASE_WIDTH = 430;

/** 小さい端末で読みやすさを保つための縮小率下限。 */
export const SMALL_DASHBOARD_MIN_SCALE = 0.86;

/**
 * ダッシュボードの基準寸法。
 *
 * `appStyles` の同名スタイル値と対応させ、大画面では既存表示を保ったまま
 * 小画面用の縮小値だけをinline styleとして重ねる。
 */
export const DASHBOARD_BASE_LAYOUT = {
  action: {
    height: 50,
    minWidth: 44,
  },
  actionsRow: {
    gap: 8,
    marginLeft: 110,
    marginRight: 3,
  },
  icon: {
    calendar: 27,
    history: 31,
    map: 31,
    settings: 30,
    trophy: 30,
  },
  mapButton: {
    borderRadius: 10,
    height: 54,
    width: 54,
  },
  meterBackground: {
    height: 104,
  },
  meterCluster: {
    height: 56,
  },
  navPanel: {
    borderRadius: 10,
    minHeight: 54,
    paddingHorizontal: 8,
  },
  placeMetric: {
    minWidth: 76,
    paddingLeft: 7,
  },
  speedDial: {
    arcSize: 104,
    contentSize: 84,
    left: 2,
    ringBorderWidth: 7,
    ringSize: 100,
  },
  summaryPanel: {
    gap: 6,
    height: 52,
    paddingLeft: 102,
    paddingRight: 7,
    paddingVertical: 6,
  },
} as const;

/** `appStyles` のフォント基準値に対応する、縮小計算用のテキスト寸法。 */
export const DASHBOARD_BASE_TEXT = {
  distanceDecimal: { fontSize: 6, lineHeight: 10 },
  distanceInteger: { fontSize: 11, lineHeight: 16 },
  distanceUnit: { fontSize: 7 },
  metricLabel: { fontSize: 11 },
  placePrimary: { fontSize: 13, lineHeight: 16 },
  placeSecondary: { fontSize: 10, lineHeight: 13 },
  speedLabel: { fontSize: 11 },
  speedUnit: { fontSize: 13, marginTop: -5 },
  speedValue: { fontSize: 30, lineHeight: 36 },
} as const;

/** スピードメーター円弧の線幅。SVG viewBox内の単位。 */
export const SPEED_METER_ARC_STROKE_WIDTH = 6;

/** スピードメーター円弧の半径。黒い背景リングの外周に合わせる。 */
export const SPEED_METER_ARC_RADIUS = 46.5;

/** スピードメーター円弧の円周。 */
export const SPEED_METER_ARC_CIRCUMFERENCE = 2 * Math.PI * SPEED_METER_ARC_RADIUS;

/**
 * 速度計・距離計・速度計円と情報帯の合成背景パス。
 *
 * 左側の速度計円と右側の情報帯を同じPathで塗ることで、背景地図が透ける
 * 状態でも接合部だけ濃く見える重なりを作らない。
 */
export const METER_CLUSTER_BACKGROUND_PATH =
  'M390 0C396.627 0 402 5.373 402 12V40C402 46.627 396.627 52 390 52H104C104 80.719 80.719 104 52 104C23.281 104 0 80.719 0 52C0 23.281 23.281 0 52 0H390Z';

/** 連続円弧の描画に使うdash値。 */
export type SpeedMeterArcStroke = {
  /** 表示対象円周長。 */
  strokeDasharray: number;
  /** 現在進捗に応じて隠す円周長。 */
  strokeDashoffset: number;
};

/**
 * 速度ゲージ進捗からSVG円弧のdash値を作る。
 *
 * @param progressPercent - 速度帯の上限に対する0〜100の進捗。
 * @returns SVG Circleに渡すdash値。
 */
export function getSpeedMeterArcStroke(progressPercent: number): SpeedMeterArcStroke {
  const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);

  return {
    strokeDasharray: SPEED_METER_ARC_CIRCUMFERENCE,
    strokeDashoffset: SPEED_METER_ARC_CIRCUMFERENCE * (1 - clampedProgress / 100),
  };
}

/** 画面幅から小画面用ダッシュボード倍率を決める。 */
export function getDashboardScale(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    return 1;
  }

  return Math.max(SMALL_DASHBOARD_MIN_SCALE, Math.min(width / SMALL_DASHBOARD_BASE_WIDTH, 1));
}

/** 小数誤差でReact Nativeのstyle値が読みにくくならないよう丸める。 */
export function scaleNumber(value: number, scale: number): number {
  return Math.round(value * scale * 100) / 100;
}

/** スピードメーターの外形と円弧SVGを同じ倍率で縮小する。テストで中心ズレの回帰を直接確認するためexportする。 */
export function getScaledSpeedDialLayout(scale: number) {
  const base = DASHBOARD_BASE_LAYOUT.speedDial;

  return {
    arcSvg: {
      height: scaleNumber(base.arcSize, scale),
      width: scaleNumber(base.arcSize, scale),
    },
    dial: {
      height: scaleNumber(base.arcSize, scale),
      left: scaleNumber(base.left, scale),
      top: 0,
      width: scaleNumber(base.arcSize, scale),
    },
    dialContent: {
      height: scaleNumber(base.contentSize, scale),
      width: scaleNumber(base.contentSize, scale),
    },
    ringBase: {
      borderWidth: scaleNumber(base.ringBorderWidth, scale),
      height: scaleNumber(base.ringSize, scale),
      width: scaleNumber(base.ringSize, scale),
    },
  };
}

/** ダッシュボードの主要レイアウトを小画面だけ縮小する。 */
export function getScaledDashboardLayout(scale: number) {
  const base = DASHBOARD_BASE_LAYOUT;

  return {
    actionsRow: {
      gap: scaleNumber(base.actionsRow.gap, scale),
      marginLeft: scaleNumber(base.actionsRow.marginLeft, scale),
      marginRight: scaleNumber(base.actionsRow.marginRight, scale),
    },
    mapButton: {
      borderRadius: scaleNumber(base.mapButton.borderRadius, scale),
      height: scaleNumber(base.mapButton.height, scale),
      width: scaleNumber(base.mapButton.width, scale),
    },
    meterBackground: {
      height: scaleNumber(base.meterBackground.height, scale),
    },
    meterCluster: {
      height: scaleNumber(base.meterCluster.height, scale),
    },
    navPanel: {
      borderRadius: scaleNumber(base.navPanel.borderRadius, scale),
      minHeight: scaleNumber(base.navPanel.minHeight, scale),
      paddingHorizontal: scaleNumber(base.navPanel.paddingHorizontal, scale),
    },
    placeMetric: {
      minWidth: scaleNumber(base.placeMetric.minWidth, scale),
      paddingLeft: scaleNumber(base.placeMetric.paddingLeft, scale),
    },
    summaryPanel: {
      gap: scaleNumber(base.summaryPanel.gap, scale),
      height: scaleNumber(base.summaryPanel.height, scale),
      paddingLeft: scaleNumber(base.summaryPanel.paddingLeft, scale),
      paddingRight: scaleNumber(base.summaryPanel.paddingRight, scale),
      paddingVertical: scaleNumber(base.summaryPanel.paddingVertical, scale),
    },
  };
}

/** フォントサイズと行高を同じ倍率で縮小する。 */
export function getScaledTextStyle(base: { fontSize: number; lineHeight?: number; marginTop?: number }, scale: number) {
  return {
    fontSize: scaleNumber(base.fontSize, scale),
    ...(base.lineHeight == null ? {} : { lineHeight: scaleNumber(base.lineHeight, scale) }),
    ...(base.marginTop == null ? {} : { marginTop: scaleNumber(base.marginTop, scale) }),
  };
}

/** 下部ナビゲーションのタップ領域を縮小レイアウトへ合わせる。 */
export function getScaledDashboardActionStyle(scale: number) {
  const base = DASHBOARD_BASE_LAYOUT.action;

  return {
    height: scaleNumber(base.height, scale),
    minWidth: scaleNumber(base.minWidth, scale),
  };
}

/** 下部ダッシュボードのアイコンサイズを縮小レイアウトへ合わせる。 */
export function getScaledDashboardIconSizes(scale: number) {
  const base = DASHBOARD_BASE_LAYOUT.icon;

  return {
    calendar: scaleNumber(base.calendar, scale),
    history: scaleNumber(base.history, scale),
    map: scaleNumber(base.map, scale),
    settings: scaleNumber(base.settings, scale),
    trophy: scaleNumber(base.trophy, scale),
  };
}

/** スピードメーターの色とゲージ幅を速度から決める。 */
export function getSpeedMeterAppearance(speedKmh: number, fallbackColor: string): { color: string; progressPercent: number } {
  const normalizedSpeed = Math.max(0, speedKmh);
  const speedBand = classifyMovementSpeed(normalizedSpeed);

  if (speedBand === 'fast') {
    return { color: '#ff75f6', progressPercent: Math.min((normalizedSpeed / 400) * 100, 100) };
  }

  if (speedBand === 'vehicle') {
    return { color: '#ffb22e', progressPercent: Math.min((normalizedSpeed / FAST_SPEED_MIN_KMH) * 100, 100) };
  }

  if (normalizedSpeed >= 1) {
    return { color: '#39d9ff', progressPercent: Math.min((normalizedSpeed / VEHICLE_SPEED_MIN_KMH) * 100, 100) };
  }

  return { color: brightenColorForDashboard(fallbackColor), progressPercent: 0 };
}

/** km/h表示用に速度を整数へ丸める。 */
export function formatSpeedKmh(speedKmh: number): string {
  return String(Math.max(0, Math.round(speedKmh)));
}

/** メートル単位の距離をkm小数2桁にする。 */
export function formatDistanceKilometers(distanceMeters: number): string {
  return (Math.max(0, distanceMeters) / 1000).toFixed(2);
}

/** 停止色が背景地図に沈まないようRGB値へ加える明度補正量。 */
const STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST = 42;

/** 停止状態でもマップ上で読めるよう、テーマカラーを少し明るくする。 */
export function brightenColorForDashboard(color: string): string {
  if (!color.startsWith('#') || color.length !== 7) {
    return color;
  }

  const red = Math.min(parseInt(color.slice(1, 3), 16) + STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST, 255);
  const green = Math.min(parseInt(color.slice(3, 5), 16) + STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST, 255);
  const blue = Math.min(parseInt(color.slice(5, 7), 16) + STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST, 255);

  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
