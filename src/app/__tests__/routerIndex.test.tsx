import { render, screen } from '@testing-library/react-native';
import AppEntry from '@/app/index';

// expo-router のフックをスタブ化する
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
}));

// AppStateProvider の依存をスタブ化し、軽量な View でレンダリングを確認する
jest.mock('@/ui/state/AppStateProvider', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    AppStateProvider: ({ children }: { children: React.ReactNode }) => children,
    useAppState: () => ({
      isReady: true,
      styles: {
        container: {},
        loadingContainer: {},
        loadingText: {},
        developmentFlagBannerContainer: {},
        developmentFlagBannerText: {},
        screenTransition: {},
      },
      theme: { name: 'light', colors: { primary: '#000' } },
      shouldShowDevelopmentFlagBanner: false,
      mapRef: { current: null },
      mapType: 'standard',
      userLocationIcon: { useNativeUserLocation: true, customIconId: null, customImageUri: null },
      handleCustomIconLoadError: jest.fn(),
      isFollowingUserLocation: true,
      userCoordinate: null,
      visitedGridCells: [],
      gridOverlayOpacity: 0,
      showPhotosOnMap: false,
      isUpdatingPhotoSetting: false,
      photoClusters: [],
      stayPlaces: [],
      points: [],
      hasRequiredPermission: true,
      shouldOpenSettingsForPermission: false,
      isWhileInUseRecordingMode: false,
      photoErrorMessage: null,
      isLoadingPhotos: false,
      distance: 0,
      todayDistanceMeters: 0,
      currentSpeedKmh: 0,
      currentAreaLabel: { primary: '', secondary: null },
      recenterButtonOpacity: { interpolate: () => 0 },
      handleMapReady: jest.fn(),
      handleUserLocationChange: jest.fn(),
      handleMapPanDrag: jest.fn(),
      handleRegionChangeComplete: jest.fn(),
      handleRegionChange: jest.fn(),
      handlePhotoClusterPress: jest.fn(),
      toggleMapType: jest.fn(),
      updateShowPhotosOnMap: jest.fn(),
      requestLocationPermission: jest.fn(),
      recenterOnUserLocation: jest.fn(),
      openAchievements: jest.fn(),
      openMonthlyReport: jest.fn(),
      initialRegion: { latitude: 35.68, longitude: 139.76, latitudeDelta: 0.05, longitudeDelta: 0.05 },
    }),
  };
});

// useScreenTransitionOpacity をスタブ化する
jest.mock('@/ui/hooks/useScreenTransitionOpacity', () => ({
  useScreenTransitionOpacity: () => ({ interpolate: () => 0 }),
}));

// MapScreen の依存をスタブ化する
jest.mock('@/ui/components/MapScreen', () => ({
  MapScreen: () => null,
}));

// expo-status-bar をスタブ化する
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

describe('expo-router エントリポイント (index)', () => {
  test('default export が存在しレンダリングできること', () => {
    render(<AppEntry />);

    expect(screen.toJSON()).not.toBeNull();
  });
});
