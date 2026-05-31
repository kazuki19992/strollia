import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { DailyLogCard } from '../DailyLogCard';

jest.mock('../../../features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn().mockResolvedValue([
    {
      id: 1,
      recordedAt: '2026-05-31T00:00:00.000Z',
      localDate: '2026-05-31',
      latitude: 35.681236,
      longitude: 139.767125,
      altitude: null,
      speed: null,
      heading: null,
      accuracy: 10,
      altitudeAccuracy: null,
    },
  ]),
}));

jest.mock('../../../features/location/visitedCellRepository', () => ({
  getVisitedCellsByIds: jest.fn().mockResolvedValue([
    {
      cellId: '100:155582:425804',
      cellSizeMeters: 100,
      x: 155582,
      y: 425804,
      firstVisitedAt: '2026-05-31T00:00:00.000Z',
      lastVisitedAt: '2026-05-31T00:00:00.000Z',
      visitCount: 1,
    },
  ]),
}));

jest.mock('../../../features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest.fn().mockResolvedValue([
    { achievementId: 'distance-100', unlockedAt: '2026-05-31T09:00:00.000Z', progressValue: 100000 },
  ]),
}));

jest.mock('../../../features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => ({ id: 'distance-100', title: '100km移動した' })),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
  };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: () => ({}) });
const log = {
  localDate: '2026-05-31',
  pointCount: 1,
  startedAt: '2026-05-31T00:00:00.000Z',
  endedAt: '2026-05-31T00:01:00.000Z',
  distanceMeters: 12,
};

describe('日別ログカード DailyLogCard', () => {
  it('Plus無効時は詳細レポートをロック表示してPaywallを開ける', async () => {
    const onPresentPremiumPaywall = jest.fn();
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogCard log={log} styles={styles as never} theme={lightTheme} isPlusActive={false} onPresentPremiumPaywall={onPresentPremiumPaywall} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('Plusで詳細レポートを表示');

    const button = renderer.root.findByProps({ accessibilityLabel: 'Strollia Plusで日別詳細レポートを見る' });
    act(() => button.props.onPress());

    expect(onPresentPremiumPaywall).toHaveBeenCalledTimes(1);
  });

  it('Plus有効時は日別詳細レポートを表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogCard log={log} styles={styles as never} theme={lightTheme} isPlusActive={true} onPresentPremiumPaywall={jest.fn()} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('訪問エリア');
    expect(texts).toContain('新規エリア');
    expect(texts).toContain('解除した実績');
  });
});
