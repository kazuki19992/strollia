import { Alert } from 'react-native';
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

/**
 * 押下ハンドラが返す Promise の完了を待たずに要素を押下し、ハンドラ完了を表すPromiseを返す。
 * RNTL v14 の fireEvent はハンドラの戻り値(共有処理のPromise)の完了まで待つため、共有準備中の状態を
 * 検証したいテストではハンドラ完了前に制御を戻す必要がある。返した finished はテスト内で必ず await する。
 */
async function startPressWithoutWaitingHandler(element: Parameters<typeof fireEvent.press>[0]): Promise<{ finished: Promise<unknown> }> {
  let finished: Promise<unknown> = Promise.resolve();
  await act(async () => {
    finished = fireEvent.press(element);
    await Promise.resolve();
  });
  return { finished };
}

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

  it('スクロール型の月次レポートを表示する', async () => {
    await render(
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
        activeStayPlaces={[]}
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

  it('閉じるボタンで地図へ戻る', async () => {
    const onBackToMap = jest.fn();

    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={onBackToMap}
      />,
    );

    await fireEvent.press(screen.getByLabelText('レポートを閉じる'));

    expect(onBackToMap).toHaveBeenCalledTimes(1);
  });

  it('共有ボタンでレポート画像を共有する', async () => {
    await render(
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
        activeStayPlaces={[]}
        onBackToMap={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('レポートを共有'));
    });

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png' }));
    expect(captureRef).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshotContentContainer: true }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/monthly-report.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('共有準備中はレポート生成中ダイアログを表示し、完了後に閉じる', async () => {
    let resolveSharingAvailability: ((available: boolean) => void) | undefined;
    (Sharing.isAvailableAsync as jest.Mock).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSharingAvailability = resolve;
      }),
    );

    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        activeStayPlaces={[]}
        onBackToMap={jest.fn()}
      />,
    );

    const { finished } = await startPressWithoutWaitingHandler(screen.getByLabelText('レポートを共有'));

    expect(screen.getByText('レポートを生成しています…')).toBeTruthy();
    expect(screen.getByText('少しお待ちください。')).toBeTruthy();

    await act(async () => {
      resolveSharingAvailability?.(true);
    });
    await finished;

    await act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.queryByText('レポートを生成しています…')).toBeNull();
  });

  it('共有準備中に連続で押しても共有処理を1回だけ開始する', async () => {
    let resolveSharingAvailability: ((available: boolean) => void) | undefined;
    (Sharing.isAvailableAsync as jest.Mock).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveSharingAvailability = resolve;
      }),
    );

    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        activeStayPlaces={[]}
        onBackToMap={jest.fn()}
      />,
    );

    // RNTL v14 では押下ごとに描画が反映されるため、2回目の押下は共有準備中の状態に対して行われる。
    const shareButton = screen.getByLabelText('レポートを共有');
    const first = await startPressWithoutWaitingHandler(shareButton);
    const second = await startPressWithoutWaitingHandler(shareButton);
    const finished = Promise.all([first.finished, second.finished]);

    expect(Sharing.isAvailableAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSharingAvailability?.(true);
    });
    await finished;

    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  });

  it('共有シートが使えない場合は画像生成せず警告する', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        activeStayPlaces={[]}
        onBackToMap={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('レポートを共有'));
    });

    expect(captureRef).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('共有できません', 'この環境では共有シートを利用できません。');
  });

  it('OS設定ではなくAppから渡されたテーマで表示色を決める', async () => {
    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={darkTheme}
        onBackToMap={jest.fn()}
      />,
    );

    // View ホスト要素に絞ってから style.backgroundColor で対象コンテナを特定する
    const container = screen.container
      .queryAll((node) => node.type === 'View')
      .find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.some((style: unknown) => (style as Record<string, unknown>)?.backgroundColor === '#111111'),
      );

    expect(container).toBeTruthy();
  });

  it('共有する月次マップは非表示範囲で分割したPolylineだけを描く', async () => {
    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[
          {
            id: 1,
            recordedAt: '2026-05-01T00:00:00.000Z',
            localDate: '2026-05-01',
            latitude: 35.002,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
          {
            id: 2,
            recordedAt: '2026-05-01T00:01:00.000Z',
            localDate: '2026-05-01',
            latitude: 35.003,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
          {
            id: 3,
            recordedAt: '2026-05-01T00:02:00.000Z',
            localDate: '2026-05-01',
            latitude: 35,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
          {
            id: 4,
            recordedAt: '2026-05-01T00:03:00.000Z',
            localDate: '2026-05-01',
            latitude: 35.004,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
          {
            id: 5,
            recordedAt: '2026-05-01T00:04:00.000Z',
            localDate: '2026-05-01',
            latitude: 35.005,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
        ]}
        activeStayPlaces={[
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
        ]}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    // View としてモックしたPolylineのホスト要素を strokeWidth で検索し、座標列を重複排除して区間数を検証する。
    const renderedSegments = new Set(
      screen.container.queryAll((node) => node.props.strokeWidth === 5).map((node) => JSON.stringify(node.props.coordinates)),
    );
    expect(renderedSegments).toEqual(
      new Set([
        JSON.stringify([
          { latitude: 35.002, longitude: 139 },
          { latitude: 35.003, longitude: 139 },
        ]),
        JSON.stringify([
          { latitude: 35.004, longitude: 139 },
          { latitude: 35.005, longitude: 139 },
        ]),
      ]),
    );
  });

  it('滞在場所が未解決なら生ルートを描画せずレポート共有も無効にする', async () => {
    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[
          {
            id: 1,
            recordedAt: '2026-05-01T00:00:00.000Z',
            localDate: '2026-05-01',
            latitude: 35,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
          {
            id: 2,
            recordedAt: '2026-05-01T00:01:00.000Z',
            localDate: '2026-05-01',
            latitude: 35.01,
            longitude: 139,
            altitude: null,
            speed: null,
            heading: null,
            accuracy: null,
            altitudeAccuracy: null,
          },
        ]}
        activeStayPlaces={null}
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    expect(screen.container.queryAll((node) => node.props.strokeWidth === 5)).toHaveLength(0);
    expect(screen.getByLabelText('レポートを共有')).toBeDisabled();
  });

  it('滞在場所の読込失敗時は共有を無効化して安全なエラー状態を表示する', async () => {
    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        activeStayPlaces={null}
        stayPlacesStatus="error"
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    expect(screen.getByText('滞在場所を読み込めないため、共有を準備できません。')).toBeTruthy();
    expect(screen.getByLabelText('レポートを共有')).toBeDisabled();
  });

  it('許可リスト外の非表示半径が1件でもあれば共有を無効化する', async () => {
    await render(
      <MonthlyReportScreen
        dailyLogs={[]}
        points={[]}
        activeStayPlaces={[
          {
            id: 1,
            name: '自宅',
            iconHexcode: '1F3E0',
            latitude: 35,
            longitude: 139,
            privacyRadiusMeters: 999,
            createdAt: '2026-08-19T00:00:00.000Z',
            updatedAt: '2026-08-19T00:00:00.000Z',
          },
        ]}
        stayPlacesStatus="ready"
        achievements={[]}
        monthlyAreaReport={{ prefectureRanking: [], topMunicipalityName: null }}
        theme={lightTheme}
        onBackToMap={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('レポートを共有')).toBeDisabled();
  });
});
