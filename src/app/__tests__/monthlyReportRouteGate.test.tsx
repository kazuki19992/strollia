import MonthlyReportRoute from '@/app/monthly-report';

/**
 * useAppState が返す Plus 加入状態。各テストで書き換える。
 */
const mockState = {
  premiumAccessState: { isPlusActive: false },
  dailyLogs: [],
  points: [],
  achievementItems: [],
  monthlyAreaReport: null,
  theme: { name: 'light', colors: { primary: '#000' } },
  openMap: jest.fn(),
};

// expo-router の Redirect を検出可能なスタブへ置き換える
jest.mock('expo-router', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    Redirect: ({ href }: { href: string }) => <View testID="redirect" accessibilityLabel={`redirect:${href}`} />,
  };
});

jest.mock('@/ui/state/AppStateProvider', () => ({
  useAppState: () => mockState,
}));

jest.mock('@/ui/components/reports/MonthlyReportScreen', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    MonthlyReportScreen: () => <View testID="monthly-report-screen" />,
  };
});

const ReactTestRenderer = require('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports
const { act } = ReactTestRenderer;

describe('月次レポートルートのPlusゲート (/monthly-report 直接遷移)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Plus未加入のときは MonthlyReportScreen を描画せず地図(/)へリダイレクトする', async () => {
    mockState.premiumAccessState = { isPlusActive: false };

    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    await act(async () => {
      renderer = ReactTestRenderer.create(<MonthlyReportRoute />);
    });

    expect(renderer!.root.findAllByProps({ testID: 'monthly-report-screen' })).toHaveLength(0);
    expect(renderer!.root.findByProps({ accessibilityLabel: 'redirect:/' })).toBeTruthy();
  });

  test('Plus加入済みのときは MonthlyReportScreen を描画しリダイレクトしない', async () => {
    mockState.premiumAccessState = { isPlusActive: true };

    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    await act(async () => {
      renderer = ReactTestRenderer.create(<MonthlyReportRoute />);
    });

    expect(renderer!.root.findAllByProps({ testID: 'monthly-report-screen' }).length).toBeGreaterThan(0);
    expect(renderer!.root.findAllByProps({ testID: 'redirect' })).toHaveLength(0);
  });
});
