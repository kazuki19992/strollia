import { SafeAreaView, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { DailyLogsScreen } from '../DailyLogsScreen';

jest.mock('../../../features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaNames: jest.fn().mockResolvedValue(new Map([
    [10, '船橋市'],
    [20, '船橋市'],
    [30, '千代田区'],
    [40, '渋谷区'],
  ])),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('日別ログ画面 DailyLogsScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('日別ログがない場合は空状態を表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogsScreen
          dailyLogs={[]}
          styles={styles as never}
          theme={lightTheme}
          onBackToMap={jest.fn()}
          onOpenDailyLogDetail={jest.fn()}
        />,
      );
      await Promise.resolve();
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('日別ログはまだありません');
  });

  test('設定画面と同じ背景と共通ヘッダーで表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogsScreen
          dailyLogs={[]}
          styles={styles as never}
          theme={lightTheme}
          onBackToMap={jest.fn()}
          onOpenDailyLogDetail={jest.fn()}
        />,
      );
      await Promise.resolve();
    });

    const container = renderer.root.findByType(SafeAreaView);
    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const backButton = renderer.root.findByProps({ accessibilityLabel: '地図へ戻る' });

    expect(container.props.style).toBe('appScreen');
    expect(texts).toContain('日ごとの記録');
    expect(backButton.props.style).toBe('appHeaderBackButton');
  });

  test('月見出しごとのリスト行と開始終了地点を表示し、行タップで詳細を開く', async () => {
    const onOpenDailyLogDetail = jest.fn();
    const log = {
      localDate: '2026-05-31',
      pointCount: 1,
      startedAt: '2026-05-31T00:00:00.000Z',
      endedAt: '2026-05-31T00:01:00.000Z',
      distanceMeters: 146200,
      startLocationPointId: 10,
      endLocationPointId: 20,
    };
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogsScreen
          dailyLogs={[
            {
              localDate: '2026-06-03',
              pointCount: 1,
              startedAt: '2026-06-03T00:00:00.000Z',
              endedAt: '2026-06-03T00:01:00.000Z',
              distanceMeters: 300,
              startLocationPointId: 30,
              endLocationPointId: 40,
            },
            log,
          ]}
          styles={styles as never}
          theme={lightTheme}
          onBackToMap={jest.fn()}
          onOpenDailyLogDetail={onOpenDailyLogDetail}
        />,
      );
      await Promise.resolve();
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['2026年6月', '6月3日（水）', '千代田区 ▶ 渋谷区', '0.30km', '2026年5月', '5月31日（日）', '船橋市 ▶ 船橋市', '146.20km']));

    const button = renderer.root.findByProps({ accessibilityLabel: '5月31日（日）の記録を開く' });
    act(() => {
      button.props.onPress();
    });

    expect(onOpenDailyLogDetail).toHaveBeenCalledWith(log);
  });
});
