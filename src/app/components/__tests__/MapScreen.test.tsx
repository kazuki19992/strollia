import { StyleSheet, Text, View } from 'react-native';
import { Animated } from 'react-native';

import { NUMERIC_DISPLAY_FONT } from '../../../theme/fonts';
import { lightTheme } from '../../../theme/theme';
import { createStyles } from '../../appStyles';
import { formatDistanceKilometers, formatSpeedKmh, getSpeedMeterAppearance, MapScreen } from '../MapScreen';

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

const styles = createStyles(lightTheme);

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
    distance: 1234,
    todayDistance: 456,
    currentSpeedKmh: 7,
    recenterButtonOpacity: new Animated.Value(0),
    onUserLocationChange: jest.fn(),
    onPanDrag: jest.fn(),
    onRegionChangeComplete: jest.fn(),
    onPhotoClusterPress: jest.fn(),
    onToggleMenu: jest.fn(),
    onCloseMenu: jest.fn(),
    onOpenDailyLogs: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenMonthlyReport: jest.fn(),
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

  test('記録状態とスピードメーターを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('記録中');
    expect(texts).toContain('SPEED');
    expect(texts).toContain('ODO');
  });

  test('ODOメーターの数値に7セグフォントを使う', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const distanceText = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '1');
    const decimalText = renderer.root.findAllByType(Text).find((node: any) => Array.isArray(node.props.children) && node.props.children.join('') === '.23');

    expect(distanceText).toBeDefined();
    expect(decimalText).toBeDefined();
    expect(StyleSheet.flatten(distanceText!.props.style)?.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(decimalText!.props.style)?.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(decimalText!.props.style)?.fontSize).toBeLessThan(StyleSheet.flatten(distanceText!.props.style)?.fontSize ?? 0);
  });

  test('メーターボタンを押すと今日の移動距離表示へ切り替える', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const meterButton = renderer.root.findAll((node: any) => node.props.accessibilityLabel?.includes?.('オドメーターを表示中'))[0];
    act(() => meterButton.props.onPress());

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('TODAY');
    expect(texts).toContain('0');
    expect(texts.some((text: unknown) => Array.isArray(text) && text.join('') === '.46')).toBe(true);
  });

  test('現在地アイコンは常に白で表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const navigationIcon = renderer.root.findAll((node: any) => node.props.name === 'navigation')[0];
    expect(navigationIcon.props.color).toBe('#ffffff');
  });

  test('メニューのレポートを見るを押すと月次レポートを開く', () => {
    const props = { ...createProps(), isMenuVisible: true, isMenuOpen: true };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...props} />);
    });

    const reportMenuItem = renderer.root.findAll((node: any) => node.props.children?.some?.((child: any) => child?.props?.children === 'レポートを見る'))[0];
    act(() => reportMenuItem.props.onPress());

    expect(props.onOpenMonthlyReport).toHaveBeenCalledTimes(1);
  });
});

describe('スピードメーター表示ロジック', () => {
  test('速度を整数km/hへ丸める', () => {
    expect(formatSpeedKmh(7.4)).toBe('7');
    expect(formatSpeedKmh(7.5)).toBe('8');
  });

  test('距離をkm小数2桁へ変換する', () => {
    expect(formatDistanceKilometers(1234)).toBe('1.23');
  });

  test('速度帯に応じてゲージ色と進捗を変える', () => {
    expect(getSpeedMeterAppearance(0, '#00aaff')).toEqual({ color: '#2ad4ff', progressPercent: 0 });
    expect(getSpeedMeterAppearance(7, '#00aaff').color).toBe('#39d9ff');
    expect(getSpeedMeterAppearance(50, '#00aaff').color).toBe('#ffb22e');
    expect(getSpeedMeterAppearance(350, '#00aaff').color).toBe('#ff75f6');
  });
});
