import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
const mockDailyLogCard = jest.fn(() => null);

jest.mock('../DailyLogCard', () => ({
  DailyLogCard: (props: unknown) => mockDailyLogCard(props),
}));

import { DailyLogsScreen } from '../DailyLogsScreen';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = {
  dailyContainer: {},
  dailyHeader: {},
  backButton: {},
  backButtonText: {},
  dailyTitle: {},
  headerSpacer: {},
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
      renderer = ReactTestRenderer.create(<DailyLogsScreen dailyLogs={[]} styles={styles as never} theme={lightTheme} onBackToMap={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('日別ログはまだありません');
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
