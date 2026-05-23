import { StyleSheet, Text, View } from 'react-native';
import { Animated } from 'react-native';

import { NUMERIC_DISPLAY_FONT } from '../../../theme/fonts';
import { lightTheme } from '../../../theme/theme';
import { createStyles } from '../../appStyles';
import {
  formatDistanceKilometers,
  formatSpeedKmh,
  getSpeedMeterAppearance,
  getSpeedMeterArcStroke,
  SPEED_METER_ARC_CIRCUMFERENCE,
} from '../MapBottomDashboard';
import { MapScreen } from '../MapScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    AntDesign: Text,
    Entypo: Text,
    Feather: Text,
    MaterialCommunityIcons: Text,
    MaterialIcons: Text,
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
    visibleRouteSegments: [],
    routeLineStyle: { color: lightTheme.colors.mapLine, width: 4, glow: false },
    showPhotosOnMap: false,
    isUpdatingPhotoSetting: false,
    photoClusters: [],
    points: [],
    hasRequiredPermission: true,
    shouldOpenSettingsForPermission: false,
    photoErrorMessage: null,
    isLoadingPhotos: false,
    distance: 1234,
    todayDistance: 456,
    currentSpeedKmh: 7,
    currentAreaLabel: { primary: '千代田区', secondary: '神田' },
    recenterButtonOpacity: new Animated.Value(0),
    onUserLocationChange: jest.fn(),
    onPanDrag: jest.fn(),
    onRegionChangeComplete: jest.fn(),
    onPhotoClusterPress: jest.fn(),
    onOpenDailyLogs: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenMonthlyReport: jest.fn(),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
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

  test('上部ステータスやメニューを地図上に表示しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('千代田区');
    expect(texts).toContain('神田');
    expect(texts).not.toContain('🚶 徒歩で移動中...');
    expect(texts).not.toContain('メニュー');
  });

  test('記録状態とスピードメーターを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('SPEED');
    expect(texts).toContain('ODO');
  });

  test('ODOメーターの数値に7セグフォントを使う', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const distanceText = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '1');
    const dotText = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '.');
    const decimalText = renderer.root.findAllByType(Text).find((node: any) => node.props.children === '23');

    expect(distanceText).toBeDefined();
    expect(dotText).toBeDefined();
    expect(decimalText).toBeDefined();
    expect(StyleSheet.flatten(distanceText!.props.style)?.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(dotText!.props.style)?.fontSize).toBe(StyleSheet.flatten(distanceText!.props.style)?.fontSize);
    expect(StyleSheet.flatten(decimalText!.props.style)?.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(decimalText!.props.style)?.fontSize).toBeLessThan(StyleSheet.flatten(distanceText!.props.style)?.fontSize ?? 0);
  });

  test('下部ダッシュボードに今日の距離と操作ボタンを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('TODAY');
    expect(texts).toContain('0');
    expect(texts).toContain('.');
    expect(texts).toContain('46');
    expect(renderer.root.findAll((node: any) => node.props.accessibilityLabel === '日ごとの記録').length).toBeGreaterThan(0);
    expect(renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'マップの表示').length).toBeGreaterThan(0);
  });

  test('下部距離帯はODOへ広い幅を割り当てる', () => {
    expect(StyleSheet.flatten(styles.dashboardOdometerMetric)?.minWidth).toBeGreaterThan(
      StyleSheet.flatten(styles.dashboardTodayMetric)?.minWidth ?? 0,
    );
  });

  test('距離値は右端固定で地名は6文字相当の幅を確保する', () => {
    expect(StyleSheet.flatten(styles.speedometerDistanceValueRow)?.justifyContent).toBe('flex-end');
    expect(StyleSheet.flatten(styles.dashboardPlaceMetric)?.minWidth).toBeGreaterThanOrEqual(96);
  });

  test('レポート操作にはHistoryアイコンを使う', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    expect(renderer.root.findAll((node: any) => node.props.name === 'history').length).toBeGreaterThan(0);
  });

  test('マップ表示ボタンから写真表示設定を開く', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const mapDisplayButton = renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'マップの表示')[0];
    act(() => mapDisplayButton.props.onPress());

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('標準マップ');
    expect(texts).toContain('航空写真');
    expect(texts).toContain('マップ上に写真を表示');
  });
  test('現在地アイコンは常に白で表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...createProps()} />);
    });

    const navigationIcon = renderer.root.findAll((node: any) => node.props.name === 'navigation')[0];
    expect(navigationIcon.props.color).toBe('#ffffff');
  });

  test('下部レポートボタンを押すと月次レポートを開く', () => {
    const props = createProps();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...props} />);
    });

    const reportButton = renderer.root.find((node: any) => node.props.accessibilityLabel === 'レポートを見る');
    act(() => reportButton.props.onPress());

    expect(props.onOpenMonthlyReport).toHaveBeenCalledTimes(1);
  });

  test('分割済みルートを複数Polylineで描く', () => {
    const props = {
      ...createProps(),
      visibleRouteSegments: [
        { id: 'first', coordinates: [{ latitude: 35, longitude: 139 }, { latitude: 35.001, longitude: 139 }] },
        { id: 'second', coordinates: [{ latitude: 36, longitude: 140 }, { latitude: 36.001, longitude: 140 }] },
      ],
    };
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapScreen {...props} />);
    });

    const polylines = renderer.root.findAll((node: any) => Array.isArray(node.props.coordinates));
    expect(new Set(polylines.map((node: any) => node.props.coordinates)).size).toBe(2);
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
  test('速度進捗に応じて連続円弧の表示長を変える', () => {
    const zeroStroke = getSpeedMeterArcStroke(0);
    const halfStroke = getSpeedMeterArcStroke(50);

    expect(zeroStroke.strokeDashoffset).toBe(SPEED_METER_ARC_CIRCUMFERENCE);
    expect(halfStroke.strokeDasharray).toBe(SPEED_METER_ARC_CIRCUMFERENCE);
    expect(halfStroke.strokeDashoffset).toBeCloseTo(SPEED_METER_ARC_CIRCUMFERENCE / 2);
  });

  test('速度帯に応じてゲージ色と進捗を変える', () => {
    expect(getSpeedMeterAppearance(0, '#00aaff')).toEqual({ color: '#2ad4ff', progressPercent: 0 });
    expect(getSpeedMeterAppearance(7, '#00aaff').color).toBe('#39d9ff');
    expect(getSpeedMeterAppearance(50, '#00aaff').color).toBe('#ffb22e');
    expect(getSpeedMeterAppearance(350, '#00aaff').color).toBe('#ff75f6');
  });
});
