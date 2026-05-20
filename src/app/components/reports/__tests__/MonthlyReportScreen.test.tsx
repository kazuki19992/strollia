import { Alert, Text } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { lightTheme } from '../../../../theme/theme';
import { createStyles } from '../../../appStyles';
import { MonthlyReportScreen } from '../MonthlyReportScreen';

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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('月次レポート画面 MonthlyReportScreen', () => {
  let renderer: { unmount: () => void; root: any } | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    (captureRef as jest.Mock).mockResolvedValue('file:///tmp/monthly-report.png');
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('スクロール型の月次レポートを表示する', () => {
    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen
          dailyLogs={[{ localDate: '2026-05-01', pointCount: 2, startedAt: null, endedAt: null, distanceMeters: 1234 }]}
          points={[]}
          achievements={[]}
          monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
          styles={createStyles(lightTheme)}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const texts = renderer!.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('すとろりあ');
    expect(texts).toContain('SCROLL');
    expect(texts).toContain('移動距離');
    expect(texts).toContain('月間移動距離');
    expect(texts).toContain('移動マップ');
    expect(texts).toContain('月間取得した実績');
  });

  it('閉じるボタンで地図へ戻る', () => {
    const onBackToMap = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen dailyLogs={[]} points={[]} achievements={[]} monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }} styles={createStyles(lightTheme)} onBackToMap={onBackToMap} />,
      );
    });

    const closeButton = renderer!.root.findAll((node: any) => node.props.accessibilityLabel === 'レポートを閉じる' && typeof node.props.onPress === 'function')[0];
    act(() => closeButton.props.onPress());

    expect(onBackToMap).toHaveBeenCalledTimes(1);
  });

  it('共有ボタンでレポート画像を共有する', async () => {
    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen
          dailyLogs={[{ localDate: '2026-05-01', pointCount: 2, startedAt: null, endedAt: null, distanceMeters: 1234 }]}
          points={[]}
          achievements={[]}
          monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
          styles={createStyles(lightTheme)}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const shareButton = renderer!.root.findAll((node: any) => node.props.accessibilityLabel === 'レポートを共有' && typeof node.props.onPress === 'function')[0];
    await act(async () => {
      await shareButton.props.onPress();
    });

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png' }));
    expect(captureRef).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshotContentContainer: true }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/monthly-report.png', expect.objectContaining({ mimeType: 'image/png' }));
  });
});
