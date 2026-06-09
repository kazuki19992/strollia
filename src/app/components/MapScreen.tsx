import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Image, Pressable, SafeAreaView, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Region, UserLocationChangeEvent } from 'react-native-maps';
import type { LatLng, MapType } from 'react-native-maps';
import type { RefObject } from 'react';

import { MapPhotoCluster } from '../../features/photos/photoClusters';
import { AreaLabel } from '../areaName';
import { AppTheme } from '../../theme/theme';
import { VisitedGridOverlayCell } from '../../features/map/gridOverlay';
import { LocationPoint } from '../../types/gps';
import { AppStyles } from '../appStyles';
import { MapBottomDashboard } from './MapBottomDashboard';
import { PhotoClusterMarker } from './PhotoClusterMarker';

/** MapViewへ渡す余白情報。値はネイティブ地図APIへそのまま渡す非負のedge insetとして扱う。 */
type MapEdgePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** MapKitへ渡すpadding。頻繁な再描画で参照が変わらないようmodule scopeで固定する。 */
const MAP_PADDING: MapEdgePadding = { bottom: 128, left: 0, right: 0, top: 8 };

/** 現在地アイコンの描画設定。 */
type UserLocationIcon = {
  /** OS標準の現在地表示を使うか。 */
  useNativeUserLocation: boolean;
  /** カスタム現在地アイコンID。 */
  customIconId: string | null;
};

/** メイン地図画面のprops。 */
export type MapScreenProps = {
  /** MapViewの参照。 */
  mapRef: RefObject<MapView | null>;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 初期表示範囲。 */
  initialRegion: Region;
  /** 地図種別。 */
  mapType: MapType;
  /** OS/カスタム現在地アイコン設定。 */
  userLocationIcon: UserLocationIcon;
  /** 現在地へ追従中か。 */
  isFollowingUserLocation: boolean;
  /** 現在地座標。 */
  userCoordinate: LatLng | null;
  /** 表示するvisited grid cell。 */
  visitedGridCells: VisitedGridOverlayCell[];
  /** Grid Overlay全体のopacity。 */
  gridOverlayOpacity: number;
  /** 写真表示設定。 */
  showPhotosOnMap: boolean;
  /** 写真表示設定を保存中か。 */
  isUpdatingPhotoSetting: boolean;
  /** 表示する写真クラスタ。 */
  photoClusters: MapPhotoCluster[];
  /** 保存済みGPSポイント。 */
  points: LocationPoint[];
  /** 位置情報権限が揃っているか。 */
  hasRequiredPermission: boolean;
  /** 権限ボタンを設定誘導にするか。 */
  shouldOpenSettingsForPermission: boolean;
  /** 写真エラーメッセージ。 */
  photoErrorMessage: string | null;
  /** 写真読み込み中か。 */
  isLoadingPhotos: boolean;
  /** 表示距離。 */
  distance: number;
  /** 今日の移動距離。 */
  todayDistance: number;
  /** 現在速度。単位はkm/h。 */
  currentSpeedKmh: number;
  /** 下部ダッシュボードに表示する現在地の地域名。 */
  currentAreaLabel: AreaLabel;
  /** 現在地ボタンの透明度。 */
  recenterButtonOpacity: Animated.Value;
  /** 現在地更新ハンドラ。 */
  onUserLocationChange: (event: UserLocationChangeEvent) => void;
  /** 地図ドラッグハンドラ。 */
  onPanDrag: () => void;
  /** 表示範囲更新ハンドラ。 */
  onRegionChangeComplete: (region: Region) => void;
  /** 写真クラスタ押下ハンドラ。 */
  onPhotoClusterPress: (cluster: MapPhotoCluster) => void;
  /** 日別ログ画面を開くハンドラ。 */
  onOpenDailyLogs: () => void;
  /** 実績画面を開くハンドラ。 */
  onOpenAchievements: () => void;
  /** 月次レポート画面を開くハンドラ。 */
  onOpenMonthlyReport: () => void;
  /** 地図種別切り替えハンドラ。 */
  onToggleMapType: () => void;
  /** 写真表示設定更新ハンドラ。 */
  onUpdateShowPhotosOnMap: (enabled: boolean) => Promise<void>;
  /** 設定画面を開くハンドラ。 */
  onOpenSettings: () => void;
  /** 位置情報権限要求ハンドラ。 */
  onRequestLocationPermission: () => void;
  /** 現在地へ戻るハンドラ。 */
  onRecenterOnUserLocation: () => void;
};

