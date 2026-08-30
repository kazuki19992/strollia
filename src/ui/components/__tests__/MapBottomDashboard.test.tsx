import * as ReactNative from 'react-native';
import { Animated, StyleSheet, Text } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import {
  getDashboardScale,
  getScaledSpeedDialLayout,
  getSpeedMeterAppearance,
  getSpeedMeterArcStroke,
  MapBottomDashboard,
  METER_CLUSTER_BACKGROUND_PATH,
  SMALL_DASHBOARD_MIN_SCALE,
  SPEED_METER_ARC_CIRCUMFERENCE,
  SPEED_METER_ARC_RADIUS,
  SPEED_METER_ARC_STROKE_WIDTH,
} from '@/ui/components/MapBottomDashboard';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    Feather: Text,
    MaterialCommunityIcons: Text,
    MaterialIcons: Text,
  };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    Circle: View,
    Path: View,
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

const styles = createStyles(lightTheme);

/** 下部ダッシュボードのテスト用propsを作る。 */
function createProps() {
  return {
    styles,
    theme: lightTheme,
    mapType: 'standard' as const,
    isFollowingUserLocation: false,
    recenterButtonOpacity: new Animated.Value(1),
    distance: 9_876_543_210,
    todayDistance: 9_876_540,
    currentSpeedKmh: 7,
    currentAreaLabel: { primary: '船橋市', secondary: '行田' },
    showPhotosOnMap: false,
    isUpdatingPhotoSetting: false,
    hasStayPlaces: true,
    showStayPlacesOnMap: true,
    onRecenterOnUserLocation: jest.fn(),
    onOpenDailyLogs: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenMonthlyReport: jest.fn(),
    onOpenSettings: jest.fn(),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
    onUpdateShowStayPlacesOnMap: jest.fn().mockResolvedValue(undefined),
  };
}

