import React from 'react';
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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

/**
 * テスト中に生成した renderer の追跡リスト。
 * フックは isReady: true で10秒intervalを起動するため、テスト終了時に
 * 必ず unmount しないと open handle が残り Jest が exit code 1 になる。
 */
const activeRenderers: Array<{ unmount: () => void }> = [];

/** renderer を生成して追跡する。afterEach で必ず unmount される。 */
function createTrackedRenderer(element: React.ReactElement) {
  const renderer = ReactTestRenderer.create(element);
  activeRenderers.push(renderer);
  return renderer;
}

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

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UseLocationRecordingSyncResult) => void;
  /** フックに渡すオプション。 */
  options?: Partial<UseLocationRecordingSyncOptions>;
};

/**
 * HookProbe が渡すデフォルトのコールバックモック。
 * レンダーごとに jest.fn() を生成すると refreshData の依存配列が毎回変わり、
 * effect の再購読が繰り返されるため、モジュールレベルで参照を安定化する。
 */
const defaultIncrementVisitedGridRefreshVersion = jest.fn();
const defaultEvaluateAchievementsIfDialogIdle = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
const defaultRefreshAchievementState = jest.fn<Promise<void>, [boolean?, { signal?: AbortSignal }?]>().mockResolvedValue(undefined);

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ onResult, options }: HookProbeProps) {
  const result = useLocationRecordingSync({
    isReady: true,
    incrementVisitedGridRefreshVersion: defaultIncrementVisitedGridRefreshVersion,
    evaluateAchievementsIfDialogIdle: defaultEvaluateAchievementsIfDialogIdle,
    refreshAchievementState: defaultRefreshAchievementState,
    ...options,
  });
  onResult(result);
  return null;
}

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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // 10秒intervalやAppState購読を確実に停止する
    await act(async () => {
      activeRenderers.forEach((renderer) => renderer.unmount());
    });
    activeRenderers.length = 0;
    // unmount後に残ったスケジューラ継続も流し切ってから mock を復元する
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    jest.restoreAllMocks();
  });

  describe('初期状態', () => {
    it('初期 isRecording は false になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isRecording).toBe(false);
    });

    it('初期 autoStartStatus は checking になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.autoStartStatus).toBe('checking');
    });

    it('初期 isLocationRecordingModeSynchronized は false になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isLocationRecordingModeSynchronized).toBe(false);
    });

    it('初期 isWhileInUseToastVisible は false になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isWhileInUseToastVisible).toBe(false);
    });

    it('初期 message は「起動後に自動でGPS記録を開始します。」になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.message).toBe('起動後に自動でGPS記録を開始します。');
    });

    it('初期 dailyLogs は空配列になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.dailyLogs).toEqual([]);
    });

    it('初期 points は空配列になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.points).toEqual([]);
    });

    it('初期 monthlyAreaReport は null になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.monthlyAreaReport).toBeNull();
    });
  });

  describe('refreshData — DB・権限状態の再読み込み', () => {
    it('getDailyLogs・getAllLocationPoints・isBackgroundLocationRecording・getLocationPermissionState をまとめて呼ぶ', async () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshData();
      });

      expect(getDailyLogs).toHaveBeenCalled();
      expect(getAllLocationPoints).toHaveBeenCalled();
      expect(isBackgroundLocationRecording).toHaveBeenCalled();
      expect(getLocationPermissionState).toHaveBeenCalled();
    });

    it('signal が abort 済みのとき state を更新せず返却値だけを返す', async () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      const controller = new AbortController();
      controller.abort();

      // abort 済み signal を渡して refreshData を呼んでもクラッシュしない
      let returnValue: Awaited<ReturnType<UseLocationRecordingSyncResult['refreshData']>> | undefined;
      await act(async () => {
        returnValue = await result!.refreshData({ signal: controller.signal });
      });

      // 返却値には読み込んだデータが入る（state は更新しないが値は返す）
      expect(returnValue).toHaveProperty('logs');
      expect(returnValue).toHaveProperty('permissions');
    });

    it('refreshData が完了すると incrementVisitedGridRefreshVersion が呼ばれる', async () => {
      const mockIncrement = jest.fn();
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} options={{ incrementVisitedGridRefreshVersion: mockIncrement }} />);
      });

      await act(async () => {
        await result!.refreshData();
      });

      expect(mockIncrement).toHaveBeenCalled();
    });
  });

  describe('startRecording — GPS記録開始', () => {
    it('startBackgroundLocationRecording を呼ぶ', async () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.startRecording('manual');
      });

      expect(startBackgroundLocationRecording).toHaveBeenCalled();
    });

    it('reason が auto のとき message に「GPS記録を自動開始しました。」が設定される', async () => {
      (hasRequiredLocationPermission as jest.Mock).mockReturnValue(true);
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.startRecording('auto');
      });

      expect(result!.message).toBe('GPS記録を自動開始しました。');
    });

    it('reason が manual のとき message に「バックグラウンドGPS記録を開始しました。」が設定される', async () => {
      (hasRequiredLocationPermission as jest.Mock).mockReturnValue(true);
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.startRecording('manual');
      });

      expect(result!.message).toBe('バックグラウンドGPS記録を開始しました。');
    });

    it('startBackgroundLocationRecording が失敗したとき autoStartStatus が failed になる', async () => {
      (startBackgroundLocationRecording as jest.Mock).mockRejectedValue(new Error('GPS start failed'));
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.startRecording('manual');
      });

      expect(result!.autoStartStatus).toBe('failed');
    });
  });

  describe('synchronizeLocationRecordingMode — 記録モード同期', () => {
    it('バックグラウンド権限ありのとき updateBackgroundLocationTaskOptionsIfNeeded を呼ぶ', async () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.synchronizeLocationRecordingMode({ permissions: GRANTED_PERMISSION_STATE, recording: false });
      });

      expect(updateBackgroundLocationTaskOptionsIfNeeded).toHaveBeenCalled();
    });

    it('バックグラウンド権限なしのとき stopBackgroundLocationRecording を呼ぶ', async () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.synchronizeLocationRecordingMode({ permissions: FOREGROUND_ONLY_PERMISSION_STATE, recording: false });
      });

      expect(stopBackgroundLocationRecording).toHaveBeenCalled();
    });

    it('バックグラウンド権限なしで同期完了後 isLocationRecordingModeSynchronized が true になる', async () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.synchronizeLocationRecordingMode({ permissions: FOREGROUND_ONLY_PERMISSION_STATE, recording: false });
      });

      expect(result!.isLocationRecordingModeSynchronized).toBe(true);
    });
  });

  describe('setMessage — メッセージ更新', () => {
    it('setMessage を呼ぶと message が更新される', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.setMessage('テストメッセージ');
      });

      expect(result!.message).toBe('テストメッセージ');
    });
  });

  describe('setIsWhileInUseToastVisible — トースト表示更新', () => {
    it('setIsWhileInUseToastVisible(true) を呼ぶと isWhileInUseToastVisible が true になる', () => {
      let result: UseLocationRecordingSyncResult | undefined;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.setIsWhileInUseToastVisible(true);
      });

      expect(result!.isWhileInUseToastVisible).toBe(true);
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

      act(() => {
        createTrackedRenderer(<HookProbe onResult={() => undefined} />);
      });

      const initialCallCount = (getDailyLogs as jest.Mock).mock.calls.length;

      await act(async () => {
        listeners.forEach((l) => l('active'));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect((getDailyLogs as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('先行チェーンの実行中に後発チェーンが開始された場合、先行の signal が abort されて後発だけが state を更新する', async () => {
      // abort されると refreshData の signal.aborted が true になり setState をスキップするため、
      // 先行チェーンの古い結果が後発チェーンの結果を上書きしないことを確認する。
      const listeners: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
        listeners.push(listener as (state: string) => void);
        return { remove: jest.fn() };
      });

      // 先行チェーンの getDailyLogs を意図的に遅延させ、後発チェーン開始前に pending 状態にする。
      let resolveFirst: () => void = () => undefined;
      const firstCallBlocker = new Promise<void>((res) => {
        resolveFirst = res;
      });

      // 先行チェーン: getDailyLogs が pending の間に signal が abort されるかを記録する。
      let signalPassedToFirstCall: AbortSignal | undefined;
      (getDailyLogs as jest.Mock)
        .mockImplementationOnce(async () => {
          // 先行チェーン: blockerが解除されるまで待機（この間に後発チェーンが start される）
          await firstCallBlocker;
          return [];
        })
        .mockResolvedValue([]);

      // refreshData は getDailyLogs/getAllLocationPoints を Promise.all で並列実行するため
      // signal を直接 getDailyLogs に渡さない。代わりに isBackgroundLocationRecording の
      // モック実装で「先行チェーンが getDailyLogs pending 中に後発が来た時点で signal が
      // abort されているか」を間接的に確認する。
      (isBackgroundLocationRecording as jest.Mock).mockImplementationOnce(async () => {
        // 先行チェーンの 1 回目呼び出し: blockerで止まっている getDailyLogs と並列。
        // signal はここではまだ abort されていない（後発はまだ来ていない）。
        return false;
      });

      void signalPassedToFirstCall;

      act(() => {
        createTrackedRenderer(<HookProbe onResult={() => undefined} />);
      });

      // 先行チェーン開始
      act(() => {
        listeners.forEach((l) => l('active'));
      });

      // getDailyLogs が1回呼ばれたことを確認（先行チェーンが started, pending 中）
      expect(getDailyLogs).toHaveBeenCalledTimes(1);

      // 後発チェーン開始（先行の getDailyLogs がまだ pending の状態で）
      act(() => {
        listeners.forEach((l) => l('active'));
      });

      // 後発チェーンも getDailyLogs を呼ぶ（後発チェーンは正常に実行される）
      expect(getDailyLogs).toHaveBeenCalledTimes(2);

      // 先行チェーンを解決してクリーンアップ
      resolveFirst();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // 後発チェーンが完了した後も getDailyLogs は計 2 回のまま（先行は abort により 2 度実行しない）
      expect(getDailyLogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshDataAndEvaluateAchievementsIfDialogIdle', () => {
    // フックに渡すコールバックは毎レンダーで再生成されると deps 変化が無限ループになるため、
    // ref 経由で安定化した HookProbeStable を使う。
    // ここで生成した mock を各テストで入れ替えることで検証する。
    const evaluateRef = { current: jest.fn<Promise<boolean>, []>().mockResolvedValue(false) };
    const refreshRef = { current: jest.fn<Promise<void>, [boolean?, { signal?: AbortSignal }?]>().mockResolvedValue(undefined) };
    const incrementRef = { current: jest.fn() };

    function HookProbeStable({ onResult }: { onResult: (r: UseLocationRecordingSyncResult) => void }) {
      const stableEvaluate = React.useCallback(() => evaluateRef.current(), []);
      const stableRefresh = React.useCallback((...args: Parameters<typeof refreshRef.current>) => refreshRef.current(...args), []);
      const stableIncrement = React.useCallback(() => incrementRef.current(), []);
      const r = useLocationRecordingSync({
        isReady: true,
        incrementVisitedGridRefreshVersion: stableIncrement,
        evaluateAchievementsIfDialogIdle: stableEvaluate,
        refreshAchievementState: stableRefresh,
      });
      onResult(r);
      return null;
    }

    it('refreshData と evaluateAchievementsIfDialogIdle を順番に呼ぶ', async () => {
      evaluateRef.current = jest.fn().mockResolvedValue(false);
      refreshRef.current = jest.fn().mockResolvedValue(undefined);

      let result: UseLocationRecordingSyncResult | undefined;
      act(() => {
        createTrackedRenderer(<HookProbeStable onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshDataAndEvaluateAchievementsIfDialogIdle();
      });

      expect(getDailyLogs).toHaveBeenCalled();
      expect(evaluateRef.current).toHaveBeenCalled();
    });

    it('evaluateAchievementsIfDialogIdle が true を返したとき refreshAchievementState を呼ぶ', async () => {
      evaluateRef.current = jest.fn().mockResolvedValue(true);
      refreshRef.current = jest.fn().mockResolvedValue(undefined);

      let result: UseLocationRecordingSyncResult | undefined;
      act(() => {
        createTrackedRenderer(<HookProbeStable onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshDataAndEvaluateAchievementsIfDialogIdle();
      });

      expect(refreshRef.current).toHaveBeenCalledWith(true);
    });

    it('evaluateAchievementsIfDialogIdle が false を返したとき refreshAchievementState を呼ばない', async () => {
      evaluateRef.current = jest.fn().mockResolvedValue(false);
      refreshRef.current = jest.fn().mockResolvedValue(undefined);

      let result: UseLocationRecordingSyncResult | undefined;
      act(() => {
        createTrackedRenderer(<HookProbeStable onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.refreshDataAndEvaluateAchievementsIfDialogIdle();
      });

      expect(refreshRef.current).not.toHaveBeenCalled();
    });
  });
});
