import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import {
  useLocationRecordingSync,
  UseLocationRecordingSyncResult,
  UseLocationRecordingSyncOptions,
} from '@/ui/hooks/useLocationRecordingSync';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
  updateBackgroundLocationTaskOptionsIfNeeded,
} from '@/features/location/locationService';
import { getLocationPermissionState, hasRequiredLocationPermission } from '@/features/location/locationPermission';
import { getDailyLogs, getAllLocationPoints } from '@/features/logs/logRepository';
import { getMonthlyAreaReport } from '@/features/reports/monthlyAreaReport';
import { shouldStartRecordingAutomatically } from '@/ui/autoRecording';

jest.mock('@/features/location/locationService', () => ({
  isBackgroundLocationRecording: jest.fn().mockResolvedValue(false),
  startBackgroundLocationRecording: jest.fn().mockResolvedValue(undefined),
  stopBackgroundLocationRecording: jest.fn().mockResolvedValue(undefined),
  updateBackgroundLocationTaskOptionsIfNeeded: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/location/locationPermission', () => ({
  getLocationPermissionState: jest.fn().mockResolvedValue({
    foregroundGranted: true,
    backgroundGranted: true,
    canAskForeground: false,
    canAskBackground: false,
  }),
  hasRequiredLocationPermission: jest.fn().mockReturnValue(true),
  canRequestLocationPermissionInApp: jest.fn().mockReturnValue(false),
  isWhileInUseOnlyMode: jest.fn().mockReturnValue(false),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getDailyLogs: jest.fn().mockResolvedValue([]),
  getAllLocationPoints: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/reports/monthlyAreaReport', () => ({
  getMonthlyAreaReport: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/reports/monthlyReport', () => ({
  getPreviousReportMonth: jest.fn().mockReturnValue('2026-06'),
}));

jest.mock('@/ui/autoRecording', () => ({
  shouldStartRecordingAutomatically: jest.fn().mockReturnValue(false),
}));

/** テスト用の権限状態（バックグラウンド許可済み）。 */
const GRANTED_PERMISSION_STATE = {
  foregroundGranted: true,
  backgroundGranted: true,
  canAskForeground: false,
  canAskBackground: false,
};

/** テスト用の権限状態（前景のみ）。 */
const FOREGROUND_ONLY_PERMISSION_STATE = {
  foregroundGranted: true,
  backgroundGranted: false,
  canAskForeground: false,
  canAskBackground: true,
};

/**
 * HookProbe が渡すデフォルトのコールバックモック。
 * レンダーごとに jest.fn() を生成すると refreshData の依存配列が毎回変わり、
 * effect の再購読が繰り返されるため、モジュールレベルで参照を安定化する。
 */
const defaultIncrementVisitedGridRefreshVersion = jest.fn();
const defaultEvaluateAchievementsIfDialogIdle = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
const defaultRefreshAchievementState = jest.fn<Promise<void>, [boolean?, { signal?: AbortSignal }?]>().mockResolvedValue(undefined);

