import { Image, StyleSheet, Text, Animated } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import {
  formatDistanceKilometers,
  formatSpeedKmh,
  getSpeedMeterAppearance,
  getSpeedMeterArcStroke,
  SPEED_METER_ARC_CIRCUMFERENCE,
} from '@/ui/components/MapBottomDashboard';
import { MapScreen } from '@/ui/components/MapScreen';

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
  const React = require('react');
  type MockMapComponentProps = Record<string, unknown> & { children?: unknown };
  const MapViewMock = (props: MockMapComponentProps) => React.createElement('MapView', props, props.children);
  const MarkerMock = (props: MockMapComponentProps) => React.createElement('Marker', props, props.children);
  const PolygonMock = (props: MockMapComponentProps) => React.createElement('Polygon', props, props.children);
  const PolylineMock = (props: MockMapComponentProps) => React.createElement('Polyline', props, props.children);

  return {
    __esModule: true,
    default: MapViewMock,
    Marker: MarkerMock,
    Polygon: PolygonMock,
    Polyline: PolylineMock,
  };
});

jest.mock('@/ui/components/PhotoClusterMarker', () => ({
  PhotoClusterMarker: () => null,
}));

const styles = createStyles(lightTheme);

/** 地図画面テスト用の既定propsを作る。 */
function createProps() {
  return {
    mapRef: { current: null },
    styles: styles as never,
    theme: lightTheme,
    initialRegion: { latitude: 35, longitude: 139, latitudeDelta: 0.01, longitudeDelta: 0.01 },
    mapType: 'standard' as const,
    userLocationIcon: { useNativeUserLocation: true, customIconId: null, customImageUri: null },
    isFollowingUserLocation: true,
    userCoordinate: null,
    visitedGridCells: [],
    gridOverlayOpacity: 0.3,
    showPhotosOnMap: false,
    isUpdatingPhotoSetting: false,
    photoClusters: [],
    points: [],
    hasRequiredPermission: true,
    isWhileInUseOnlyMode: false,
    shouldOpenSettingsForPermission: false,
    photoErrorMessage: null,
    isLoadingPhotos: false,
    distance: 1234,
    todayDistance: 456,
    currentSpeedKmh: 7,
    currentAreaLabel: { primary: '千代田区', secondary: '神田' },
    recenterButtonOpacity: new Animated.Value(0),
    onMapReady: jest.fn(),
    onUserLocationChange: jest.fn(),
    onPanDrag: jest.fn(),
    onRegionChangeComplete: jest.fn(),
    onRegionChange: jest.fn(),
    onPhotoClusterPress: jest.fn(),
    onOpenDailyLogs: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenMonthlyReport: jest.fn(),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onOpenSettings: jest.fn(),
    onRequestLocationPermission: jest.fn(),
    onRecenterOnUserLocation: jest.fn(),
    onCustomIconError: jest.fn(),
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
    render(<MapScreen {...createProps()} />);

    expect(screen.getByText('千代田区')).toBeTruthy();
    expect(screen.getByText('神田')).toBeTruthy();
    expect(screen.queryByText('🚶 徒歩で移動中...')).toBeNull();
    expect(screen.queryByText('メニュー')).toBeNull();
  });

  test('記録状態とスピードメーターを表示する', () => {
    render(<MapScreen {...createProps()} />);

    expect(screen.getByText('SPEED')).toBeTruthy();
    expect(screen.getByText('ODO')).toBeTruthy();
  });

  test('ODOメーターの数値に7セグフォントを使う', () => {
    render(<MapScreen {...createProps()} />);

    // UNSAFE_getAllByType を使うのは fontFamily という非セマンティックな props を検証するため
    const allTexts = screen.UNSAFE_getAllByType(Text);
    const distanceText = allTexts.find((node) => node.props.children === '1');
    const dotText = allTexts.find((node) => node.props.children === '.');
    const decimalText = allTexts.find((node) => node.props.children === '23');

    expect(distanceText).toBeDefined();
    expect(dotText).toBeDefined();
    expect(decimalText).toBeDefined();
    expect(StyleSheet.flatten(distanceText!.props.style)?.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(dotText!.props.style)?.fontSize).toBe(StyleSheet.flatten(distanceText!.props.style)?.fontSize);
    expect(StyleSheet.flatten(decimalText!.props.style)?.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(decimalText!.props.style)?.fontSize).toBeLessThan(
      StyleSheet.flatten(distanceText!.props.style)?.fontSize ?? 0,
    );
  });

  test('下部ダッシュボードに今日の距離と操作ボタンを表示する', () => {
    render(<MapScreen {...createProps()} />);

    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getAllByText('.').length).toBeGreaterThan(0);
    expect(screen.getByText('46')).toBeTruthy();
    expect(screen.getByLabelText('日ごとの記録')).toBeTruthy();
    expect(screen.getByLabelText('マップの表示')).toBeTruthy();
  });

  test('下部距離帯はODOへ広い幅を割り当てる', () => {
    expect(StyleSheet.flatten(styles.dashboardOdometerMetric)?.minWidth).toBeGreaterThan(
      StyleSheet.flatten(styles.dashboardTodayMetric)?.minWidth ?? 0,
    );
  });

  test('距離値は右端固定で指定桁数用の幅を確保する', () => {
    expect(StyleSheet.flatten(styles.speedometerDistanceValueRow)?.justifyContent).toBe('flex-end');
    expect(StyleSheet.flatten(styles.dashboardOdometerMetric)?.minWidth).toBeGreaterThanOrEqual(92);
    expect(StyleSheet.flatten(styles.dashboardTodayMetric)?.minWidth).toBeGreaterThanOrEqual(56);
    expect(StyleSheet.flatten(styles.dashboardPlaceMetric)?.minWidth).toBeGreaterThanOrEqual(76);
    expect(StyleSheet.flatten(styles.dashboardPlaceMetric)?.minWidth).toBeLessThan(96);
  });

  test('地図オーバーレイの文言はシステム文字サイズで拡大しない', () => {
    render(<MapScreen {...createProps()} hasRequiredPermission={false} />);

    // UNSAFE_getAllByType を使うのは allowFontScaling という非セマンティックな props を検証するため
    const overlayTexts = screen
      .UNSAFE_getAllByType(Text)
      .filter((node) => ['まだ足あとがありません', '位置情報の常時許可が必要です', '続ける'].includes(node.props.children as string));
    expect(overlayTexts).toHaveLength(3);
    expect(overlayTexts.every((node) => node.props.allowFontScaling === false)).toBe(true);
  });

  test('アプリ起動中のみ記録モードでは権限エラーパネルを表示しない', () => {
    render(<MapScreen {...createProps()} hasRequiredPermission={false} isWhileInUseOnlyMode={true} />);

    expect(screen.queryByText('位置情報の常時許可が必要です')).toBeNull();
  });

  test('権限が無くアプリ起動中のみ記録モードでもない場合は権限エラーパネルを表示する', () => {
    render(<MapScreen {...createProps()} hasRequiredPermission={false} isWhileInUseOnlyMode={false} />);

    expect(screen.getByText('位置情報の常時許可が必要です')).toBeTruthy();
  });

  test('レポート操作にはHistoryアイコンを使う', () => {
    render(<MapScreen {...createProps()} />);

    // UNSAFE_getAllByProps を使うのは name という非セマンティックな props でアイコンを検索するため
    const historyIcons = screen.UNSAFE_getAllByProps({ name: 'history' });
    expect(historyIcons.length).toBeGreaterThan(0);
  });

  test('マップ表示ボタンから写真表示設定を開く', () => {
    render(<MapScreen {...createProps()} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });

    expect(screen.getByText('標準マップ')).toBeTruthy();
    expect(screen.getByText('航空写真')).toBeTruthy();
    expect(screen.getByText('マップ上に写真を表示')).toBeTruthy();
  });

  test('現在地アイコンは常に白で表示する', () => {
    render(<MapScreen {...createProps()} />);

    // UNSAFE_getAllByProps を使うのは color という非セマンティックな props でアイコンを検索するため
    const navigationIcons = screen.UNSAFE_getAllByProps({ name: 'navigation' });
    expect(navigationIcons[0].props.color).toBe('#ffffff');
  });

  test('下部レポートボタンを押すと月次レポートを開く', () => {
    const props = createProps();
    render(<MapScreen {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('レポートを見る'));
    });

    expect(props.onOpenMonthlyReport).toHaveBeenCalledTimes(1);
  });

  test('メインマップではPolylineを描画しない', () => {
    render(<MapScreen {...createProps()} />);

    // UNSAFE_getAllByProps を使うのは coordinates という非セマンティックな props で Polyline を検索するため
    const polylines = screen.UNSAFE_getAllByProps({}).filter((node) => Array.isArray(node.props.coordinates));
    expect(polylines).toHaveLength(0);
  });

  test('visited grid overlayをPolygonで描く', () => {
    render(
      <MapScreen
        {...createProps()}
        visitedGridCells={[
          {
            id: '100:1:2:1x1',
            coordinates: [
              { latitude: 35, longitude: 139 },
              { latitude: 35, longitude: 139.001 },
              { latitude: 35.001, longitude: 139.001 },
              { latitude: 35.001, longitude: 139 },
            ],
            fillColor: 'rgba(0, 150, 136, 0.3)',
            strokeColor: 'rgba(0, 150, 136, 0)',
            strokeWidth: 0,
          },
        ]}
      />,
    );

    // UNSAFE_getAllByProps を使うのは testID という非セマンティックな props でグリッドセルを検索するため
    const gridCells = screen.UNSAFE_getAllByProps({ testID: 'visited-grid-cell' }).filter((node) => node.props.fillColor);
    expect(gridCells.length).toBeGreaterThan(0);
    expect(gridCells[0].props.fillColor).toBe('rgba(0, 150, 136, 0.3)');
    expect(gridCells[0].props.strokeWidth).toBe(0);
  });

  test('Apple MapsのLegal位置指定はデフォルトに任せmapPaddingだけ再描画で同じ参照を使う', () => {
    const props = createProps();
    const { rerender } = render(<MapScreen {...props} />);

    // UNSAFE_getAllByProps を使うのは MapView という非セマンティックな型を props で検索するため
    const mapViewBefore = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
    const firstMapPadding = mapViewBefore!.props.mapPadding;

    act(() => {
      rerender(<MapScreen {...props} gridOverlayOpacity={0.4} />);
    });

    const mapViewAfter = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
    expect(mapViewBefore!.props.legalLabelInsets).toBeUndefined();
    expect(firstMapPadding).toEqual({ bottom: 128, left: 0, right: 0, top: 8 });
    expect(mapViewAfter!.props.legalLabelInsets).toBeUndefined();
    expect(mapViewAfter!.props.mapPadding).toBe(firstMapPadding);
  });

  test('カスタムアイコン時はOS標準の現在地ドットを隠す', () => {
    render(
      <MapScreen
        {...createProps()}
        userLocationIcon={{ useNativeUserLocation: false, customIconId: 'walker' as const, customImageUri: null }}
        userCoordinate={{ latitude: 35, longitude: 139 }}
      />,
    );

    // UNSAFE_getAllByProps を使うのは MapView の showsUserLocation という非セマンティックな props を検証するため
    const mapView = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
    expect(mapView!.props.showsUserLocation).toBe(false);
  });

  test('OS標準アイコン時はOS標準の現在地ドットを表示する', () => {
    render(<MapScreen {...createProps()} userLocationIcon={{ useNativeUserLocation: true, customIconId: null, customImageUri: null }} />);

    // UNSAFE_getAllByProps を使うのは MapView の showsUserLocation という非セマンティックな props を検証するため
    const mapView = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
    expect(mapView!.props.showsUserLocation).toBe(true);
  });

  test('OS標準の現在地ボタン(Android)は非表示にする（アプリ独自の現在地ボタンを使うため）', () => {
    render(<MapScreen {...createProps()} />);

    // UNSAFE_getAllByProps を使うのは MapView の showsMyLocationButton という非セマンティックな props を検証するため
    const mapView = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
    expect(mapView!.props.showsMyLocationButton).toBe(false);
  });

  test('Androidでは操作中のonRegionChangeでも表示範囲を更新する（エリア拡大の追従を速くするため）', () => {
    const { Platform } = require('react-native');
    const osReplaced = jest.replaceProperty(Platform, 'OS', 'android');
    const props = createProps();

    try {
      render(<MapScreen {...props} />);
      // UNSAFE_getAllByProps を使うのは MapView の onRegionChange という非セマンティックな props を検証するため
      const mapView = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
      expect(mapView!.props.onRegionChange).toBe(props.onRegionChange);
    } finally {
      osReplaced.restore();
    }
  });

  test('iOSでは操作中のonRegionChangeは渡さない（既存挙動を維持しiOSに影響を与えない）', () => {
    const { Platform } = require('react-native');
    const osReplaced = jest.replaceProperty(Platform, 'OS', 'ios');

    try {
      render(<MapScreen {...createProps()} />);
      // UNSAFE_getAllByProps を使うのは MapView の onRegionChange という非セマンティックな props を検証するため
      const mapView = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'MapView');
      expect(mapView!.props.onRegionChange).toBeUndefined();
    } finally {
      osReplaced.restore();
    }
  });

  test('customImageUri があるとき Image コンポーネントで円表示する', () => {
    render(
      <MapScreen
        {...createProps()}
        userLocationIcon={{ useNativeUserLocation: false, customIconId: null, customImageUri: 'file:///tmp/icon.png' }}
        userCoordinate={{ latitude: 35, longitude: 139 }}
      />,
    );

    // UNSAFE_getByType を使うのは Image という型で要素を検索するため
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'file:///tmp/icon.png' });
  });

  test('カスタム画像エラー時に onCustomIconError を呼ぶ', () => {
    const onCustomIconError = jest.fn();
    render(
      <MapScreen
        {...createProps()}
        userLocationIcon={{ useNativeUserLocation: false, customIconId: null, customImageUri: 'file:///tmp/icon.png' }}
        userCoordinate={{ latitude: 35, longitude: 139 }}
        onCustomIconError={onCustomIconError}
      />,
    );

    // UNSAFE_getByType を使うのは Image という型で要素を検索するため
    const image = screen.UNSAFE_getByType(Image);
    act(() => {
      image.props.onError();
    });

    expect(onCustomIconError).toHaveBeenCalledTimes(1);
  });

  test('カスタム画像マーカーは初回tracksViewChangesがtrueで画像ロード後にfalseになる', () => {
    render(
      <MapScreen
        {...createProps()}
        userLocationIcon={{ useNativeUserLocation: false, customIconId: null, customImageUri: 'file:///tmp/icon.png' }}
        userCoordinate={{ latitude: 35, longitude: 139 }}
      />,
    );

    // UNSAFE_getAllByProps を使うのは Marker の tracksViewChanges という非セマンティックな props を検証するため
    const marker = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'Marker');
    expect(marker!.props.tracksViewChanges).toBe(true);

    // UNSAFE_getByType を使うのは Image という型で要素を検索するため
    const image = screen.UNSAFE_getByType(Image);
    act(() => {
      image.props.onLoad();
    });

    const updatedMarker = screen.UNSAFE_getAllByProps({}).find((node) => node.type === 'Marker');
    expect(updatedMarker!.props.tracksViewChanges).toBe(false);
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