describe('マップ下部ダッシュボード', () => {
  test('速度計と距離帯の背景を単一パスで描く', () => {
    expect(METER_CLUSTER_BACKGROUND_PATH).toContain('H104');
    expect(METER_CLUSTER_BACKGROUND_PATH.match(/rgba/)).toBeNull();
  });

  test('速度計と長い距離表示をまとめて描画する', () => {
    render(<MapBottomDashboard {...createProps()} />);

    expect(screen.getByText('SPEED')).toBeTruthy();
    expect(screen.getByText('ODO')).toBeTruthy();
    expect(screen.getByText('9876543')).toBeTruthy();
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('9876')).toBeTruthy();
    expect(screen.getByText('船橋市')).toBeTruthy();
  });

  test('速度と距離の指定桁数と市名6文字プラス市を固定文字サイズで表示する', () => {
    render(
      <MapBottomDashboard
        {...createProps()}
        currentAreaLabel={{ primary: 'つくばみらい市', secondary: null }}
        currentSpeedKmh={999}
        distance={98_765_432_100}
        todayDistance={9_876_540}
      />,
    );

    expect(screen.getByText('999')).toBeTruthy();
    expect(screen.getByText('98765432')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('9876')).toBeTruthy();
    expect(screen.getByText('54')).toBeTruthy();
    expect(screen.getByText('つくばみらい市')).toBeTruthy();

    // allowFontScaling=false を持つ文字列テキストのみを検証する
    // UNSAFE_getAllByType を使うのは allowFontScaling という非セマンティックな props の検証のため
    const textNodes = screen.UNSAFE_getAllByType(Text).filter((node) => typeof node.props.children === 'string');
    expect(textNodes.every((node) => node.props.allowFontScaling === false)).toBe(true);
  });

  test('距離帯は市名6文字プラス市の7文字表示用の幅を確保する', () => {
    expect(styles.dashboardPlaceMetric.minWidth).toBeGreaterThanOrEqual(76);
    expect(styles.dashboardOdometerMetric.minWidth).toBeGreaterThanOrEqual(92);
    expect(styles.dashboardTodayMetric.minWidth).toBeGreaterThanOrEqual(56);
  });

  test('マップボタンから表示設定パネルを前面に開く', () => {
    render(<MapBottomDashboard {...createProps()} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });

    expect(screen.getByText('標準マップ')).toBeTruthy();
    expect(screen.getByText('航空写真')).toBeTruthy();
    expect(screen.getByText('マップ上に写真を表示')).toBeTruthy();
    expect(screen.getByText('マップ上に滞在場所を表示')).toBeTruthy();
  });

  test('表示設定パネルは滞在場所ラベルを1行で表示できる幅を確保する', () => {
    render(<MapBottomDashboard {...createProps()} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });

    const panel = screen
      .UNSAFE_getAllByProps({})
      .find((node) => StyleSheet.flatten(node.props.style)?.width === styles.mapDisplayPanel.width);
    const stayPlacesLabel = screen.getByText('マップ上に滞在場所を表示');

    expect(StyleSheet.flatten(panel?.props.style).width).toBeGreaterThanOrEqual(330);
    expect(stayPlacesLabel.props.numberOfLines).toBe(1);
    expect(stayPlacesLabel.props.adjustsFontSizeToFit).toBe(true);
  });

  test('表示設定パネルを開いている間は背景のダッシュボード操作を無効化する', () => {
    const props = createProps();
    render(<MapBottomDashboard {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });

    const scrim = screen.getByLabelText('マップ表示設定を閉じる');
    expect(StyleSheet.flatten(scrim.props.style).backgroundColor).toBe('rgba(0, 0, 0, 0.56)');

    fireEvent.press(screen.getByLabelText('実績'));
    fireEvent.press(screen.getByLabelText('現在地へ戻る'));

    expect(props.onOpenAchievements).not.toHaveBeenCalled();
    expect(props.onRecenterOnUserLocation).not.toHaveBeenCalled();
  });

  test('滞在場所がない場合は表示設定パネルに滞在場所表示設定を出さない', () => {
    render(<MapBottomDashboard {...createProps()} hasStayPlaces={false} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });

    expect(screen.queryByText('マップ上に滞在場所を表示')).toBeNull();
  });

  test('表示設定パネルから滞在場所表示設定を切り替える', () => {
    const props = createProps();
    render(<MapBottomDashboard {...props} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });
    fireEvent(screen.getByLabelText('マップ上に滞在場所を表示'), 'valueChange', false);

    expect(props.onUpdateShowStayPlacesOnMap).toHaveBeenCalledWith(false);
  });

  test('地図種別の選択中バッジはViewで装飾しTextは文字だけ描画する', () => {
    render(<MapBottomDashboard {...createProps()} />);

    act(() => {
      fireEvent.press(screen.getByLabelText('マップの表示'));
    });

    const selectedLabel = screen.getByText('✓ 選択中');

    expect(selectedLabel).toBeTruthy();
    expect(selectedLabel.props.style).toEqual(styles.mapDisplayTypeSelectedBadgeText);
    // バッジ装飾用の View が mapDisplayTypeSelectedBadge スタイルを持っていることを確認する
    // UNSAFE_getAllByProps で mapDisplayTypeSelectedBadge スタイルを持つ View を探す
    const badgeView = screen
      .UNSAFE_getAllByProps({})
      .find((node) => node.props.style != null && node.props.style === styles.mapDisplayTypeSelectedBadge);
    expect(badgeView).toBeTruthy();
  });

  test('速度リングを連続円弧で描画する', () => {
    render(<MapBottomDashboard {...createProps()} currentSpeedKmh={15} />);

    // testID で速度リング円弧を検索する
    // UNSAFE_getAllByProps を使うのは testID という非セマンティックな props でフィルタリングが必要なため
    const arc = screen.UNSAFE_getAllByProps({ testID: 'speed-meter-progress-arc' })[0];
    expect(arc.props.stroke).toBe('#39d9ff');
    expect(arc.props.strokeDashoffset).toBeCloseTo(SPEED_METER_ARC_CIRCUMFERENCE / 2);
  });

  test('小さい画面では現在地名に縮小許可を付けて描画する', () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

    render(<MapBottomDashboard {...createProps()} currentAreaLabel={{ primary: 'つくばみらい市', secondary: null }} />);

    const place = screen.getByText('つくばみらい市');

    expect(place.props.adjustsFontSizeToFit).toBe(true);
    expect(place.props.minimumFontScale).toBeLessThan(1);
    expect(place.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: expect.any(Number) })]));
  });

  test('小さい画面では速度リングの背景とSVGを同じ倍率で縮小する', () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

    render(<MapBottomDashboard {...createProps()} />);

    const scale = getDashboardScale(375);
    const layout = getScaledSpeedDialLayout(scale);

    // testID でリング背景とSVGを検索する
    const ringBase = screen.UNSAFE_getAllByProps({ testID: 'speed-meter-ring-base' })[0];
    const arcSvg = screen.UNSAFE_getAllByProps({ testID: 'speed-meter-arc-svg' })[0];

    expect(ringBase.props.style).toEqual(expect.arrayContaining([expect.objectContaining(layout.ringBase)]));
    expect(arcSvg.props.style).toEqual(expect.arrayContaining([expect.objectContaining(layout.arcSvg)]));
  });
});