/** 全履歴ルートを表示するメイン地図画面を描画する。 */
export function MapScreen({
  mapRef,
  styles,
  theme,
  initialRegion,
  mapType,
  userLocationIcon,
  isFollowingUserLocation,
  userCoordinate,
  visitedGridCells,
  gridOverlayOpacity,
  showPhotosOnMap,
  isUpdatingPhotoSetting,
  photoClusters,
  points,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  photoErrorMessage,
  isLoadingPhotos,
  distance,
  todayDistance,
  currentSpeedKmh,
  currentAreaLabel,
  recenterButtonOpacity,
  onUserLocationChange,
  onPanDrag,
  onRegionChangeComplete,
  onPhotoClusterPress,
  onOpenDailyLogs,
  onOpenAchievements,
  onOpenMonthlyReport,
  onToggleMapType,
  onUpdateShowPhotosOnMap,
  onOpenSettings,
  onRequestLocationPermission,
  onRecenterOnUserLocation,
}: MapScreenProps) {
  const shouldRenderVisitedGrid = gridOverlayOpacity > 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        mapType={mapType}
        showsCompass
        showsUserLocation={userLocationIcon.useNativeUserLocation}
        followsUserLocation={isFollowingUserLocation && userLocationIcon.useNativeUserLocation}
        onUserLocationChange={onUserLocationChange}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={onRegionChangeComplete}
        mapPadding={MAP_PADDING}
      >
        {shouldRenderVisitedGrid &&
          visitedGridCells.map((cell) => (
            <Polygon
              key={cell.id}
              coordinates={cell.coordinates}
              fillColor={cell.fillColor}
              strokeColor={cell.strokeColor}
              strokeWidth={cell.strokeWidth}
              testID="visited-grid-cell"
              tappable={false}
              zIndex={1}
            />
          ))}
        {!userLocationIcon.useNativeUserLocation && userCoordinate && (
          <Marker coordinate={userCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
            {userLocationIcon.customImageUri ? (
              <Image
                source={{ uri: userLocationIcon.customImageUri }}
                style={styles.customUserLocationMarkerImage}
                onError={() => {
                  // URI読み込み失敗時はApp.tsx側でフォールバック処理を行う
                }}
              />
            ) : (
              <View style={styles.customUserLocationMarker}>
                <MaterialCommunityIcons
                  name={userLocationIcon.customIconId === 'compass' ? 'compass' : 'walk'}
                  size={22}
                  color={theme.colors.primaryText}
                />
              </View>
            )}
          </Marker>
        )}
        {showPhotosOnMap &&
          photoClusters.map((cluster) => <PhotoClusterMarker key={cluster.id} cluster={cluster} styles={styles} onPress={onPhotoClusterPress} />)}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        {points.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>まだ足あとがありません</Text>
            <Text style={styles.emptyText}>起動後に自動で記録を開始します。権限を許可して歩いてみましょう。</Text>
          </View>
        )}

        {!hasRequiredPermission && (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>位置情報の常時許可が必要です</Text>
            <Text style={styles.permissionText}>バックグラウンドでGPSログを残すには、位置情報を常に許可してください。</Text>
            <Pressable onPress={onRequestLocationPermission} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>{shouldOpenSettingsForPermission ? '設定を開く' : '権限を付与する'}</Text>
            </Pressable>
          </View>
        )}

        {showPhotosOnMap && photoErrorMessage && (
          <View style={styles.photoStatusCard}>
            <Text style={styles.permissionText}>{photoErrorMessage}</Text>
          </View>
        )}

        {showPhotosOnMap && isLoadingPhotos && (
          <View style={styles.photoStatusCard}>
            <Text style={styles.permissionText}>ジオタグ付き写真を読み込んでいます...</Text>
          </View>
        )}

        <MapBottomDashboard
          styles={styles}
          theme={theme}
          mapType={mapType}
          isFollowingUserLocation={isFollowingUserLocation}
          recenterButtonOpacity={recenterButtonOpacity}
          distance={distance}
          todayDistance={todayDistance}
          currentSpeedKmh={currentSpeedKmh}
          currentAreaLabel={currentAreaLabel}
          showPhotosOnMap={showPhotosOnMap}
          isUpdatingPhotoSetting={isUpdatingPhotoSetting}
          onRecenterOnUserLocation={onRecenterOnUserLocation}
          onOpenDailyLogs={onOpenDailyLogs}
          onOpenAchievements={onOpenAchievements}
          onOpenMonthlyReport={onOpenMonthlyReport}
          onOpenSettings={onOpenSettings}
          onToggleMapType={onToggleMapType}
          onUpdateShowPhotosOnMap={onUpdateShowPhotosOnMap}
        />
      </SafeAreaView>
    </View>
  );
}
