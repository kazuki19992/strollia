import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
// useWindowDimensionsだけはテストで幅を差し替えるため名前空間経由で参照する。
import * as ReactNative from 'react-native';
import { Alert, Animated, Pressable, Switch, Text, View } from 'react-native';
import type { MapType } from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';
import { useState, type ReactNode } from 'react';

import type { AreaLabel } from '../areaName';
import type { AppStyles } from '../appStyles';
import type { AppTheme } from '../../theme/theme';
import { classifyMovementSpeed, FAST_SPEED_MIN_KMH, VEHICLE_SPEED_MIN_KMH } from '../../features/location/locationSpeed';

/** マップ上の計器UIはOS文字サイズで崩れないよう固定する。 */
const FIXED_MAP_UI_TEXT_PROPS = { allowFontScaling: false };

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
const DASHBOARD_BASE_LAYOUT = {
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
const DASHBOARD_BASE_TEXT = {
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

/** マップ下部ダッシュボードのprops。 */
export type MapBottomDashboardProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図種別。 */
  mapType: MapType;
  /** 現在地へ追従中か。 */
  isFollowingUserLocation: boolean;
  /** 現在地ボタンの透明度。 */
  recenterButtonOpacity: Animated.Value;
  /** 累積移動距離。単位はm。 */
  distance: number;
  /** 今日の移動距離。単位はm。 */
  todayDistance: number;
  /** 現在速度。単位はkm/h。 */
  currentSpeedKmh: number;
  /** ダッシュボードに表示する現在地名。 */
  currentAreaLabel: AreaLabel;
  /** 写真を地図に表示するか。 */
  showPhotosOnMap: boolean;
  /** 写真表示設定を保存中か。 */
  isUpdatingPhotoSetting: boolean;
  /** 現在地へ戻るハンドラ。 */
  onRecenterOnUserLocation: () => void;
  /** 日別ログ画面を開くハンドラ。 */
  onOpenDailyLogs: () => void;
  /** 実績画面を開くハンドラ。 */
  onOpenAchievements: () => void;
  /** 月次レポート画面を開くハンドラ。 */
  onOpenMonthlyReport: () => void;
  /** 設定画面を開くハンドラ。 */
  onOpenSettings: () => void;
  /** 地図種別切り替えハンドラ。 */
  onToggleMapType: () => void;
  /** 写真表示設定更新ハンドラ。 */
  onUpdateShowPhotosOnMap: (enabled: boolean) => Promise<void>;
};

/** マップ下部の速度計・距離計・画面遷移操作を描画する。 */
export function MapBottomDashboard({
  styles,
  theme,
  mapType,
  isFollowingUserLocation,
  recenterButtonOpacity,
  distance,
  todayDistance,
  currentSpeedKmh,
  currentAreaLabel,
  showPhotosOnMap,
  isUpdatingPhotoSetting,
  onRecenterOnUserLocation,
  onOpenDailyLogs,
  onOpenAchievements,
  onOpenMonthlyReport,
  onOpenSettings,
  onToggleMapType,
  onUpdateShowPhotosOnMap,
}: MapBottomDashboardProps) {
  const [isMapDisplayPanelVisible, setIsMapDisplayPanelVisible] = useState(false);
  const { width } = ReactNative.useWindowDimensions();
  const dashboardScale = getDashboardScale(width);
  const dashboardLayout = getScaledDashboardLayout(dashboardScale);
  const iconSizes = getScaledDashboardIconSizes(dashboardScale);
  const speedMeter = getSpeedMeterAppearance(currentSpeedKmh, theme.colors.primary);
  const odometerParts = formatDistanceKilometers(distance).split('.');
  const todayDistanceParts = formatDistanceKilometers(todayDistance).split('.');

  return (
    <>
      {isMapDisplayPanelVisible && (
        <Pressable
          accessibilityLabel="マップ表示設定を閉じる"
          onPress={() => setIsMapDisplayPanelVisible(false)}
          style={styles.mapDisplayPanelScrim}
        />
      )}

      <View pointerEvents="box-none" style={styles.bottomDashboard}>
        <Animated.View
          pointerEvents={isFollowingUserLocation ? 'none' : 'auto'}
          style={[styles.recenterButtonContainer, { opacity: recenterButtonOpacity }]}
        >
          <Pressable accessibilityLabel="現在地へ戻る" onPress={onRecenterOnUserLocation} style={styles.recenterButton}>
            <Feather name="navigation" size={28} color="#ffffff" />
          </Pressable>
        </Animated.View>

        <View style={[styles.dashboardMeterCluster, dashboardLayout.meterCluster]}>
          <Svg
            accessibilityElementsHidden
            focusable={false}
            preserveAspectRatio="none"
            style={[styles.dashboardMeterBackground, dashboardLayout.meterBackground]}
            viewBox="0 0 402 104"
          >
            <Path d={METER_CLUSTER_BACKGROUND_PATH} fill="rgba(51, 51, 51, 0.80)" />
          </Svg>
          <View style={[styles.dashboardSummaryPanel, dashboardLayout.summaryPanel]}>
            <DashboardDistanceMetric label="ODO" parts={odometerParts} scale={dashboardScale} styles={styles} />
            <DashboardDistanceMetric label="TODAY" parts={todayDistanceParts} scale={dashboardScale} styles={styles} />
            <View style={[styles.dashboardPlaceMetric, dashboardLayout.placeMetric]}>
              <Text
                {...FIXED_MAP_UI_TEXT_PROPS}
                adjustsFontSizeToFit
                minimumFontScale={dashboardScale < 1 ? 0.72 : 0.9}
                numberOfLines={1}
                style={[styles.dashboardPlacePrimary, getScaledTextStyle(DASHBOARD_BASE_TEXT.placePrimary, dashboardScale)]}
              >
                {currentAreaLabel.primary}
              </Text>
              {currentAreaLabel.secondary && (
                <Text
                  {...FIXED_MAP_UI_TEXT_PROPS}
                  adjustsFontSizeToFit
                  minimumFontScale={dashboardScale < 1 ? 0.76 : 0.9}
                  numberOfLines={1}
                  style={[styles.dashboardPlaceSecondary, getScaledTextStyle(DASHBOARD_BASE_TEXT.placeSecondary, dashboardScale)]}
                >
                  {currentAreaLabel.secondary}
                </Text>
              )}
            </View>
          </View>

          <SpeedDial
            currentSpeedKmh={currentSpeedKmh}
            progressPercent={speedMeter.progressPercent}
            scale={dashboardScale}
            speedColor={speedMeter.color}
            styles={styles}
          />
        </View>

        <View style={[styles.dashboardActionsRow, dashboardLayout.actionsRow]}>
          <View style={[styles.dashboardNavPanel, dashboardLayout.navPanel]}>
            <DashboardAction
              icon={<Feather name="calendar" size={iconSizes.calendar} color="#ffffff" />}
              label="日ごとの記録"
              onPress={onOpenDailyLogs}
              scale={dashboardScale}
              styles={styles}
            />
            <DashboardAction
              icon={<MaterialCommunityIcons name="trophy-outline" size={iconSizes.trophy} color="#ffffff" />}
              label="実績"
              onPress={onOpenAchievements}
              scale={dashboardScale}
              styles={styles}
            />
            <DashboardAction
              icon={<MaterialIcons name="history" size={iconSizes.history} color="#ffffff" />}
              label="レポートを見る"
              onPress={onOpenMonthlyReport}
              scale={dashboardScale}
              styles={styles}
            />
            <DashboardAction
              icon={<Feather name="settings" size={iconSizes.settings} color="#ffffff" />}
              label="設定"
              onPress={onOpenSettings}
              scale={dashboardScale}
              styles={styles}
            />
          </View>
          <Pressable
            accessibilityLabel="マップの表示"
            accessibilityRole="button"
            onPress={() => setIsMapDisplayPanelVisible((visible) => !visible)}
            style={[styles.dashboardMapButton, dashboardLayout.mapButton]}
          >
            <Feather name="map" size={iconSizes.map} color="#ffffff" />
          </Pressable>
        </View>

        {isMapDisplayPanelVisible && (
          <View style={styles.mapDisplayPanel}>
            <View style={styles.mapDisplayTypeRow}>
              <MapDisplayTypeButton
                icon="map-outline"
                isSelected={mapType === 'standard'}
                label="標準マップ"
                onPress={() => {
                  if (mapType !== 'standard') {
                    onToggleMapType();
                  }
                }}
                styles={styles}
              />
              <MapDisplayTypeButton
                icon="satellite-variant"
                isSelected={mapType !== 'standard'}
                label="航空写真"
                onPress={() => {
                  if (mapType === 'standard') {
                    onToggleMapType();
                  }
                }}
                styles={styles}
              />
            </View>
            <View style={styles.mapDisplayPhotoRow}>
              <View style={styles.mapDisplayPhotoTextColumn}>
                <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayPhotoTitle}>
                  マップ上に写真を表示
                </Text>
                <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayPhotoDescription}>
                  写真ライブラリの読込権限が必要です
                </Text>
              </View>
              <Switch
                disabled={isUpdatingPhotoSetting}
                onValueChange={(enabled) => {
                  onUpdateShowPhotosOnMap(enabled).catch((error: unknown) => {
                    Alert.alert('写真設定失敗', error instanceof Error ? error.message : '写真表示設定を保存できませんでした。');
                  });
                }}
                trackColor={{ false: '#767676', true: '#30d158' }}
                thumbColor="#ffffff"
                value={showPhotosOnMap}
              />
            </View>
          </View>
        )}
      </View>
    </>
  );
}

