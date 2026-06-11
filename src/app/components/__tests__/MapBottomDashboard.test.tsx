import { Animated, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { createStyles } from '../../appStyles';
import {
  getSpeedMeterAppearance,
  getSpeedMeterArcStroke,
  MapBottomDashboard,
  METER_CLUSTER_BACKGROUND_PATH,
  SPEED_METER_ARC_CIRCUMFERENCE,
  SPEED_METER_ARC_RADIUS,
  SPEED_METER_ARC_STROKE_WIDTH,
} from '../MapBottomDashboard';

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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;
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
    onRecenterOnUserLocation: jest.fn(),
    onOpenDailyLogs: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenMonthlyReport: jest.fn(),
    onOpenSettings: jest.fn(),
    onToggleMapType: jest.fn(),
    onUpdateShowPhotosOnMap: jest.fn().mockResolvedValue(undefined),
  };
}

describe('マップ下部ダッシュボード', () => {
  test('速度計と距離帯の背景を単一パスで描く', () => {
    expect(METER_CLUSTER_BACKGROUND_PATH).toContain('H104');
    expect(METER_CLUSTER_BACKGROUND_PATH.match(/rgba/)).toBeNull();
  });

  test('速度計と長い距離表示をまとめて描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapBottomDashboard {...createProps()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('SPEED');
    expect(texts).toContain('ODO');
    expect(texts).toContain('9876543');
    expect(texts).toContain('TODAY');
    expect(texts).toContain('9876');
    expect(texts).toContain('船橋市');
  });

  test('速度と距離の指定桁数と市名6文字プラス市を固定文字サイズで表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MapBottomDashboard
          {...createProps()}
          currentAreaLabel={{ primary: 'つくばみらい市', secondary: null }}
          currentSpeedKmh={999}
          distance={98_765_432_100}
          todayDistance={9_876_540}
        />,
      );
    });

    const textNodes = renderer.root.findAllByType(Text).filter((node: any) => typeof node.props.children === 'string');
    const texts = textNodes.map((node: any) => node.props.children);
    expect(texts).toContain('999');
    expect(texts).toContain('98765432');
    expect(texts).toContain('10');
    expect(texts).toContain('9876');
    expect(texts).toContain('54');
    expect(texts).toContain('つくばみらい市');
    expect(textNodes.every((node: any) => node.props.allowFontScaling === false)).toBe(true);
  });

  test('距離帯は市名6文字プラス市の7文字表示用の幅を確保する', () => {
    expect(styles.dashboardPlaceMetric.minWidth).toBeGreaterThanOrEqual(76);
    expect(styles.dashboardOdometerMetric.minWidth).toBeGreaterThanOrEqual(92);
    expect(styles.dashboardTodayMetric.minWidth).toBeGreaterThanOrEqual(56);
  });

  test('マップボタンから表示設定パネルを前面に開く', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapBottomDashboard {...createProps()} />);
    });

    const mapButton = renderer.root.find((node: any) => node.props.accessibilityLabel === 'マップの表示');
    act(() => mapButton.props.onPress());

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('標準マップ');
    expect(texts).toContain('航空写真');
    expect(texts).toContain('マップ上に写真を表示');
  });

  test('速度リングを連続円弧で描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MapBottomDashboard {...createProps()} currentSpeedKmh={15} />);
    });

    const arc = renderer.root.find((node: any) => node.props.testID === 'speed-meter-progress-arc');
    expect(arc.props.stroke).toBe('#39d9ff');
    expect(arc.props.strokeDashoffset).toBeCloseTo(SPEED_METER_ARC_CIRCUMFERENCE / 2);
  });
});

describe('マップ下部ダッシュボードの速度帯', () => {
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
