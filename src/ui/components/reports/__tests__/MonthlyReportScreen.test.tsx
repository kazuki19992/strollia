import { Alert, Text } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('月次レポート画面 MonthlyReportScreen', () => {
  let renderer: { unmount: () => void; root: any } | null = null;

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
        <MonthlyReportScreen
          dailyLogs={[]}
          points={[]}
          achievements={[]}
          monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
          theme={lightTheme}
          onBackToMap={onBackToMap}
        />,
      );
    });

    const closeButton = renderer!.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'レポートを閉じる' && typeof node.props.onPress === 'function',
    )[0];
    act(() => closeButton.props.onPress());

    expect(onBackToMap).toHaveBeenCalledTimes(1);
  });

  it('共有ボタンでレポート画像を共有する', async () => {
    act(() => {
      renderer = ReactTestRenderer.create(
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
    });

    const shareButton = renderer!.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'レポートを共有' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => {
      await shareButton.props.onPress();
    });

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png' }));
    expect(captureRef).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshotContentContainer: true }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/monthly-report.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('共有シートが使えない場合は画像生成せず警告する', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen
          dailyLogs={[]}
          points={[]}
          achievements={[]}
          monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
          theme={lightTheme}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const shareButton = renderer!.root.findAll(
      (node: any) => node.props.accessibilityLabel === 'レポートを共有' && typeof node.props.onPress === 'function',
    )[0];
    await act(async () => {
      await shareButton.props.onPress();
    });

    expect(captureRef).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('共有できません', 'この環境では共有シートを利用できません。');
  });

  it('OS設定ではなくAppから渡されたテーマで表示色を決める', () => {
    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen
          dailyLogs={[]}
          points={[]}
          achievements={[]}
          monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
          theme={darkTheme}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const container = renderer!.root.findAll(
      (node: any) => Array.isArray(node.props.style) && node.props.style.some((style: any) => style?.backgroundColor === '#111111'),
    )[0];

    expect(container).toBeTruthy();
  });
});
