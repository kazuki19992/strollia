import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
// useWindowDimensionsだけはテストで幅を差し替えるため名前空間経由で参照する。
import * as ReactNative from 'react-native';
import { Alert, Animated, Pressable, Switch, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useState } from 'react';

import type { AreaLabel } from '@/ui/areaName';
import type { AppStyles } from '@/ui/appStyles';
import type { AppTheme } from '@/theme/theme';
import { SHOW_STAY_PLACES_ON_MAP_DESCRIPTION, SHOW_STAY_PLACES_ON_MAP_LABEL } from '@/ui/appText';
import {
  DASHBOARD_BASE_TEXT,
  FIXED_MAP_UI_TEXT_PROPS,
  formatDistanceKilometers,
  getDashboardScale,
  getScaledDashboardIconSizes,
  getScaledDashboardLayout,
  getScaledTextStyle,
  getSpeedMeterAppearance,
  METER_CLUSTER_BACKGROUND_PATH,
} from './dashboardScaling';
import { DashboardAction } from './DashboardAction';
import { DashboardDistanceMetric } from './DashboardDistanceMetric';
import { MapDisplayTypeButton } from './MapDisplayTypeButton';
import { SpeedDial } from './SpeedDial';
import type { MapType } from 'react-native-maps';

// Public API re-exports — テストがこのモジュールからインポートする。
export {
  formatDistanceKilometers,
  getDashboardScale,
  getSpeedMeterAppearance,
  METER_CLUSTER_BACKGROUND_PATH,
  SMALL_DASHBOARD_BASE_WIDTH,
  SMALL_DASHBOARD_MIN_SCALE,
  SPEED_METER_ARC_CIRCUMFERENCE,
  SPEED_METER_ARC_RADIUS,
  SPEED_METER_ARC_STROKE_WIDTH,
  getScaledSpeedDialLayout,
  getSpeedMeterArcStroke,
  formatSpeedKmh,
} from './dashboardScaling';
export type { SpeedMeterArcStroke } from './dashboardScaling';

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
  /** 滞在場所が1件以上登録されているか。 */
  hasStayPlaces: boolean;
  /** 滞在場所アイコンを地図に表示するか。 */
  showStayPlacesOnMap: boolean;
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
  /** 滞在場所表示設定更新ハンドラ。 */
  onUpdateShowStayPlacesOnMap: (enabled: boolean) => Promise<void>;
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
  hasStayPlaces,
  showStayPlacesOnMap,
  onRecenterOnUserLocation,
  onOpenDailyLogs,
  onOpenAchievements,
  onOpenMonthlyReport,
  onOpenSettings,
  onToggleMapType,
  onUpdateShowPhotosOnMap,
  onUpdateShowStayPlacesOnMap,
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
          pointerEvents={isMapDisplayPanelVisible || isFollowingUserLocation ? 'none' : 'auto'}
          style={[
            styles.recenterButtonContainer,
            { opacity: recenterButtonOpacity },
            isMapDisplayPanelVisible && styles.mapDisplayBackgroundControlsDimmed,
          ]}
        >
          <Pressable
            accessibilityLabel="現在地へ戻る"
            disabled={isMapDisplayPanelVisible}
            onPress={onRecenterOnUserLocation}
            style={styles.recenterButton}
          >
            <Feather name="navigation" size={28} color="#ffffff" />
          </Pressable>
        </Animated.View>

        <View
          pointerEvents={isMapDisplayPanelVisible ? 'none' : 'auto'}
          style={[
            styles.dashboardMeterCluster,
            dashboardLayout.meterCluster,
            isMapDisplayPanelVisible && styles.mapDisplayBackgroundControlsDimmed,
          ]}
        >
          {/* 横幅は画面に追従し、高さだけ小画面倍率に合わせて速度メーター中心と揃える。 */}
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
          <View
            pointerEvents={isMapDisplayPanelVisible ? 'none' : 'auto'}
            style={[
              styles.dashboardNavPanel,
              dashboardLayout.navPanel,
              isMapDisplayPanelVisible && styles.mapDisplayBackgroundControlsDimmed,
            ]}
          >
            <DashboardAction
              icon={<Feather name="calendar" size={iconSizes.calendar} color="#ffffff" />}
              label="日ごとの記録"
              disabled={isMapDisplayPanelVisible}
              onPress={onOpenDailyLogs}
              scale={dashboardScale}
              styles={styles}
            />
            <DashboardAction
              icon={<MaterialCommunityIcons name="trophy-outline" size={iconSizes.trophy} color="#ffffff" />}
              label="実績"
              disabled={isMapDisplayPanelVisible}
              onPress={onOpenAchievements}
              scale={dashboardScale}
              styles={styles}
            />
            <DashboardAction
              icon={<MaterialIcons name="history" size={iconSizes.history} color="#ffffff" />}
              label="レポートを見る"
              disabled={isMapDisplayPanelVisible}
              onPress={onOpenMonthlyReport}
              scale={dashboardScale}
              styles={styles}
            />
            <DashboardAction
              icon={<Feather name="settings" size={iconSizes.settings} color="#ffffff" />}
              label="設定"
              disabled={isMapDisplayPanelVisible}
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
                <Text
                  {...FIXED_MAP_UI_TEXT_PROPS}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={1}
                  style={styles.mapDisplayPhotoTitle}
                >
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
            {hasStayPlaces ? (
              <View style={styles.mapDisplayPhotoRow}>
                <View style={styles.mapDisplayPhotoTextColumn}>
                  <Text
                    {...FIXED_MAP_UI_TEXT_PROPS}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    numberOfLines={1}
                    style={styles.mapDisplayPhotoTitle}
                  >
                    {SHOW_STAY_PLACES_ON_MAP_LABEL}
                  </Text>
                  <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.mapDisplayPhotoDescription}>
                    {SHOW_STAY_PLACES_ON_MAP_DESCRIPTION}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={SHOW_STAY_PLACES_ON_MAP_LABEL}
                  onValueChange={(enabled) => {
                    onUpdateShowStayPlacesOnMap(enabled).catch((error: unknown) => {
                      Alert.alert(
                        '滞在場所表示設定失敗',
                        error instanceof Error ? error.message : '滞在場所表示設定を保存できませんでした。',
                      );
                    });
                  }}
                  trackColor={{ false: '#767676', true: '#30d158' }}
                  thumbColor="#ffffff"
                  value={showStayPlacesOnMap}
                />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </>
  );
}