describe('GPS記録同期フック useLocationRecordingSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // AppState.currentState の初期値を安定化する。
    // useState(AppState.currentState) の評価をテスト環境でも安全にするために必要。
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
    // clearAllMocks で addEventListener が undefined になるのを防ぐ。
    // effect cleanup で subscription.remove() を呼ぶため、{ remove: jest.fn() } を返す必要がある。
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, _listener) => ({ remove: jest.fn() }));
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(false);
    (getLocationPermissionState as jest.Mock).mockResolvedValue(GRANTED_PERMISSION_STATE);
    (hasRequiredLocationPermission as jest.Mock).mockReturnValue(true);
    (getDailyLogs as jest.Mock).mockResolvedValue([]);
    (getAllLocationPoints as jest.Mock).mockResolvedValue([]);
    (getMonthlyAreaReport as jest.Mock).mockResolvedValue(null);
    (shouldStartRecordingAutomatically as jest.Mock).mockReturnValue(false);
    (updateBackgroundLocationTaskOptionsIfNeeded as jest.Mock).mockResolvedValue(undefined);
    (stopBackgroundLocationRecording as jest.Mock).mockResolvedValue(undefined);
    (startBackgroundLocationRecording as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // フックが起こした非同期処理(refreshDataの遊離Promise等)と、
    // Reactスケジューラに積まれた継続(setImmediate)をすべてact内で流し切る。
    // これを省くと teardown 後にスケジューラがレンダーを実行し、
    // 「import a file after the Jest environment has been torn down」で exit code 1 になる。
    // RTL の自動 cleanup (unmount) は afterEach の最後に走るため、
    // この afterEach 内のフラッシュは cleanup より前に実行される。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // unmount後に残ったスケジューラ継続も流し切ってから mock を復元する
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    jest.restoreAllMocks();
  });

  describe('初期状態', () => {
    it('初期 isRecording は false になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.isRecording).toBe(false);
    });

    it('初期 autoStartStatus は checking になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.autoStartStatus).toBe('checking');
    });

    it('初期 isLocationRecordingModeSynchronized は false になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.isLocationRecordingModeSynchronized).toBe(false);
    });

    it('初期 isWhileInUseToastVisible は false になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.isWhileInUseToastVisible).toBe(false);
    });

    it('初期 message は「起動後に自動でGPS記録を開始します。」になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.message).toBe('起動後に自動でGPS記録を開始します。');
    });

    it('初期 dailyLogs は空配列になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.dailyLogs).toEqual([]);
    });

    it('初期 points は空配列になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.points).toEqual([]);
    });

    it('初期 monthlyAreaReport は null になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      expect(result.current.monthlyAreaReport).toBeNull();
    });
  });

  describe('refreshData — DB・権限状態の再読み込み', () => {
    it('getDailyLogs・getAllLocationPoints・isBackgroundLocationRecording・getLocationPermissionState をまとめて呼ぶ', async () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.refreshData();
      });

      expect(getDailyLogs).toHaveBeenCalled();
      expect(getAllLocationPoints).toHaveBeenCalled();
      expect(isBackgroundLocationRecording).toHaveBeenCalled();
      expect(getLocationPermissionState).toHaveBeenCalled();
    });

    it('signal が abort 済みのとき state を更新せず返却値だけを返す', async () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      const controller = new AbortController();
      controller.abort();

      // abort 済み signal を渡して refreshData を呼んでもクラッシュしない
      let returnValue: Awaited<ReturnType<UseLocationRecordingSyncResult['refreshData']>> | undefined;
      await act(async () => {
        returnValue = await result.current.refreshData({ signal: controller.signal });
      });

      // 返却値には読み込んだデータが入る（state は更新しないが値は返す）
      expect(returnValue).toHaveProperty('logs');
      expect(returnValue).toHaveProperty('permissions');
    });

    it('refreshData が完了すると incrementVisitedGridRefreshVersion が呼ばれる', async () => {
      const mockIncrement = jest.fn();
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: mockIncrement,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockIncrement).toHaveBeenCalled();
    });
  });

  describe('startRecording — GPS記録開始', () => {
    it('startBackgroundLocationRecording を呼ぶ', async () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.startRecording('manual');
      });

      expect(startBackgroundLocationRecording).toHaveBeenCalled();
    });

    it('reason が auto のとき message に「GPS記録を自動開始しました。」が設定される', async () => {
      (hasRequiredLocationPermission as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.startRecording('auto');
      });

      expect(result.current.message).toBe('GPS記録を自動開始しました。');
    });

    it('reason が manual のとき message に「バックグラウンドGPS記録を開始しました。」が設定される', async () => {
      (hasRequiredLocationPermission as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.startRecording('manual');
      });

      expect(result.current.message).toBe('バックグラウンドGPS記録を開始しました。');
    });

    it('startBackgroundLocationRecording が失敗したとき autoStartStatus が failed になる', async () => {
      (startBackgroundLocationRecording as jest.Mock).mockRejectedValue(new Error('GPS start failed'));
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.startRecording('manual');
      });

      expect(result.current.autoStartStatus).toBe('failed');
    });
  });

  describe('synchronizeLocationRecordingMode — 記録モード同期', () => {
    it('バックグラウンド権限ありのとき updateBackgroundLocationTaskOptionsIfNeeded を呼ぶ', async () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.synchronizeLocationRecordingMode({ permissions: GRANTED_PERMISSION_STATE, recording: false });
      });

      expect(updateBackgroundLocationTaskOptionsIfNeeded).toHaveBeenCalled();
    });

    it('バックグラウンド権限なしのとき stopBackgroundLocationRecording を呼ぶ', async () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.synchronizeLocationRecordingMode({ permissions: FOREGROUND_ONLY_PERMISSION_STATE, recording: false });
      });

      expect(stopBackgroundLocationRecording).toHaveBeenCalled();
    });

    it('バックグラウンド権限なしで同期完了後 isLocationRecordingModeSynchronized が true になる', async () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      await act(async () => {
        await result.current.synchronizeLocationRecordingMode({ permissions: FOREGROUND_ONLY_PERMISSION_STATE, recording: false });
      });

      expect(result.current.isLocationRecordingModeSynchronized).toBe(true);
    });
  });

  describe('setMessage — メッセージ更新', () => {
    it('setMessage を呼ぶと message が更新される', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      act(() => {
        result.current.setMessage('テストメッセージ');
      });

      expect(result.current.message).toBe('テストメッセージ');
    });
  });

  describe('setIsWhileInUseToastVisible — トースト表示更新', () => {
    it('setIsWhileInUseToastVisible(true) を呼ぶと isWhileInUseToastVisible が true になる', () => {
      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      act(() => {
        result.current.setIsWhileInUseToastVisible(true);
      });

      expect(result.current.isWhileInUseToastVisible).toBe(true);
    });
  });

  describe('AppState 復帰時の再同期', () => {
    it('AppState が active になったとき getDailyLogs が再度呼ばれる', async () => {
      // beforeEach で addEventListener はモック済み。ここではリスナーを捕捉するために上書きする。
      const listeners: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
        listeners.push(listener as (state: string) => void);
        return { remove: jest.fn() };
      });

      renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      const initialCallCount = (getDailyLogs as jest.Mock).mock.calls.length;

      await act(async () => {
        listeners.forEach((l) => l('active'));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect((getDailyLogs as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('先行チェーンの実行中に後発チェーンが開始された場合、先行の古い結果が state を上書きしない', async () => {
      // abort により先行チェーンの refreshData は setState をスキップするため、
      // 先行の古い dailyLogs が後発チェーンの新しい dailyLogs を上書きしないことを確認する。
      const listeners: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
        listeners.push(listener as (state: string) => void);
        return { remove: jest.fn() };
      });

      const staleLogs = [{ localDate: '2026-01-01', distanceMeters: 100 }];
      const freshLogs = [{ localDate: '2026-01-02', distanceMeters: 200 }];

      // 先行チェーンの getDailyLogs を意図的に遅延させ、後発チェーン開始後に古い値で解決させる
      let resolveFirst: (value: unknown[]) => void = () => undefined;
      (getDailyLogs as jest.Mock)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockResolvedValue(freshLogs);

      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      // 先行チェーン開始（getDailyLogs は pending のまま止まる）
      act(() => {
        listeners.forEach((l) => l('active'));
      });

      // 後発チェーン開始 → 先行チェーンの signal が abort される
      await act(async () => {
        listeners.forEach((l) => l('active'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // 後発チェーンの新しい結果が state に反映されている
      expect(result.current.dailyLogs).toEqual(freshLogs);

      // 先行チェーンを「古い値」で遅延解決しても、abort 済みのため state を上書きしない
      await act(async () => {
        resolveFirst(staleLogs);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.dailyLogs).toEqual(freshLogs);
    });

    it('AppState復帰の同期チェーン実行中に interval が発火してもスキップされ、同期が最終的に完了する', async () => {
      // interval が同期チェーンを abort すると isLocationRecordingModeSynchronized が
      // false のまま取り残され、前景限定記録の保存が再開しないため、
      // 同期チェーン実行中の interval 発火はスキップされることを確認する。
      const listeners: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
        listeners.push(listener as (state: string) => void);
        return { remove: jest.fn() };
      });

      // setInterval を乗っ取り、コールバックを手動発火できるようにする
      const intervalCallbacks: (() => void)[] = [];
      jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void) => {
        intervalCallbacks.push(callback);
        return 0 as unknown as NodeJS.Timeout;
      }) as typeof setInterval);
      jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);

      // 同期チェーンの getDailyLogs を pending にして「同期チェーン実行中」の状態を作る
      let resolveSync: (value: unknown[]) => void = () => undefined;
      (getDailyLogs as jest.Mock)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSync = resolve;
            }),
        )
        .mockResolvedValue([]);

      const { result } = renderHook(() =>
        useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
          evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
          refreshAchievementState: defaultRefreshAchievementState,
        }),
      );

      // 同期チェーン開始（getDailyLogs pending で実行中のまま）
      act(() => {
        listeners.forEach((l) => l('active'));
      });
      expect(getDailyLogs).toHaveBeenCalledTimes(1);

      // 同期チェーン実行中に interval を発火 → スキップされ refreshData は呼ばれない
      act(() => {
        intervalCallbacks.forEach((callback) => callback());
      });
      expect(getDailyLogs).toHaveBeenCalledTimes(1);

      // 同期チェーンを解決すると、中断されずに最後まで完了して同期フラグが true へ戻る
      await act(async () => {
        resolveSync([]);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(result.current.isLocationRecordingModeSynchronized).toBe(true);

      // 同期完了後の interval 発火は通常どおり実行される
      await act(async () => {
        intervalCallbacks.forEach((callback) => callback());
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect((getDailyLogs as jest.Mock).mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('refreshDataAndEvaluateAchievementsIfDialogIdle', () => {
    // フックに渡すコールバックは毎レンダーで再生成されると deps 変化が無限ループになるため、
    // ref 経由で安定化した useCallback を使う。
    // ここで生成した mock を各テストで入れ替えることで検証する。
    const evaluateRef = { current: jest.fn<Promise<boolean>, []>().mockResolvedValue(false) };
    const refreshRef = { current: jest.fn<Promise<void>, [boolean?, { signal?: AbortSignal }?]>().mockResolvedValue(undefined) };
    const incrementRef = { current: jest.fn() };

    it('refreshData と evaluateAchievementsIfDialogIdle を順番に呼ぶ', async () => {
      evaluateRef.current = jest.fn().mockResolvedValue(false);
      refreshRef.current = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => {
        const stableEvaluate = React.useCallback(() => evaluateRef.current(), []);
        const stableRefresh = React.useCallback((...args: Parameters<typeof refreshRef.current>) => refreshRef.current(...args), []);
        const stableIncrement = React.useCallback(() => incrementRef.current(), []);
        return useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: stableIncrement,
          evaluateAchievementsIfDialogIdle: stableEvaluate,
          refreshAchievementState: stableRefresh,
        });
      });

      await act(async () => {
        await result.current.refreshDataAndEvaluateAchievementsIfDialogIdle();
      });

      expect(getDailyLogs).toHaveBeenCalled();
      expect(evaluateRef.current).toHaveBeenCalled();
    });

    it('evaluateAchievementsIfDialogIdle が true を返したとき refreshAchievementState を呼ぶ', async () => {
      evaluateRef.current = jest.fn().mockResolvedValue(true);
      refreshRef.current = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => {
        const stableEvaluate = React.useCallback(() => evaluateRef.current(), []);
        const stableRefresh = React.useCallback((...args: Parameters<typeof refreshRef.current>) => refreshRef.current(...args), []);
        const stableIncrement = React.useCallback(() => incrementRef.current(), []);
        return useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: stableIncrement,
          evaluateAchievementsIfDialogIdle: stableEvaluate,
          refreshAchievementState: stableRefresh,
        });
      });

      await act(async () => {
        await result.current.refreshDataAndEvaluateAchievementsIfDialogIdle();
      });

      expect(refreshRef.current).toHaveBeenCalledWith(true);
    });

    it('evaluateAchievementsIfDialogIdle が false を返したとき refreshAchievementState を呼ばない', async () => {
      evaluateRef.current = jest.fn().mockResolvedValue(false);
      refreshRef.current = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => {
        const stableEvaluate = React.useCallback(() => evaluateRef.current(), []);
        const stableRefresh = React.useCallback((...args: Parameters<typeof refreshRef.current>) => refreshRef.current(...args), []);
        const stableIncrement = React.useCallback(() => incrementRef.current(), []);
        return useLocationRecordingSync({
          isReady: true,
          incrementVisitedGridRefreshVersion: stableIncrement,
          evaluateAchievementsIfDialogIdle: stableEvaluate,
          refreshAchievementState: stableRefresh,
        });
      });

      await act(async () => {
        await result.current.refreshDataAndEvaluateAchievementsIfDialogIdle();
      });

      expect(refreshRef.current).not.toHaveBeenCalled();
    });
  });
});
