import { SafeAreaView, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
const mockDailyLogCard = jest.fn((_props: unknown) => null);

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

jest.mock('../DailyLogCard', () => ({
  DailyLogCard: (props: unknown) => mockDailyLogCard(props),
}));

import { DailyLogsScreen } from '../DailyLogsScreen';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = {
  appScreen: { backgroundColor: 'app-background' },
  appHeader: {},
  appHeaderBackButton: {},
  appHeaderBackButtonText: {},
  appHeaderTitle: {},
  screenList: {},
  dailyEmptyCard: {},
  emptyTitle: {},
  emptyText: {},
  dailyList: {},
};

describe('日別ログ画面 DailyLogsScreen', () => {
  beforeEach(() => {
    mockDailyLogCard.mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('日別ログがない場合は空状態を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <DailyLogsScreen
          dailyLogs={[]}
          styles={styles as never}
          theme={lightTheme}
          isPlusActive={false}
          onPresentPremiumPaywall={jest.fn()}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('日別ログはまだありません');
  });

  test('設定画面と同じ背景と共通ヘッダーで表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <DailyLogsScreen
          dailyLogs={[]}
          styles={styles as never}
          theme={lightTheme}
          isPlusActive={false}
          onPresentPremiumPaywall={jest.fn()}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const container = renderer.root.findByType(SafeAreaView);
    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const backButton = renderer.root.findByProps({ accessibilityLabel: '地図へ戻る' });

    expect(container.props.style).toBe(styles.appScreen);
    expect(texts).toContain('日ごとの記録');
    expect(backButton.props.style).toBe(styles.appHeaderBackButton);
  });

  test('Plus状態とPaywall導線を日別カードへ渡す', () => {
    const onPresentPremiumPaywall = jest.fn();

    act(() => {
      ReactTestRenderer.create(
        <DailyLogsScreen
          dailyLogs={[
            {
              localDate: '2026-05-31',
              pointCount: 1,
              startedAt: '2026-05-31T00:00:00.000Z',
              endedAt: '2026-05-31T00:01:00.000Z',
              distanceMeters: 12,
            },
          ]}
          styles={styles as never}
          theme={lightTheme}
          isPlusActive={true}
          onPresentPremiumPaywall={onPresentPremiumPaywall}
          onBackToMap={jest.fn()}
        />,
      );
    });

    expect(mockDailyLogCard).toHaveBeenCalledWith(
      expect.objectContaining({
        isPlusActive: true,
        onPresentPremiumPaywall,
      }),
    );
  });
});