/**
 * 円形速度計と距離情報帯を半透明の単一図形にする背景パス。
 *
 * 左側の速度計円と右側の情報帯を同じPathで塗ることで、背景地図が透ける
 * 状態でも接合部だけ濃く見える重なりを作らない。
 */
export const METER_CLUSTER_BACKGROUND_PATH =
  'M390 0C396.627 0 402 5.373 402 12V40C402 46.627 396.627 52 390 52H104C104 80.719 80.719 104 52 104C23.281 104 0 80.719 0 52C0 23.281 23.281 0 52 0H390Z';

/** 数字と速度リングを持つ円形スピードメーターを描画する。 */
function SpeedDial({
  currentSpeedKmh,
  progressPercent,
  scale,
  speedColor,
  styles,
}: {
  currentSpeedKmh: number;
  progressPercent: number;
  scale: number;
  speedColor: string;
  styles: AppStyles;
}) {
  const arcStroke = getSpeedMeterArcStroke(progressPercent);
  const layout = getScaledSpeedDialLayout(scale);

  return (
    <View style={[styles.speedDashboardDial, layout.dial]}>
      <View style={[styles.speedDashboardRingBase, layout.ringBase]} testID="speed-meter-ring-base" />
      <Svg
        accessibilityElementsHidden
        focusable={false}
        pointerEvents="none"
        style={[styles.speedDashboardArcSvg, layout.arcSvg]}
        testID="speed-meter-arc-svg"
        viewBox="0 0 104 104"
      >
        {progressPercent > 0 && (
          <Circle
            cx="52"
            cy="52"
            fill="none"
            originX="52"
            originY="52"
            r={SPEED_METER_ARC_RADIUS}
            rotation="-90"
            stroke={speedColor}
            strokeDasharray={arcStroke.strokeDasharray}
            strokeDashoffset={arcStroke.strokeDashoffset}
            strokeLinecap="round"
            strokeWidth={SPEED_METER_ARC_STROKE_WIDTH}
            testID="speed-meter-progress-arc"
          />
        )}
      </Svg>
      <View style={[styles.speedDashboardDialContent, layout.dialContent]}>
        <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.speedometerLabel, getScaledTextStyle(DASHBOARD_BASE_TEXT.speedLabel, scale)]}>
          SPEED
        </Text>
        <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.speedDashboardSpeedValue, getScaledTextStyle(DASHBOARD_BASE_TEXT.speedValue, scale), { color: speedColor }]}>
          {formatSpeedKmh(currentSpeedKmh)}
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[styles.speedDashboardSpeedUnit, getScaledTextStyle(DASHBOARD_BASE_TEXT.speedUnit, scale)]}
        >
          km/h
        </Text>
      </View>
    </View>
  );
}

