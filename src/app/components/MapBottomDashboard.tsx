import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Alert, Animated, Pressable, Switch, Text, View } from 'react-native';
import type { MapType } from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';
import { useState, type ReactNode } from 'react';

import type { AreaLabel } from '../areaName';
import type { AppStyles } from '../appStyles';
import type { AppTheme } from '../../theme/theme';
import { classifyMovementSpeed, FAST_SPEED_MIN_KMH, VEHICLE_SPEED_MIN_KMH } from '../../features/location/locationSpeed';

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

        <View style={styles.dashboardMeterCluster}>
          <Svg
            accessibilityElementsHidden
            focusable={false}
            preserveAspectRatio="none"
            style={styles.dashboardMeterBackground}
            viewBox="0 0 402 104"
          >
            <Path d={METER_CLUSTER_BACKGROUND_PATH} fill="rgba(51, 51, 51, 0.80)" />
          </Svg>
          <View style={styles.dashboardSummaryPanel}>
            <DashboardDistanceMetric label="ODO" parts={odometerParts} styles={styles} />
            <DashboardDistanceMetric label="TODAY" parts={todayDistanceParts} styles={styles} />
            <View style={styles.dashboardPlaceMetric}>
              <Text numberOfLines={1} style={styles.dashboardPlacePrimary}>
                {currentAreaLabel.primary}
              </Text>
              {currentAreaLabel.secondary && (
                <Text numberOfLines={1} style={styles.dashboardPlaceSecondary}>
                  {currentAreaLabel.secondary}
                </Text>
              )}
            </View>
          </View>

          <SpeedDial currentSpeedKmh={currentSpeedKmh} progressPercent={speedMeter.progressPercent} speedColor={speedMeter.color} styles={styles} />
        </View>

        <View style={styles.dashboardActionsRow}>
          <View style={styles.dashboardNavPanel}>
            <DashboardAction icon={<Feather name="calendar" size={27} color="#ffffff" />} label="日ごとの記録" onPress={onOpenDailyLogs} styles={styles} />
            <DashboardAction
              icon={<MaterialCommunityIcons name="trophy-outline" size={30} color="#ffffff" />}
              label="実績"
              onPress={onOpenAchievements}
              styles={styles}
            />
            <DashboardAction icon={<MaterialIcons name="history" size={31} color="#ffffff" />} label="レポートを見る" onPress={onOpenMonthlyReport} styles={styles} />
            <DashboardAction icon={<Feather name="settings" size={30} color="#ffffff" />} label="設定" onPress={onOpenSettings} styles={styles} />
          </View>
          <Pressable
            accessibilityLabel="マップの表示"
            accessibilityRole="button"
            onPress={() => setIsMapDisplayPanelVisible((visible) => !visible)}
            style={styles.dashboardMapButton}
          >
            <Feather name="map" size={31} color="#ffffff" />
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
                <Text style={styles.mapDisplayPhotoTitle}>マップ上に写真を表示</Text>
                <Text style={styles.mapDisplayPhotoDescription}>写真ライブラリの読込権限が必要です</Text>
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
  speedColor,
  styles,
}: {
  currentSpeedKmh: number;
  progressPercent: number;
  speedColor: string;
  styles: AppStyles;
}) {
  const arcStroke = getSpeedMeterArcStroke(progressPercent);

  return (
    <View style={styles.speedDashboardDial}>
      <View style={styles.speedDashboardRingBase} />
      <Svg accessibilityElementsHidden focusable={false} pointerEvents="none" style={styles.speedDashboardArcSvg} viewBox="0 0 104 104">
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
      <View style={styles.speedDashboardDialContent}>
        <Text style={styles.speedometerLabel}>SPEED</Text>
        <Text style={[styles.speedDashboardSpeedValue, { color: speedColor }]}>{formatSpeedKmh(currentSpeedKmh)}</Text>
        <Text style={styles.speedDashboardSpeedUnit}>km/h</Text>
      </View>
    </View>
  );
}

/** 下部ダッシュボードの距離数値を描画する。 */
function DashboardDistanceMetric({ label, parts, styles }: { label: string; parts: string[]; styles: AppStyles }) {
  return (
    <View style={[styles.dashboardDistanceMetric, label === 'ODO' ? styles.dashboardOdometerMetric : styles.dashboardTodayMetric]}>
      <Text style={styles.dashboardMetricLabel}>{label}</Text>
      <View style={styles.speedometerDistanceValueRow}>
        <Text numberOfLines={1} style={styles.dashboardDistanceValueInteger}>
          {parts[0]}
        </Text>
        <Text style={styles.dashboardDistanceValueDot}>.</Text>
        <Text style={styles.dashboardDistanceValueDecimal}>{parts[1]}</Text>
        <Text style={styles.dashboardDistanceUnit}>km</Text>
      </View>
    </View>
  );
}

/** 下部ナビゲーションのアイコンボタンを描画する。 */
function DashboardAction({ icon, label, onPress, styles }: { icon: ReactNode; label: string; onPress: () => void; styles: AppStyles }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.dashboardAction}>
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
      {isSelected && <Text style={styles.mapDisplayTypeSelectedLabel}>✓　選択中</Text>}
      <Text style={styles.mapDisplayTypeLabel}>{label}</Text>
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
