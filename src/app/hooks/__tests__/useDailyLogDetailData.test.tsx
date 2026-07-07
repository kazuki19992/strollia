import { useEffect } from 'react';

import { useDailyLogDetailData, DailyLogDetailDataState } from '@/app/hooks/useDailyLogDetailData';

jest.mock('@/features/logs/dailyLogDetailService', () => ({
  fetchDailyLogDetailData: jest.fn(),
}));

jest.mock('@/app/dailyRouteTimeline', () => ({
  ...jest.requireActual('@/app/dailyRouteTimeline'),
  getTodayLocalDate: jest.fn().mockReturnValue('2026-06-04'),
  getCurrentMinutesOfDay: jest.fn().mockReturnValue(750),
}));

import { fetchDailyLogDetailData } from '@/features/logs/dailyLogDetailService';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const baseLog = {
  localDate: '2026-05-31',
  pointCount: 2,
  startedAt: '2026-05-31T00:00:00.000Z',
  endedAt: '2026-05-31T00:10:00.000Z',
  distanceMeters: 1000,
  startLocationPointId: 1,
  endLocationPointId: 2,
};

const mockPoints = [
  {
    id: 1,
    recordedAt: '2026-05-31T00:00:00.000Z',
    localDate: '2026-05-31',
    latitude: 35.681,
    longitude: 139.767,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
];

const mockReport = {
  localDate: '2026-05-31',
  visitedAreaCount: 1,
  newAreaCount: 0,
  pointCount: 1,
  unlockedAchievements: [],
};

/** フックの戻り値をテストに渡すプローブコンポーネント。 */
function HookProbe({ log, onState }: { log: typeof baseLog; onState: (state: DailyLogDetailDataState) => void }) {
  const state = useDailyLogDetailData(log);

  useEffect(() => {
    onState(state);
  });

  return null;
}

describe('useDailyLogDetailData フック', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('初期状態', () => {
    it('読み込み中フラグが true で始まる', () => {
      (fetchDailyLogDetailData as jest.Mock).mockResolvedValue({
        points: [],
        report: mockReport,
        routeEndpointsLabel: '-- ▶ --',
      });

      const states: DailyLogDetailDataState[] = [];
      act(() => {
        ReactTestRenderer.create(<HookProbe log={baseLog} onState={(s) => states.push(s)} />);
      });

      // 最初のレンダリング（非同期が完了する前）の状態
      expect(states[0].isLoadingDetail).toBe(true);
    });

    it('dailyPoints の初期値は空配列', () => {
      (fetchDailyLogDetailData as jest.Mock).mockResolvedValue({
        points: [],
        report: mockReport,
        routeEndpointsLabel: '-- ▶ --',
      });

      const states: DailyLogDetailDataState[] = [];
      act(() => {
        ReactTestRenderer.create(<HookProbe log={baseLog} onState={(s) => states.push(s)} />);
      });

      expect(states[0].dailyPoints).toEqual([]);
    });
  });

  describe('正常ロード', () => {
    it('fetchDailyLogDetailData が成功すると dailyPoints と report と routeEndpointsLabel が更新される', async () => {
      (fetchDailyLogDetailData as jest.Mock).mockResolvedValue({
        points: mockPoints,
        report: mockReport,
        routeEndpointsLabel: '船橋市 ▶ 船橋市',
      });

      const states: DailyLogDetailDataState[] = [];
      await act(async () => {
        ReactTestRenderer.create(<HookProbe log={baseLog} onState={(s) => states.push(s)} />);
        await Promise.resolve();
      });

      const lastState = states[states.length - 1];
      expect(lastState.isLoadingDetail).toBe(false);
      expect(lastState.dailyPoints).toEqual(mockPoints);
      expect(lastState.dailyDetailReport).toEqual(mockReport);
      expect(lastState.routeEndpointsLabel).toBe('船橋市 ▶ 船橋市');
    });

    it('fetchDailyLogDetailData を log.localDate で呼ぶ', async () => {
      (fetchDailyLogDetailData as jest.Mock).mockResolvedValue({
        points: [],
        report: mockReport,
        routeEndpointsLabel: '-- ▶ --',
      });

      await act(async () => {
        ReactTestRenderer.create(<HookProbe log={baseLog} onState={() => undefined} />);
        await Promise.resolve();
      });

      expect(fetchDailyLogDetailData).toHaveBeenCalledWith('2026-05-31');
    });
  });

  describe('エラー時', () => {
    it('fetchDailyLogDetailData がエラーを投げると dailyPoints が空配列にリセットされる', async () => {
      (fetchDailyLogDetailData as jest.Mock).mockRejectedValue(new Error('DB エラー'));

      const states: DailyLogDetailDataState[] = [];
      await act(async () => {
        ReactTestRenderer.create(<HookProbe log={baseLog} onState={(s) => states.push(s)} />);
        await Promise.resolve();
      });

      const lastState = states[states.length - 1];
      expect(lastState.isLoadingDetail).toBe(false);
      expect(lastState.dailyPoints).toEqual([]);
      expect(lastState.dailyDetailReport).toBeNull();
    });
  });

  describe('log が変わった場合の再読み込み', () => {
    it('log が更新されると fetchDailyLogDetailData を再度呼ぶ', async () => {
      (fetchDailyLogDetailData as jest.Mock).mockResolvedValue({
        points: [],
        report: mockReport,
        routeEndpointsLabel: '-- ▶ --',
      });

      let renderer: any;
      await act(async () => {
        renderer = ReactTestRenderer.create(<HookProbe log={baseLog} onState={() => undefined} />);
        await Promise.resolve();
      });

      expect(fetchDailyLogDetailData).toHaveBeenCalledTimes(1);

      await act(async () => {
        renderer.update(<HookProbe log={{ ...baseLog, distanceMeters: 2000 }} onState={() => undefined} />);
        await Promise.resolve();
      });

      expect(fetchDailyLogDetailData).toHaveBeenCalledTimes(2);
    });
  });
});