describe('マップ下部ダッシュボードの速度帯', () => {
  test('大きい画面ではダッシュボード倍率を1に保つ', () => {
    expect(getDashboardScale(430)).toBe(1);
    expect(getDashboardScale(460)).toBe(1);
  });

  test('小さい画面ではダッシュボード倍率を下限まで縮小する', () => {
    expect(getDashboardScale(393)).toBeLessThan(1);
    expect(getDashboardScale(320)).toBe(SMALL_DASHBOARD_MIN_SCALE);
  });

  test('小さい画面の速度メーターはリングとSVGを同じ寸法に縮小する', () => {
    const scale = getDashboardScale(375);
    const layout = getScaledSpeedDialLayout(scale);

    expect(layout.dial.width).toBe(layout.arcSvg.width);
    expect(layout.dial.height).toBe(layout.arcSvg.height);
    expect(layout.ringBase.width).toBeCloseTo(100 * scale);
    expect(layout.ringBase.height).toBeCloseTo(100 * scale);
  });

  test('速度帯を30km/hと150km/hで切り替える', () => {
    const lowSpeed = getSpeedMeterAppearance(29.9, '#123456');
    const vehicleSpeed = getSpeedMeterAppearance(30, '#123456');
    const fastSpeed = getSpeedMeterAppearance(150, '#123456');

    expect(lowSpeed.color).toBe('#39d9ff');
    expect(lowSpeed.progressPercent).toBeCloseTo(99.67);
    expect(vehicleSpeed.color).toBe('#ffb22e');
    expect(vehicleSpeed.progressPercent).toBe(20);
    expect(fastSpeed.color).toBe('#ff75f6');
    expect(fastSpeed.progressPercent).toBe(37.5);
  });

  test('速度ゲージ進捗を0〜100%に収める', () => {
    expect(getSpeedMeterAppearance(0, '#123456').progressPercent).toBe(0);
    expect(getSpeedMeterAppearance(999, '#123456').progressPercent).toBe(100);
  });

  test('速度帯ごとの完全円速度で進捗を計算する', () => {
    expect(getSpeedMeterAppearance(15, '#123456').progressPercent).toBe(50);
    expect(getSpeedMeterAppearance(29.9, '#123456').progressPercent).toBeCloseTo(99.67);
    expect(getSpeedMeterAppearance(30, '#123456').progressPercent).toBe(20);
    expect(getSpeedMeterAppearance(100, '#123456').progressPercent).toBeCloseTo(66.67);
    expect(getSpeedMeterAppearance(150, '#123456').progressPercent).toBe(37.5);
    expect(getSpeedMeterAppearance(400, '#123456').progressPercent).toBe(100);
    expect(getSpeedMeterAppearance(500, '#123456').progressPercent).toBe(100);
  });

  test('連続円弧のdash値を0〜100%に丸めて計算する', () => {
    expect(getSpeedMeterArcStroke(0)).toEqual({
      strokeDasharray: SPEED_METER_ARC_CIRCUMFERENCE,
      strokeDashoffset: SPEED_METER_ARC_CIRCUMFERENCE,
    });
    expect(getSpeedMeterArcStroke(50).strokeDashoffset).toBeCloseTo(SPEED_METER_ARC_CIRCUMFERENCE / 2);
    expect(getSpeedMeterArcStroke(100).strokeDashoffset).toBe(0);
    expect(getSpeedMeterArcStroke(150).strokeDashoffset).toBe(0);
    expect(getSpeedMeterArcStroke(-20).strokeDashoffset).toBe(SPEED_METER_ARC_CIRCUMFERENCE);
  });

  test('連続円弧の外径を黒い背景リングに合わせる', () => {
    expect(SPEED_METER_ARC_RADIUS + SPEED_METER_ARC_STROKE_WIDTH / 2).toBeCloseTo(49.5);
  });
});
