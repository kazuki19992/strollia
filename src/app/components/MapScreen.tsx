import { AntDesign, Entypo, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Pressable, SafeAreaView, Text, View } from 'react-native';
import MapView, { Marker, Polyline, Region, UserLocationChangeEvent } from 'react-native-maps';
import type { LatLng, MapType } from 'react-native-maps';
import type { RefObject } from 'react';

import { MapPhotoCluster } from '../../features/photos/photoClusters';
import { AppTheme } from '../../theme/theme';
import { LocationPoint } from '../../types/gps';
import { AppStyles } from '../appStyles';
import { PhotoClusterMarker } from './PhotoClusterMarker';

/** ルート線の描画スタイル。 */
type RouteLineStyle = {
  /** 線色。 */
  color: string;
  /** 線幅。 */
  width: number;
  /** 発光風の太線を背面に描くか。 */
  glow: boolean;
};

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
  /** 表示対象ルート座標。 */
  visibleRouteCoordinates: LatLng[];
  /** ルート線スタイル。 */
  routeLineStyle: RouteLineStyle;
  /** 写真表示設定。 */
  showPhotosOnMap: boolean;
  /** 表示する写真クラスタ。 */
  photoClusters: MapPhotoCluster[];
  /** メニューが描画対象か。 */
  isMenuVisible: boolean;
  /** メニューが開いているか。 */
  isMenuOpen: boolean;
  /** メニューアニメーション進捗。 */
  menuProgress: Animated.Value;
  /** GPS記録中か。 */
  isRecording: boolean;
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
  /** 現在地ピルに表示する地域名。 */
  currentAreaName: string;
  /** 表示距離。 */
  distance: number;
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
  /** メニュー開閉ハンドラ。 */
  onToggleMenu: () => void;
  /** メニューを閉じるハンドラ。 */
  onCloseMenu: () => void;
  /** 日別ログ画面を開くハンドラ。 */
  onOpenDailyLogs: () => void;
  /** 実績画面を開くハンドラ。 */
  onOpenAchievements: () => void;
  /** 月次レポート画面を開くハンドラ。 */
  onOpenMonthlyReport: () => void;
  /** 地図種別切り替えハンドラ。 */
  onToggleMapType: () => void;
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
  visibleRouteCoordinates,
  routeLineStyle,
  showPhotosOnMap,
  photoClusters,
  isMenuVisible,
  isMenuOpen,
  menuProgress,
  isRecording,
  points,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  photoErrorMessage,
  isLoadingPhotos,
  currentAreaName,
  distance,
  recenterButtonOpacity,
  onUserLocationChange,
  onPanDrag,
  onRegionChangeComplete,
  onPhotoClusterPress,
  onToggleMenu,
  onCloseMenu,
  onOpenDailyLogs,
  onOpenAchievements,
  onOpenMonthlyReport,
  onToggleMapType,
  onOpenSettings,
  onRequestLocationPermission,
  onRecenterOnUserLocation,
}: MapScreenProps) {
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
        legalLabelInsets={{ bottom: 8, left: 8, right: 8, top: 8 }}
        mapPadding={{ bottom: 96, left: 0, right: 0, top: 58 }}
      >
        {visibleRouteCoordinates.length > 1 && routeLineStyle.glow && (
          <Polyline coordinates={visibleRouteCoordinates} strokeColor={routeLineStyle.color} strokeWidth={routeLineStyle.width + 8} />
        )}
        {visibleRouteCoordinates.length > 1 && (
          <Polyline coordinates={visibleRouteCoordinates} strokeColor={routeLineStyle.color} strokeWidth={routeLineStyle.width} />
        )}
        {!userLocationIcon.useNativeUserLocation && userCoordinate && (
          <Marker coordinate={userCoordinate} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.customUserLocationMarker}>
              <MaterialCommunityIcons
                name={userLocationIcon.customIconId === 'compass' ? 'compass' : 'walk'}
                size={22}
                color={theme.colors.primaryText}
              />
            </View>
          </Marker>
        )}
        {showPhotosOnMap &&
          photoClusters.map((cluster) => <PhotoClusterMarker key={cluster.id} cluster={cluster} styles={styles} onPress={onPhotoClusterPress} />)}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        {isMenuVisible && (
          <Animated.View pointerEvents={isMenuOpen ? 'auto' : 'none'} style={[styles.menuScrim, { opacity: menuProgress }]}>
            <Pressable onPress={onCloseMenu} style={styles.menuScrimPressable} />
          </Animated.View>
        )}

        <View style={styles.topBar}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, isRecording && styles.statusDotActive]} />
            <Text style={styles.statusText}>{isRecording ? '記録中' : '停止中'}</Text>
          </View>
          <View style={styles.rightControls}>
            <Pressable onPress={onToggleMenu} style={styles.menuButton}>
              <Entypo name="dots-three-vertical" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>

        {isMenuVisible && (
          <Animated.View
            style={[
              styles.menuCard,
              {
                opacity: menuProgress,
                transform: [
                  { translateY: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                  { scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
              },
            ]}
          >
            <Pressable onPress={onOpenDailyLogs} style={styles.menuItem}>
              <Feather name="calendar" size={22} color={theme.colors.text} />
              <Text style={styles.menuItemText}>日ごとの記録</Text>
            </Pressable>
            <Pressable onPress={onOpenAchievements} style={styles.menuItem}>
              <MaterialCommunityIcons name="trophy-outline" size={23} color={theme.colors.text} />
              <Text style={styles.menuItemText}>実績</Text>
            </Pressable>
            <Pressable onPress={onOpenMonthlyReport} style={styles.menuItem}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={23} color={theme.colors.text} />
              <Text style={styles.menuItemText}>レポートを見る</Text>
            </Pressable>
            <Pressable onPress={onToggleMapType} style={styles.menuItem}>
              <MaterialCommunityIcons name={mapType === 'standard' ? 'satellite-variant' : 'map-outline'} size={23} color={theme.colors.text} />
              <Text style={styles.menuItemText}>{mapType === 'standard' ? '航空写真に切替' : '標準地図に切替'}</Text>
            </Pressable>
            <Pressable onPress={onOpenSettings} style={styles.menuItem}>
              <Feather name="settings" size={22} color={theme.colors.text} />
              <Text style={styles.menuItemText}>設定</Text>
            </Pressable>
          </Animated.View>
        )}

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

        <View pointerEvents="box-none" style={styles.bottomBar}>
          <View style={styles.bottomSideSpacer} />
          <View style={styles.locationPill}>
            <Text style={styles.locationName}>{currentAreaName}</Text>
            <View style={styles.locationMetaRow}>
              <Text style={styles.locationMetaLabel}>ODO</Text>
              <Text style={styles.locationMetaValue}>{(distance / 1000).toFixed(2)}</Text>
              <Text style={styles.locationMetaLabel}>km</Text>
            </View>
          </View>
          <Animated.View pointerEvents={isFollowingUserLocation ? 'none' : 'auto'} style={[styles.recenterButtonContainer, { opacity: recenterButtonOpacity }]}>
            <Pressable onPress={onRecenterOnUserLocation} style={styles.recenterButton}>
              <AntDesign name="aim" size={24} color={theme.colors.primary} />
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
