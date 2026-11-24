import { fireEvent, render, screen } from '@testing-library/react-native';

import AnnualReportRoute from '@/app/annual-report';

/** useAppState が返す状態。各テストで書き換える。 */
const mockState = {
  annualReport: null as { year: number } | null,
  activeStayPlaces: [] as unknown[] | null,
  stayPlacesStatus: 'ready' as 'loading' | 'ready' | 'error',
  closeAnnualReport: jest.fn(),
  notifyAnnualReportLeft: jest.fn(),
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

let latestScreenProps: Record<string, unknown> | null = null;

jest.mock('@/ui/components/annualReport/AnnualReportScreen', () => {
  const { Pressable, View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    AnnualReportScreen: (props: { onClose: () => void } & Record<string, unknown>) => {
      latestScreenProps = props;
      return (
        <View testID="annual-report-screen">
          <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={props.onClose} />
        </View>
      );
    },
  };
});

describe('年間レポートルート (/annual-report)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestScreenProps = null;
    mockState.annualReport = null;
    mockState.activeStayPlaces = [];
    mockState.stayPlacesStatus = 'ready';
  });

  test('annualReport が null なら地図へリダイレクトする', async () => {
    await render(<AnnualReportRoute />);

    expect(screen.getByLabelText('redirect:/')).toBeTruthy();
    expect(screen.queryAllByTestId('annual-report-screen')).toHaveLength(0);
  });

  test('レポートと滞在場所の状態をストーリー画面へ渡す', async () => {
    mockState.annualReport = { year: 2026 };
    mockState.activeStayPlaces = null;
    mockState.stayPlacesStatus = 'error';

    await render(<AnnualReportRoute />);

    expect(latestScreenProps?.payload).toEqual({ year: 2026 });
    expect(latestScreenProps?.activeStayPlaces).toBeNull();
    expect(latestScreenProps?.stayPlacesStatus).toBe('error');
  });

  test('閉じるボタンで閉じたときは closeAnnualReport だけを1回呼ぶ', async () => {
    mockState.annualReport = { year: 2026 };
    const { unmount } = await render(<AnnualReportRoute />);

    await fireEvent.press(screen.getByLabelText('閉じる'));
    await fireEvent.press(screen.getByLabelText('閉じる'));
    await unmount();

    expect(mockState.closeAnnualReport).toHaveBeenCalledTimes(1);
    expect(mockState.notifyAnnualReportLeft).not.toHaveBeenCalled();
  });

  test('閉じるボタン以外(戻る操作・スワイプ)で画面を離れたときは後処理を1回だけ呼ぶ', async () => {
    mockState.annualReport = { year: 2026 };
    const { unmount } = await render(<AnnualReportRoute />);

    await unmount();

    expect(mockState.notifyAnnualReportLeft).toHaveBeenCalledTimes(1);
    expect(mockState.closeAnnualReport).not.toHaveBeenCalled();
  });

  test('表示中にレポートが無くなってリダイレクトしたときも後処理を呼ぶ', async () => {
    mockState.annualReport = { year: 2026 };
    const { rerender } = await render(<AnnualReportRoute />);

    mockState.annualReport = null;
    await rerender(<AnnualReportRoute />);

    expect(screen.getByLabelText('redirect:/')).toBeTruthy();
    expect(mockState.notifyAnnualReportLeft).toHaveBeenCalledTimes(1);
  });

  test('最初からリダイレクトするときは後処理を呼ばない', async () => {
    const { unmount } = await render(<AnnualReportRoute />);

    await unmount();

    expect(mockState.notifyAnnualReportLeft).not.toHaveBeenCalled();
  });
});
