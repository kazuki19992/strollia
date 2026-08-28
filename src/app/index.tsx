import { ActivityIndicator, Animated, SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { MapScreen } from '@/ui/components/MapScreen';
import { useAppState } from '@/ui/state/AppStateProvider';
import { useScreenTransitionOpacity } from '@/ui/hooks/useScreenTransitionOpacity';

/** 地図画面のフェード時間(ms)。 */
const SCREEN_FADE_MS = 180;

/**
 * expo-router の地図画面ルート(/)。
 *
 * AppStateProvider から状態・操作を取得し MapScreen を描画する。
 * 画面遷移は AppStateProvider に渡された navigator(useRouterNavigator) 経由で行われる。
 */
export default function MapRoute(): React.ReactElement {
  const s = useAppState();
  const fadeOpacity = useScreenTransitionOpacity('map', SCREEN_FADE_MS);

  if (!s.isReady) {
    return (
      <SafeAreaView style={s.styles.loadingContainer}>
        <ActivityIndicator color={s.theme.colors.primary} />
        <Text style={s.styles.loadingText}>Strolliaを準備しています...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.styles.container}>
      <StatusBar style={s.theme.name === 'dark' ? 'light' : 'dark'} />
      {s.shouldShowDevelopmentFlagBanner && (
        <SafeAreaView pointerEvents="none" style={s.styles.developmentFlagBannerContainer}>
          <Text style={s.styles.developmentFlagBannerText}>開発フラグ有効</Text>
        </SafeAreaView>
      )}
      <Animated.View
        style={[
          s.styles.screenTransition,
          {
            opacity: fadeOpacity,
            transform: [{ translateY: fadeOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        <MapScreen
          mapRef={s.mapRef}
          styles={s.styles}
          theme={s.theme}
          initialRegion={s.initialRegion}
          mapType={s.mapType}
          userLocationIcon={s.userLocationIcon}
          onCustomIconError={s.handleCustomIconLoadError}
          isFollowingUserLocation={s.isFollowingUserLocation}
          userCoordinate={s.userCoordinate}
          visitedGridCells={s.visitedGridCells}
          gridOverlayOpacity={s.gridOverlayOpacity}
          showPhotosOnMap={s.showPhotosOnMap}
          isUpdatingPhotoSetting={s.isUpdatingPhotoSetting}
          photoClusters={s.photoClusters}
          activeStayPlaces={s.activeStayPlaces}
          hasAnyLocationPoints={s.hasAnyLocationPoints}
          hasRequiredPermission={s.hasRequiredPermission}
          shouldOpenSettingsForPermission={s.shouldOpenSettingsForPermission}
          isWhileInUseOnlyMode={s.isWhileInUseRecordingMode}
          photoErrorMessage={s.photoErrorMessage}
          isLoadingPhotos={s.isLoadingPhotos}
          photoScanMetricsLines={s.photoScanMetricsLines}
          distance={s.distance}
          todayDistance={s.todayDistanceMeters}
          currentSpeedKmh={s.currentSpeedKmh}
          currentAreaLabel={s.currentAreaLabel}
          recenterButtonOpacity={s.recenterButtonOpacity}
          onMapReady={s.handleMapReady}
          onUserLocationChange={s.handleUserLocationChange}
          onPanDrag={s.handleMapPanDrag}
          onRegionChangeComplete={s.handleRegionChangeComplete}
          onRegionChange={s.handleRegionChange}
          onPhotoClusterPress={s.handlePhotoClusterPress}
          onOpenDailyLogs={s.openDailyLogs}
          onOpenAchievements={s.openAchievements}
          onOpenMonthlyReport={s.openMonthlyReport}
          onToggleMapType={s.toggleMapType}
          onUpdateShowPhotosOnMap={s.updateShowPhotosOnMap}
          onOpenSettings={s.openSettings}
          onRequestLocationPermission={s.requestLocationPermission}
          onRecenterOnUserLocation={s.recenterOnUserLocation}
        />
      </Animated.View>
    </View>
  );
}