/** 下部ダッシュボードの距離数値を描画する。 */
function DashboardDistanceMetric({ label, parts, scale, styles }: { label: string; parts: string[]; scale: number; styles: AppStyles }) {
  return (
    <View style={[styles.dashboardDistanceMetric, label === 'ODO' ? styles.dashboardOdometerMetric : styles.dashboardTodayMetric]}>
      <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.dashboardMetricLabel, getScaledTextStyle(DASHBOARD_BASE_TEXT.metricLabel, scale)]}>
        {label}
      </Text>
      <View style={styles.speedometerDistanceValueRow}>
        <Text {...FIXED_MAP_UI_TEXT_PROPS} numberOfLines={1} style={[styles.dashboardDistanceValueInteger, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceInteger, scale)]}>
          {parts[0]}
        </Text>
        <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.dashboardDistanceValueDot, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceInteger, scale)]}>
          .
        </Text>
        <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.dashboardDistanceValueDecimal, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceDecimal, scale)]}>
          {parts[1]}
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[styles.dashboardDistanceUnit, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceUnit, scale), { marginBottom: scaleNumber(3, scale), marginLeft: scaleNumber(1, scale) }]}
        >
          km
        </Text>
      </View>
    </View>
  );
}

/** 下部ナビゲーションのアイコンボタンを描画する。 */
function DashboardAction({ icon, label, onPress, scale, styles }: { icon: ReactNode; label: string; onPress: () => void; scale: number; styles: AppStyles }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={[styles.dashboardAction, getScaledDashboardActionStyle(scale)]}>
      {icon}
    </Pressable>
  );
}

