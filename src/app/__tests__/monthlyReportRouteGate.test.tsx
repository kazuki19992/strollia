import { render, screen } from '@testing-library/react-native';
import MonthlyReportRoute from '@/app/monthly-report';

/**
 * useAppState が返す Plus 加入状態。各テストで書き換える。
 */
const mockState = {
  premiumAccessState: { isPlusActive: false },
  dailyLogs: [],
  monthlyReportPoints: [],
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

describe('月次レポートルートのPlusゲート (/monthly-report 直接遷移)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Plus未加入のときは MonthlyReportScreen を描画せず地図(/)へリダイレクトする', () => {
    mockState.premiumAccessState = { isPlusActive: false };

    render(<MonthlyReportRoute />);

    expect(screen.queryAllByTestId('monthly-report-screen')).toHaveLength(0);
    expect(screen.getByLabelText('redirect:/')).toBeTruthy();
  });

  test('Plus加入済みのときは MonthlyReportScreen を描画しリダイレクトしない', () => {
    mockState.premiumAccessState = { isPlusActive: true };

    render(<MonthlyReportRoute />);

    expect(screen.getAllByTestId('monthly-report-screen').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('redirect')).toHaveLength(0);
  });
});
