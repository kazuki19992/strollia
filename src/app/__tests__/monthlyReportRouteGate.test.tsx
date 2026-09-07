import { render, screen } from '@testing-library/react-native';
import MonthlyReportRoute from '@/app/monthly-report';

const activeStayPlaces = [
  {
    id: 1,
    name: '自宅',
    iconHexcode: '1F3E0',
    latitude: 35,
    longitude: 139,
    privacyRadiusMeters: 100,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
];

/**
 * useAppState が返す Plus 加入状態。各テストで書き換える。
 */
const mockState = {
  premiumAccessState: { isPlusActive: false },
  dailyLogs: [],
  monthlyReportPoints: [],
  achievementItems: [],
  monthlyAreaReport: null,
  activeStayPlaces,
  stayPlacesStatus: 'ready' as 'loading' | 'ready' | 'error',
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

let latestMonthlyReportScreenProps: Record<string, unknown> | null = null;

jest.mock('@/ui/components/reports/MonthlyReportScreen', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    MonthlyReportScreen: (props: Record<string, unknown>) => {
      latestMonthlyReportScreenProps = props;
      return <View testID="monthly-report-screen" />;
    },
  };
});

describe('月次レポートルートのPlusゲート (/monthly-report 直接遷移)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestMonthlyReportScreenProps = null;
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

  test('現在有効な滞在場所を月次共有画面へ渡す', () => {
    mockState.premiumAccessState = { isPlusActive: true };

    render(<MonthlyReportRoute />);

    expect(latestMonthlyReportScreenProps?.activeStayPlaces).toEqual(activeStayPlaces);
    expect(latestMonthlyReportScreenProps?.stayPlacesStatus).toBe('ready');
  });

  test('滞在場所の読込失敗状態も月次共有画面へ渡す', () => {
    mockState.premiumAccessState = { isPlusActive: true };
    (mockState as { activeStayPlaces: typeof activeStayPlaces | null }).activeStayPlaces = null;
    mockState.stayPlacesStatus = 'error';

    render(<MonthlyReportRoute />);

    expect(latestMonthlyReportScreenProps?.activeStayPlaces).toBeNull();
    expect(latestMonthlyReportScreenProps?.stayPlacesStatus).toBe('error');
  });
});
