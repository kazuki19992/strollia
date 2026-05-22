import { Animated, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { createStyles } from '../../appStyles';
import { getSpeedMeterAppearance, MapBottomDashboard, METER_CLUSTER_BACKGROUND_PATH } from '../MapBottomDashboard';

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
});

describe('マップ下部ダッシュボードの速度帯', () => {
  test('速度帯を30km/hと150km/hで切り替える', () => {
    expect(getSpeedMeterAppearance(29.9, '#123456').color).toBe('#39d9ff');
    expect(getSpeedMeterAppearance(30, '#123456').color).toBe('#ffb22e');
    expect(getSpeedMeterAppearance(150, '#123456').color).toBe('#ff75f6');
  });
});
