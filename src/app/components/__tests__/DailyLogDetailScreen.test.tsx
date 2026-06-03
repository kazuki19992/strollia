import { Text } from 'react-native';

import { getLocationPointAdminAreaName } from '../../../features/achievements/adminAreaRepository';
import { getAchievementUnlocksByDate } from '../../../features/achievements/achievementRepository';
import { getVisitedCellsByIds } from '../../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../../features/logs/logRepository';
import { lightTheme } from '../../../theme/theme';
import { DailyLogDetailScreen } from '../DailyLogDetailScreen';
import { StepSlider } from '../StepSlider';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

jest.mock('../../../features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaName: jest.fn().mockResolvedValue({ locationPointId: 1, areaName: '船橋市' }),
}));

jest.mock('../../../features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn().mockResolvedValue([
    {
      id: 1,
      recordedAt: new Date(2026, 4, 31, 0, 0).toISOString(),
      localDate: '2026-05-31',
      latitude: 35.681236,
      longitude: 139.767125,
      altitude: null,
      speed: null,
      heading: null,
      accuracy: 10,
      altitudeAccuracy: null,
    },
    {
      id: 2,
      recordedAt: new Date(2026, 4, 31, 0, 10).toISOString(),
      localDate: '2026-05-31',
      latitude: 35.690921,
      longitude: 139.700258,
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
    { achievementId: 'distance-100', unlockedAt: '2026-05-31T09:00:00.000Z', unlockedLocalDate: '2026-05-31', progressValue: 100000 },
  ]),
}));

jest.mock('../../../features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => ({ id: 'distance-100', title: '100km移動した', trophyImage: { uri: 'badge.png' } })),
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

const styles = new Proxy({}, { get: (_target, prop) => prop });
const log = {
  localDate: '2026-05-31',
  pointCount: 2,
  startedAt: '2026-05-31T00:00:00.000Z',
  endedAt: '2026-05-31T00:10:00.000Z',
  distanceMeters: 146200,
  startLocationPointId: 1,
  endLocationPointId: 2,
};

describe('日別ログ詳細画面 DailyLogDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('共通ヘッダーと移動データ、獲得実績を表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} onBackToDailyLogs={jest.fn()} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['日ごとの記録', '5月31日', '2026年', '移動のデータ', '移動距離', '146.20km', '船橋市 ▶ 船橋市', 'おもいで', 'この日に獲得した実績', '共有']));
    expect(texts).not.toContain('開始');
    expect(texts).not.toContain('最新');
    expect(getLocationPointsByDate).toHaveBeenCalledWith('2026-05-31');
    expect(getVisitedCellsByIds).toHaveBeenCalledTimes(1);
    expect(getAchievementUnlocksByDate).toHaveBeenCalledWith('2026-05-31');
    expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(1);
    expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(2);
  });

  test('詳細画面の地図はスクロール可能なMapViewとして表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} onBackToDailyLogs={jest.fn()} />,
      );
    });

    const routeMap = renderer.root.findAll((node: any) => node.props.scrollEnabled === true && node.props.zoomEnabled === true)[0];

    expect(routeMap).toBeTruthy();
  });

  test('スライダーを動かすと選択時刻までの移動記録だけを地図へ渡す', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} onBackToDailyLogs={jest.fn()} />,
      );
    });

    expect(renderer.root.findAll((node: any) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2).length).toBeGreaterThan(0);

    await act(async () => {
      renderer.root.findByType(StepSlider).props.onValueChange(0);
    });

    expect(renderer.root.findAll((node: any) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2)).toHaveLength(0);
    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['0時', '24時']));
    expect(texts).not.toContain('移動地図を表示できません');
  });
});
