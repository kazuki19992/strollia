import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Image, Platform, Pressable, SafeAreaView, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Region, UserLocationChangeEvent } from 'react-native-maps';
import type { LatLng, MapType } from 'react-native-maps';
import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';

import { MapPhotoCluster } from '@/features/photos/photoClusters';
import { getStayPlaceEmoji } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import { formatStayPlacePrivacyRadius } from '@/features/stayPlaces/stayPlacePrivacy';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { AreaLabel } from '@/ui/areaName';
import { AppTheme } from '@/theme/theme';
import { VisitedGridOverlayCell } from '@/features/map/gridOverlay';
import { AppStyles } from '@/ui/appStyles';
import { MapBottomDashboard } from './MapBottomDashboard';
import { PhotoClusterMarker } from './PhotoClusterMarker';
import { Dialog } from './Dialog';
import { StayPlaceMapMarker } from './StayPlaceMapMarker';

/** マップ上の補助UIはOS文字サイズで地図表示を覆わないよう固定する。 */
const FIXED_MAP_UI_TEXT_PROPS = { allowFontScaling: false };

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
  /** カスタム画像URI。 */
  customImageUri: string | null;
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
  /** 現在の契約状態で有効な滞在場所。読込中・失敗時はnull。 */
  activeStayPlaces: StayPlace[] | null;
  /** 滞在場所が1件以上登録されているか。 */
  hasStayPlaces: boolean;
  /** 滞在場所アイコンを地図に表示するか。 */
  showStayPlacesOnMap: boolean;
  /** GPS記録が1件以上あるか(空状態表示の判定用)。 */
  hasAnyLocationPoints: boolean;
  /** 位置情報権限が揃っているか。 */
  hasRequiredPermission: boolean;
  /** 権限ボタンを設定誘導にするか。 */
  shouldOpenSettingsForPermission: boolean;
  /** 「アプリ起動中のみ記録」モードか（バックグラウンド権限なし）。 */
  isWhileInUseOnlyMode: boolean;
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
  /** ネイティブ地図の初期化完了ハンドラ。 */
  onMapReady: () => void;
  /** 現在地更新ハンドラ。 */
  onUserLocationChange: (event: UserLocationChangeEvent) => void;
  /** 地図ドラッグハンドラ。 */
  onPanDrag: () => void;
  /** 表示範囲更新ハンドラ（操作完了時）。 */
  onRegionChangeComplete: (region: Region) => void;
  /** 表示範囲更新ハンドラ（操作中・Androidのみ使用）。 */
  onRegionChange: (region: Region) => void;
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
  /** 滞在場所表示設定更新ハンドラ。 */
  onUpdateShowStayPlacesOnMap: (enabled: boolean) => Promise<void>;
  /** 設定画面を開くハンドラ。 */
  onOpenSettings: () => void;
  /** 位置情報権限要求ハンドラ。 */
  onRequestLocationPermission: () => void;
  /** 現在地へ戻るハンドラ。 */
  onRecenterOnUserLocation: () => void;
  /** カスタムアイコン画像の読み込みに失敗したときの処理。 */
  onCustomIconError?: () => void;
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
  activeStayPlaces,
  hasStayPlaces,
  showStayPlacesOnMap,
  hasAnyLocationPoints,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  isWhileInUseOnlyMode,
  photoErrorMessage,
  isLoadingPhotos,
  distance,
  todayDistance,
  currentSpeedKmh,
  currentAreaLabel,
  recenterButtonOpacity,
  onMapReady,
  onUserLocationChange,
  onPanDrag,
  onRegionChangeComplete,
  onRegionChange,
  onPhotoClusterPress,
  onOpenDailyLogs,
  onOpenAchievements,
  onOpenMonthlyReport,
  onToggleMapType,
  onUpdateShowPhotosOnMap,
  onUpdateShowStayPlacesOnMap,
  onOpenSettings,
  onRequestLocationPermission,
  onRecenterOnUserLocation,
  onCustomIconError,
}: MapScreenProps) {
  const shouldRenderVisitedGrid = gridOverlayOpacity > 0;
  // カスタム画像マーカーは画像ロード完了までネイティブスナップショットを更新し続ける。
  // ロード後はパフォーマンスのため更新を止める。
  const [isCustomMarkerRendered, setIsCustomMarkerRendered] = useState(false);
  /** タップして詳細ダイアログを開いている滞在場所。 */
  const [selectedStayPlace, setSelectedStayPlace] = useState<StayPlace | null>(null);
  const selectedStayPlaceEmoji = selectedStayPlace ? getStayPlaceEmoji(selectedStayPlace.iconHexcode) : null;

  /**
   * Visited GridのPolygon要素。
   *
   * 追従モード中は現在地更新のたびにこのコンポーネントが再レンダーされる。要素配列をメモ化して
   * 同じ参照を返すことで、visited cellに変化がない限りReactがPolygonサブツリーの再レンダーを
   * スキップする。Polygonへ渡す値はvisitedGridCells以外に依存しない(tappable/zIndex/testIDは定数)。
   */
  const visitedGridPolygons = useMemo(() => {
    if (!shouldRenderVisitedGrid) {
      return null;
    }

    return visitedGridCells.map((cell) => (
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
    ));
  }, [shouldRenderVisitedGrid, visitedGridCells]);

  useEffect(() => {
    setIsCustomMarkerRendered(false);
  }, [userLocationIcon.customImageUri]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        mapType={mapType}
        showsCompass
        // Android標準の現在地ボタンは非表示にし、アプリ独自の現在地ボタンを使う（iOSでは無視される）。
        showsMyLocationButton={false}
        showsUserLocation={userLocationIcon.useNativeUserLocation}
        followsUserLocation={isFollowingUserLocation && userLocationIcon.useNativeUserLocation}
        onMapReady={onMapReady}
        onUserLocationChange={onUserLocationChange}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={onRegionChangeComplete}
        // Androidは操作完了時(onRegionChangeComplete)しか発火が遅く、エリア表示の追従が遅れるため、
        // 操作中のonRegionChange(スロットルは呼び出し側で実施)でも更新する。iOSは既存挙動を維持。
        onRegionChange={Platform.OS === 'android' ? onRegionChange : undefined}
        mapPadding={MAP_PADDING}
      >
        {visitedGridPolygons}
        {showStayPlacesOnMap &&
          activeStayPlaces?.map((place) => (
            <StayPlaceMapMarker key={place.id} place={place} styles={styles} onPress={setSelectedStayPlace} />
          ))}
        {!userLocationIcon.useNativeUserLocation && userCoordinate && (
          <Marker
            coordinate={userCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={userLocationIcon.customImageUri ? !isCustomMarkerRendered : undefined}
            zIndex={4}
          >
            {userLocationIcon.customImageUri ? (
              <Image
                source={{ uri: userLocationIcon.customImageUri }}
                style={styles.customUserLocationMarkerImage}
                onLoad={() => {
                  setIsCustomMarkerRendered(true);
                }}
                onError={() => {
                  onCustomIconError?.();
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
          photoClusters.map((cluster) => (
            <PhotoClusterMarker key={cluster.id} cluster={cluster} styles={styles} onPress={onPhotoClusterPress} />
          ))}
      </MapView>

      <Dialog visible={selectedStayPlace !== null} swipeToClose styles={styles} onClose={() => setSelectedStayPlace(null)}>
        {selectedStayPlace ? (
          <View style={styles.stayPlaceMapDialogContent}>
            {selectedStayPlaceEmoji ? (
              <Image
                accessibilityLabel={`${selectedStayPlaceEmoji.label}のTwemojiアイコン`}
                source={selectedStayPlaceEmoji.asset}
                style={styles.stayPlaceMapDialogImage}
              />
            ) : null}
            <Text style={styles.stayPlaceMapDialogTitle}>{selectedStayPlace.name}</Text>
            <Text style={styles.stayPlaceMapDialogPrivacy}>
              非表示範囲: {formatStayPlacePrivacyRadius(selectedStayPlace.privacyRadiusMeters)}
            </Text>
          </View>
        ) : null}
      </Dialog>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        {!hasAnyLocationPoints && (
          <View style={styles.emptyCard}>
            <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.emptyTitle}>
              まだ足あとがありません
            </Text>
            <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.emptyText}>
              起動後に自動で記録を開始します。位置情報の利用について確認して歩いてみましょう。
            </Text>
          </View>
        )}

        {!hasRequiredPermission && !isWhileInUseOnlyMode && (
          <View style={styles.permissionCard}>
            <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.permissionTitle}>
              位置情報の常時許可が必要です
            </Text>
            <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.permissionText}>
              バックグラウンドでGPSログを残すには、位置情報を常に許可してください。
            </Text>
            <Pressable onPress={onRequestLocationPermission} style={styles.permissionButton}>
              <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.permissionButtonText}>
                {shouldOpenSettingsForPermission ? '設定を開く' : '続ける'}
              </Text>
            </Pressable>
          </View>
        )}

        {showPhotosOnMap && photoErrorMessage && (
          <View style={styles.photoStatusCard}>
            <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.permissionText}>
              {photoErrorMessage}
            </Text>
          </View>
        )}

        {showPhotosOnMap && isLoadingPhotos && (
          <View style={styles.photoStatusCard}>
            <Text {...FIXED_MAP_UI_TEXT_PROPS} style={styles.permissionText}>
              ジオタグ付き写真を読み込んでいます...
            </Text>
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
          hasStayPlaces={hasStayPlaces}
          showStayPlacesOnMap={showStayPlacesOnMap}
          onRecenterOnUserLocation={onRecenterOnUserLocation}
          onOpenDailyLogs={onOpenDailyLogs}
          onOpenAchievements={onOpenAchievements}
          onOpenMonthlyReport={onOpenMonthlyReport}
          onOpenSettings={onOpenSettings}
          onToggleMapType={onToggleMapType}
          onUpdateShowPhotosOnMap={onUpdateShowPhotosOnMap}
          onUpdateShowStayPlacesOnMap={onUpdateShowStayPlacesOnMap}
        />
      </SafeAreaView>
    </View>
  );
}
