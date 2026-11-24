import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { AnnualReportCoordinate, AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { AnnualReportScreen } from '@/ui/components/annualReport/AnnualReportScreen';
import { distanceMeters } from '@/utils/distance';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('expo-blur', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { BlurView: View };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { __esModule: true, default: View, Marker: View, Polyline: View };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { __esModule: true, default: View, Defs: View, LinearGradient: View, RadialGradient: View, Rect: View, Stop: View };
});

/** 非表示半径100mの自宅。 */
const home: StayPlace = {
  id: 1,
  name: '自宅',
  iconHexcode: '1F3E0',
  latitude: 35,
  longitude: 139,
  privacyRadiusMeters: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** 自宅の近くを通る日と、遠くの日の2本のルート。 */
const yearRouteSegments: AnnualReportCoordinate[][] = [
  [
    { latitude: 35, longitude: 139 },
    { latitude: 35, longitude: 139.0005 },
    { latitude: 35, longitude: 139.01 },
    { latitude: 35, longitude: 139.02 },
    { latitude: 35, longitude: 139.03 },
  ],
  [
    { latitude: 36, longitude: 140 },
    { latitude: 36, longitude: 140.01 },
  ],
];

/** テスト用の年間レポート。すべてのページが出る内容にする。 */
function createPayload(overrides: Partial<AnnualReportPayloadV1> = {}): AnnualReportPayloadV1 {
  return {
    version: 1,
    year: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-15',
    activeDays: 3,
    activeDates: ['2026-01-02', '2026-05-05', '2026-08-14'],
    totalDistanceMeters: 6_420_000,
    monthlyDistanceMeters: [92, 70, 118, 140, 131, 98, 160, 241, 150, 176, 152, 114].map((km) => km * 1000),
    yearRouteSegments,
    farthestDay: {
      localDate: '2026-08-14',
      distanceMeters: 96_400,
      route: [
        { latitude: 35, longitude: 139, recordedAt: '2026-08-14T07:30:00+09:00' },
        { latitude: 35, longitude: 139.02, recordedAt: '2026-08-14T12:00:00+09:00' },
        { latitude: 35, longitude: 139.04, recordedAt: '2026-08-14T19:40:00+09:00' },
      ],
    },
    visitedPrefectures: ['東京都', '長野県'],
    newPrefectures: ['長野県'],
    newMunicipalityCount: 23,
    newCellCount: 1208,
    previousCellCount: 800,
    achievements: { count: 12, highlights: [] },
    spots: { count: 0, highlights: [] },
    ...overrides,
  };
}

/** 偽タイマーを進める(トランジションやフレーム待ちを流す)。 */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** 「次のページ」を指定回数押し、トランジションを終わらせる。 */
async function goForward(times: number): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await fireEvent.press(screen.getByLabelText('次のページ'));
    await advance(800);
  }
}

/** モックした Polyline(ホストの View)に渡っている座標をすべて集める。 */
function collectPolylineCoordinates(): AnnualReportCoordinate[] {
  // モックした地図要素の props 検証のため、ホスト要素を直接検索する
  return screen.container
    .queryAll((node) => Array.isArray((node.props as { coordinates?: unknown }).coordinates))
    .flatMap((node) => (node.props as { coordinates: AnnualReportCoordinate[] }).coordinates);
}

/** 共有を押してから、フレーム待ちと共有処理の完了まで流す。 */
async function pressAndFinish(element: Parameters<typeof fireEvent.press>[0]): Promise<void> {
  await fireEvent.press(element);
  // フレーム待ちは順に予約されるため、マイクロタスクを流しながら少しずつ進める
  for (let index = 0; index < 5; index += 1) {
    await advance(20);
  }
}

