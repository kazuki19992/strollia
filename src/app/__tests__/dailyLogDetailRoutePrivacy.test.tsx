import { render, screen } from '@testing-library/react-native';

import DailyLogDetailRoute from '@/app/daily-logs/[date]';

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

const mockState = {
  dailyLogs: [
    {
      localDate: '2026-08-19',
      pointCount: 2,
      startedAt: null,
      endedAt: null,
      distanceMeters: 100,
      startLocationPointId: null,
      endLocationPointId: null,
    },
  ],
  styles: {},
  theme: { name: 'light', colors: { primary: '#000' } },
  premiumAccessState: { isPlusActive: true },
  activeStayPlaces,
  openPremiumPaywall: jest.fn(),
};

let latestDailyLogDetailScreenProps: Record<string, unknown> | null = null;

jest.mock('expo-router', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    useLocalSearchParams: () => ({ date: '2026-08-19' }),
    useRouter: () => ({ back: jest.fn() }),
    Redirect: () => <View />,
  };
});

jest.mock('@/ui/state/AppStateProvider', () => ({
  useAppState: () => mockState,
}));

jest.mock('@/ui/components/DailyLogDetailScreen', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    DailyLogDetailScreen: (props: Record<string, unknown>) => {
      latestDailyLogDetailScreenProps = props;
      return <View testID="daily-log-detail-screen" />;
    },
  };
});

describe('日別記録詳細ルートの共有プライバシー配線', () => {
  beforeEach(() => {
    latestDailyLogDetailScreenProps = null;
  });

  test('現在有効な滞在場所を日別共有画面へ渡す', () => {
    render(<DailyLogDetailRoute />);

    expect(screen.getByTestId('daily-log-detail-screen')).toBeTruthy();
    expect(latestDailyLogDetailScreenProps?.activeStayPlaces).toEqual(activeStayPlaces);
  });
});