/** 地図表示ポップオーバーの地図種別ボタンを描画する。 */
function MapDisplayTypeButton({
  icon,
  isSelected,
  label,
  onPress,
  styles,
}: {
  icon: 'map-outline' | 'satellite-variant';
  isSelected: boolean;
  label: string;
  onPress: () => void;
  styles: AppStyles;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.mapDisplayTypeButton, isSelected && styles.mapDisplayTypeButtonSelected]}>
      <MaterialCommunityIcons name={icon} size={36} color="#ffffff" />
      {isSelected && (
        <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayTypeSelectedLabel}>
          ✓　選択中
        </Text>
      )}
      <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayTypeLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/** スピードメーター円弧の線幅。SVG viewBox内の単位。 */
export const SPEED_METER_ARC_STROKE_WIDTH = 6;

/** スピードメーター円弧の半径。黒い背景リングの外周に合わせる。 */
export const SPEED_METER_ARC_RADIUS = 46.5;

/** スピードメーター円弧の円周。 */
export const SPEED_METER_ARC_CIRCUMFERENCE = 2 * Math.PI * SPEED_METER_ARC_RADIUS;

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
function scaleNumber(value: number, scale: number): number {
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
function getScaledDashboardLayout(scale: number) {
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
function getScaledTextStyle(base: { fontSize: number; lineHeight?: number; marginTop?: number }, scale: number) {
  return {
    fontSize: scaleNumber(base.fontSize, scale),
    ...(base.lineHeight == null ? {} : { lineHeight: scaleNumber(base.lineHeight, scale) }),
    ...(base.marginTop == null ? {} : { marginTop: scaleNumber(base.marginTop, scale) }),
  };
}

/** 下部ナビゲーションのタップ領域を縮小レイアウトへ合わせる。 */
function getScaledDashboardActionStyle(scale: number) {
  const base = DASHBOARD_BASE_LAYOUT.action;

  return {
    height: scaleNumber(base.height, scale),
    minWidth: scaleNumber(base.minWidth, scale),
  };
}

/** 下部ダッシュボードのアイコンサイズを縮小レイアウトへ合わせる。 */
function getScaledDashboardIconSizes(scale: number) {
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

  return { color: brightenColor(fallbackColor), progressPercent: 0 };
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
function brightenColor(color: string): string {
  if (!color.startsWith('#') || color.length !== 7) {
    return color;
  }

  const red = Math.min(parseInt(color.slice(1, 3), 16) + STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST, 255);
  const green = Math.min(parseInt(color.slice(3, 5), 16) + STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST, 255);
  const blue = Math.min(parseInt(color.slice(5, 7), 16) + STOPPED_SPEED_COLOR_BRIGHTNESS_BOOST, 255);

  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