describe('年間レポートのストーリー画面 AnnualReportScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    (captureRef as jest.Mock).mockResolvedValue('file:///tmp/annual-report.png');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('ヘッダーにアプリ名と対象年を表示する', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[]} stayPlacesStatus="ready" onClose={jest.fn()} />);

    expect(screen.getByText('Strollia')).toBeTruthy();
    expect(screen.getByText('Report 2026')).toBeTruthy();
    expect(screen.getByText('集計期間 2026/1/1〜12/15')).toBeTruthy();
  });

  test('右側タップで次のページ、左側タップで前のページ', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[]} stayPlacesStatus="ready" onClose={jest.fn()} />);
    expect(screen.getByLabelText('1 / 10 ページ')).toBeTruthy();

    await goForward(1);
    expect(screen.getByLabelText('2 / 10 ページ')).toBeTruthy();
    expect(screen.getByText('記録した日数')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('前のページ'));
    await advance(800);
    expect(screen.getByLabelText('1 / 10 ページ')).toBeTruthy();
    expect(screen.getByText('あなたの1年をふりかえろう')).toBeTruthy();
  });

  test('閉じるボタンで onClose を呼ぶ', async () => {
    const onClose = jest.fn();
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[]} stayPlacesStatus="ready" onClose={onClose} />);

    await fireEvent.press(screen.getByLabelText('閉じる'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('0件のページは表示しない', async () => {
    const payload = createPayload({
      newPrefectures: [],
      newMunicipalityCount: 0,
      newCellCount: 0,
      achievements: { count: 0, highlights: [] },
      spots: { count: 0, highlights: [] },
    });
    await render(<AnnualReportScreen payload={payload} activeStayPlaces={[]} stayPlacesStatus="ready" onClose={jest.fn()} />);

    expect(screen.getByLabelText('1 / 7 ページ')).toBeTruthy();
    // 最遠日(6ページ目)の次はまとめになる
    await goForward(6);
    expect(screen.getByText('2026年のまとめ')).toBeTruthy();
    expect(screen.queryByText('新しいエリア')).toBeNull();
    expect(screen.queryByText('はじめての都道府県')).toBeNull();
  });

  test('地図ページで非表示半径にかかる場合は確認ダイアログを出し、キャンセルで共有しない', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[home]} stayPlacesStatus="ready" onClose={jest.fn()} />);
    await goForward(3);
    expect(screen.getByText('1年の移動マップ')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('このページを共有'));

    expect(screen.getByText('プライベートな滞在場所を隠しますか？')).toBeTruthy();
    expect(
      screen.getByText(
        'このページには「共有時に隠す」設定の滞在場所が含まれています。隠すと、その範囲内のルートは共有する画像に表示されません。',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('隠さずに共有')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('キャンセル'));
    await advance(1000);

    expect(captureRef).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  test('隠して共有ではプライバシー処理済みのルートでキャプチャする', async () => {
    let capturedCoordinates: AnnualReportCoordinate[] = [];
    (captureRef as jest.Mock).mockImplementation(async () => {
      capturedCoordinates = collectPolylineCoordinates();
      return 'file:///tmp/annual-report.png';
    });
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[home]} stayPlacesStatus="ready" onClose={jest.fn()} />);
    await goForward(3);
    await fireEvent.press(screen.getByLabelText('このページを共有'));

    await pressAndFinish(screen.getByLabelText('隠して共有'));

    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(capturedCoordinates.length).toBeGreaterThan(0);
    expect(capturedCoordinates.every((coordinate) => distanceMeters(coordinate, home) > 100)).toBe(true);
    // 共有後は元のルート表示へ戻る
    expect(collectPolylineCoordinates()).toContainEqual({ latitude: 35, longitude: 139 });
  });

  test('隠さずに共有では元のルートのままキャプチャする', async () => {
    let capturedCoordinates: AnnualReportCoordinate[] = [];
    (captureRef as jest.Mock).mockImplementation(async () => {
      capturedCoordinates = collectPolylineCoordinates();
      return 'file:///tmp/annual-report.png';
    });
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[home]} stayPlacesStatus="ready" onClose={jest.fn()} />);
    await goForward(3);
    await fireEvent.press(screen.getByLabelText('このページを共有'));

    await pressAndFinish(screen.getByLabelText('隠さずに共有'));

    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(capturedCoordinates).toContainEqual({ latitude: 35, longitude: 139 });
  });

  test('地図以外のページでは確認なしで共有する', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[home]} stayPlacesStatus="ready" onClose={jest.fn()} />);

    await pressAndFinish(screen.getByLabelText('このページを共有'));

    expect(screen.queryByText('プライベートな滞在場所を隠しますか？')).toBeNull();
    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png' }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/annual-report.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  test('地図ページでも非表示半径にかからなければ確認なしで共有する', async () => {
    const farAway: StayPlace = { ...home, latitude: 10, longitude: 10 };
    await render(
      <AnnualReportScreen payload={createPayload()} activeStayPlaces={[farAway]} stayPlacesStatus="ready" onClose={jest.fn()} />,
    );
    await goForward(3);

    await pressAndFinish(screen.getByLabelText('このページを共有'));

    expect(screen.queryByText('プライベートな滞在場所を隠しますか？')).toBeNull();
    expect(captureRef).toHaveBeenCalledTimes(1);
  });

  test('滞在場所の読み込みに失敗していたら地図ページの共有を開始しない', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={null} stayPlacesStatus="error" onClose={jest.fn()} />);
    await goForward(3);

    await fireEvent.press(screen.getByLabelText('このページを共有'));
    await advance(100);

    expect(Alert.alert).toHaveBeenCalledWith('共有できません', '滞在場所を読み込めないため、共有を準備できません。');
    expect(screen.queryByText('プライベートな滞在場所を隠しますか？')).toBeNull();
    expect(captureRef).not.toHaveBeenCalled();
  });

  test('比較対象が日本の周回のときは両端の地名を表示しない', async () => {
    await render(
      <AnnualReportScreen
        payload={createPayload({ totalDistanceMeters: 13_000_000 })}
        activeStayPlaces={[]}
        stayPlacesStatus="ready"
        onClose={jest.fn()}
      />,
    );
    await goForward(2);

    expect(screen.getByText('日本 1.1 周分')).toBeTruthy();
    expect(screen.queryByTestId('annual-report-distance-shuttle')).toBeNull();
  });

  test('比較対象が2地点間のときは両端の地名を表示する', async () => {
    await render(
      <AnnualReportScreen
        payload={createPayload({ totalDistanceMeters: 1_500_000 })}
        activeStayPlaces={[]}
        stayPlacesStatus="ready"
        onClose={jest.fn()}
      />,
    );
    await goForward(2);

    expect(screen.getByText('東京〜大阪 1.5 往復分')).toBeTruthy();
    expect(screen.getByText('東京')).toBeTruthy();
    expect(screen.getByText('大阪')).toBeTruthy();
  });

  test('月ごとのページは最多と最少の月だけ棒の上に距離を出す', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[]} stayPlacesStatus="ready" onClose={jest.fn()} />);
    await goForward(4);

    expect(screen.getByText('241km')).toBeTruthy();
    expect(screen.getByText('70km')).toBeTruthy();
    expect(screen.queryByText('92km')).toBeNull();
  });

  test('長押しで一時停止し、離すと再開する', async () => {
    await render(<AnnualReportScreen payload={createPayload()} activeStayPlaces={[]} stayPlacesStatus="ready" onClose={jest.fn()} />);
    const right = screen.getByLabelText('次のページ');

    await fireEvent(right, 'pressIn');
    await fireEvent(right, 'longPress');
    await advance(10_000);
    expect(screen.getByLabelText('1 / 10 ページ')).toBeTruthy();

    await fireEvent(right, 'pressOut');
    await advance(7_100);
    expect(screen.getByLabelText('2 / 10 ページ')).toBeTruthy();
  });
});
