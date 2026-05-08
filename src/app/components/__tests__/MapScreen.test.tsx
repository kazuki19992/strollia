import { Text, View } from 'react-native';
import { Animated } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { MapScreen } from '../MapScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    AntDesign: Text,
    Entypo: Text,
    Feather: Text,
    MaterialCommunityIcons: Text,
  };
});

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
  };
});

jest.mock('../PhotoClusterMarker', () => ({
  PhotoClusterMarker: () => null,
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy(
  {},
  {
    get: () => ({}),
  },
);

/** 地図画面テスト用の既定propsを作る。 */
function createProps() {
  return {
    mapRef: { current: null },
    styles: styles as never,
    theme: lightTheme,
    initialRegion: { latitude: 35, longitude: 139, latitudeDelta: 0.01, longitudeDelta: 0.01 },
    mapType: 'standard' as const,
    userLocationIcon: { useNativeUserLocation: true, customIconId: null },
    isFollowingUserLocation: true,
    userCoordinate: null,
    visibleRouteCoordinates: [],
    routeLineStyle: { color: lightTheme.colors.mapLine, width: 4, glow: false },
    showPhotosOnMap: false,
    photoClusters: [],
    isMenuVisible: false,
    isMenuOpen: false,
    menuProgress: new Animated.Value(0),
    isRecording: true,
    points: [],
    hasRequiredPermission: true,
    shouldOpenSettingsForPermission: false,
    photoErrorMessage: null,
    isLoadingPhotos: false,
    currentAreaName: '渋谷区',
    distance: 1234,
    recenterButtonOpacity: new Animated.Value(0),
    onUserLocationChange: jest.fn(),
    onPanDrag: jest.fn(),
    onRegionChangeComplete: jest.fn(),
    onPhotoClusterPress: jest.fn(),
    onToggleMenu: jest.fn(),
    onCloseMenu: jest.fn(),
    onOpenDailyLogs: jest.fn(),
    onOpenAchievements: jest.fn(),
    onToggleMapType: jest.fn(),
    onOpenSettings: jest.fn(),
    onRequestLocationPermission: jest.fn(),
    onRecenterOnUserLocation: jest.fn(),
  };
}

describe('地図画面 MapScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('現在地名と記録状態を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('記録中');
    expect(texts).toContain('渋谷区');
  });
});
