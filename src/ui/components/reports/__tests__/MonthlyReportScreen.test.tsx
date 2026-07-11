import { Alert, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { MonthlyReportScreen } from '@/ui/components/reports/MonthlyReportScreen';
import { darkTheme, lightTheme } from '@/theme/theme';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Polyline: View };
});

describe('月次レポート画面 MonthlyReportScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    (captureRef as jest.Mock).mockResolvedValue('file:///tmp/monthly-report.png');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('スクロール型の月次レポートを表示する', () => {
    render(
      <MonthlyReportScreen
        dailyLogs={[
          {
            localDate: '2026-05-01',
            pointCount: 2,
            startedAt: null,
            endedAt: null,
            distanceMeters: 1234,
            startLocationPointId: null,
            endLocationPointId: null,
          },
        ]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    expect(screen.getAllByText('すとろりあ').length).toBeGreaterThan(0);
    expect(screen.getByText('SCROLL')).toBeTruthy();
    expect(screen.getByText('移動距離')).toBeTruthy();
    expect(screen.getByText('月間移動距離')).toBeTruthy();
    expect(screen.getByText('移動マップ')).toBeTruthy();
    expect(screen.getByText('月間取得した実績')).toBeTruthy();
  });

  it('閉じるボタンで地図へ戻る', () => {
    const onBackToMap = jest.fn();

    render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={onBackToMap}
      />,
    );

    fireEvent.press(screen.getByLabelText('レポートを閉じる'));

    expect(onBackToMap).toHaveBeenCalledTimes(1);
  });

  it('共有ボタンでレポート画像を共有する', async () => {
    render(
      <MonthlyReportScreen
        dailyLogs={[
          {
            localDate: '2026-05-01',
            pointCount: 2,
            startedAt: null,
            endedAt: null,
            distanceMeters: 1234,
            startLocationPointId: null,
            endLocationPointId: null,
          },
        ]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('レポートを共有'));
    });

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png' }));
    expect(captureRef).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshotContentContainer: true }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/monthly-report.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('共有シートが使えない場合は画像生成せず警告する', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('レポートを共有'));
    });

    expect(captureRef).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('共有できません', 'この環境では共有シートを利用できません。');
  });

  it('OS設定ではなくAppから渡されたテーマで表示色を決める', () => {
    render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={darkTheme}
        onBackToMap={jest.fn()}
      />,
    );

    // UNSAFE_getAllByType(View) でViewに絞ってから style.backgroundColor で対象コンテナを特定する
    const container = screen
      .UNSAFE_getAllByType(View)
      .find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.some((style: unknown) => (style as Record<string, unknown>)?.backgroundColor === '#111111'),
      );

    expect(container).toBeTruthy();
  });
});
