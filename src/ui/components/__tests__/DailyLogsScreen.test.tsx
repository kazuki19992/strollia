import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { DailyLogsScreen } from '@/ui/components/DailyLogsScreen';

jest.mock('@/features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaNames: jest.fn().mockResolvedValue(
    new Map([
      [10, '船橋市'],
      [20, '船橋市'],
      [30, '千代田区'],
      [40, '渋谷区'],
    ]),
  ),
}));

// dailyLogsService が calculateTotalDistanceMeters 経由で logRepository を import するため、
// 実DBへ到達しないようモック化する(このテストでは総距離計算自体は使わない)。
jest.mock('@/features/logs/logRepository', () => ({
  getLocationPointsByDates: jest.fn().mockResolvedValue([]),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('日別ログ画面 DailyLogsScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('日別ログがない場合は空状態を表示する', async () => {
    render(
      <DailyLogsScreen
        dailyLogs={[]}
        styles={styles as never}
        theme={lightTheme}
        onBackToMap={jest.fn()}
        onOpenDailyLogDetail={jest.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('日別ログはまだありません')).toBeTruthy();
  });

  test('設定画面と同じ背景と共通ヘッダーで表示する', async () => {
    render(
      <DailyLogsScreen
        dailyLogs={[]}
        styles={styles as never}
        theme={lightTheme}
        onBackToMap={jest.fn()}
        onOpenDailyLogDetail={jest.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    // SafeAreaView のスタイル確認
    // RTL では UNSAFE_getByType を使って SafeAreaView を取得する
    const container = screen.UNSAFE_getByType(require('react-native').SafeAreaView);
    const backButton = screen.getByLabelText('地図へ戻る');

    expect(container.props.style).toBe('appScreen');
    expect(screen.getByText('日ごとの記録')).toBeTruthy();
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

    render(
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('2026年6月')).toBeTruthy();
    expect(screen.getByText('6月3日（水）')).toBeTruthy();
    expect(screen.getByText('千代田区 ▶ 渋谷区')).toBeTruthy();
    expect(screen.getByText('0.30km')).toBeTruthy();
    expect(screen.getByText('2026年5月')).toBeTruthy();
    expect(screen.getByText('5月31日（日）')).toBeTruthy();
    expect(screen.getByText('船橋市 ▶ 船橋市')).toBeTruthy();
    expect(screen.getByText('146.20km')).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByLabelText('5月31日（日）の記録を開く'));
    });

    expect(onOpenDailyLogDetail).toHaveBeenCalledWith(log);
  });
});
