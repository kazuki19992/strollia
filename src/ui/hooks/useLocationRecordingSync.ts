import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';

import {
  canRequestLocationPermissionInApp,
  getLocationPermissionState,
  hasRequiredLocationPermission,
  LocationPermissionState,
} from '@/features/location/locationPermission';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
  updateBackgroundLocationTaskOptionsIfNeeded,
} from '@/features/location/locationService';
import { calculateTotalDistanceMeters } from '@/features/logs/dailyLogsService';
import { getDailyLogs, getLocationPointsBounds, LocationPointsBounds } from '@/features/logs/logRepository';
import { getMonthlyAreaReport, MonthlyAreaReport } from '@/features/reports/monthlyAreaReport';
import { getPreviousReportMonth } from '@/features/reports/monthlyReport';
import type { DailyLogSummary } from '@/types/gps';
import { shouldStartRecordingAutomatically } from '@/ui/autoRecording';
import type { AutoStartStatus } from '@/ui/appTypes';

/** `useLocationRecordingSync` フックの引数。 */
export type UseLocationRecordingSyncOptions = {
  /**
   * アプリ初期化が完了しているかどうか。
   * true になるまで定期更新 effect を開始しない（App.tsx の既存挙動を維持）。
   */
  isReady: boolean;
  /**
   * visited cell の再描画バージョンをインクリメントする関数。
   * refreshData 完了後に呼び、地図グリッドを最新状態に揃える。
   */
  incrementVisitedGridRefreshVersion: () => void;
  /**
   * 実績解除ダイアログが出ていない時だけ実績を評価する関数。
   * AppState 復帰 effect と定期更新 effect から呼ぶ。
   *
   * @returns 実績評価を実行した場合は true。
   */
  evaluateAchievementsIfDialogIdle: () => Promise<boolean>;
  /**
   * 実績一覧と未表示通知キューを再読み込みする関数。
   * AppState 復帰 effect と定期更新 effect から呼ぶ。
   */
  refreshAchievementState: (showPendingNotifications?: boolean, options?: { signal?: AbortSignal }) => Promise<void>;
};

/** refreshData が返すデータ構造。 */
export type RefreshDataResult = {
  logs: DailyLogSummary[];
  pointsBounds: LocationPointsBounds | null;
  recording: boolean;
  permissions: LocationPermissionState;
};

/** `useLocationRecordingSync` フックが返す状態と操作。 */
export type UseLocationRecordingSyncResult = {
  /** バックグラウンドGPS記録が動作中かどうか。 */
  isRecording: boolean;
  /** 自動GPS記録開始の進行状態。 */
  autoStartStatus: AutoStartStatus;
  /** 位置情報権限の現在状態。 */
  permissionState: LocationPermissionState;
  /**
   * 記録モードの同期が完了しているかどうか。
   * false の間は前景限定記録が安全に開始できない状態を示す。
   */
  isLocationRecordingModeSynchronized: boolean;
  /** 前景限定記録中であることをユーザーに通知するトーストの表示フラグ。 */
  isWhileInUseToastVisible: boolean;
  /** isWhileInUseToastVisible を更新するsetter。 */
  setIsWhileInUseToastVisible: (v: boolean) => void;
  /** ユーザーに表示するステータスメッセージ。 */
  message: string;
  /** message を更新するsetter。 */
  setMessage: (msg: string) => void;
  /** 全日別記録のサマリ一覧。 */
  dailyLogs: DailyLogSummary[];
  /** 有効な緯度経度を持つ全ポイントの外接境界と件数。地図の初期表示範囲・空状態表示に使う。未取得/0件はnull。 */
  pointsBounds: LocationPointsBounds | null;
  /** 画面表示用の総移動距離メートル。 */
  distance: number;
  /** 先月の月次エリアレポート。未取得時は null。 */
  monthlyAreaReport: MonthlyAreaReport | null;
  /**
   * AppState の現在値（フォアグラウンド/バックグラウンド）。
   * useKeepScreenAwake・useForegroundUserLocation・useCurrentAreaLabel から参照する。
   */
  appState: AppStateStatus;
  /**
   * DB・記録状態・権限状態をまとめて再読み込みし、画面表示を同期する。
   */
  refreshData: (options?: { signal?: AbortSignal }) => Promise<RefreshDataResult>;
  /**
   * GPS バックグラウンド記録を開始する。
   *
   * @param reason - 'auto' のとき自動開始メッセージ、'manual' のとき手動開始メッセージを表示する。
   * @param signal - AbortSignal。中断時に setState を呼ばないために使う。
   */
  startRecording: (reason?: 'auto' | 'manual', signal?: AbortSignal) => Promise<void>;
  /**
   * 権限状態に合わせ、背景タスクと前景限定記録の所有権を同期する。
   */
  synchronizeLocationRecordingMode: (
    state: { permissions: LocationPermissionState; recording: boolean },
    signal?: AbortSignal,
  ) => Promise<void>;
  /**
   * 権限状態に応じてアプリ内要求またはOS設定画面への誘導を行う。
   */
  requestLocationPermission: () => Promise<void>;
  /**
   * OSの設定画面を開き、位置情報を「常に許可」へ変更できるよう誘導する。
   */
  openLocationSettings: () => Promise<void>;
  /**
   * GPSログを再読み込みし、実績解除ダイアログが出ていなければ実績評価まで進める。
   * useAchievementDialogEffects から参照するために公開する。
   */
  refreshDataAndEvaluateAchievementsIfDialogIdle: () => Promise<void>;
};

/** 権限状態を取得する前にUIが参照する安全な初期値。 */
const EMPTY_PERMISSION_STATE: LocationPermissionState = {
  foregroundGranted: false,
  backgroundGranted: false,
  canAskForeground: true,
  canAskBackground: true,
};

/**
 * GPS記録・権限・同期に関わるstateと副作用を束ねるフック。
 *
 * App.tsx から切り出した「記録同期」責務を担う。refreshData が返すデータ
 * (dailyLogs / pointsBounds / distance / monthlyAreaReport) も含めることで、記録フックが
 * 自己完結した状態管理単位になる。
 */
export function useLocationRecordingSync({
  isReady,
  incrementVisitedGridRefreshVersion,
  evaluateAchievementsIfDialogIdle,
  refreshAchievementState,
}: UseLocationRecordingSyncOptions): UseLocationRecordingSyncResult {
  const autoStartInFlightRef = useRef(false);
  /**
   * AppState復帰時の「記録モード同期を含むチェーン」の AbortController。
   * チェーン完了時に null へ戻すため、「non-null = 同期チェーン実行中」の判定にも使う。
   *
   * 定期更新用(intervalRefreshAbortControllerRef)と分けているのは、interval が
   * 同期チェーンを abort すると synchronizeLocationRecordingMode が中断されたまま
   * isLocationRecordingModeSynchronized が false で取り残され、前景限定記録の保存が
   * 再開しなくなるため。手動の refreshData() 呼び出しはどちらのスコープにも含めない。
   */
  const appStateSyncAbortControllerRef = useRef<AbortController | null>(null);
  /** 10秒間隔の定期更新チェーンの AbortController。interval 同士の後勝ちにのみ使う。 */
  const intervalRefreshAbortControllerRef = useRef<AbortController | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [autoStartStatus, setAutoStartStatus] = useState<AutoStartStatus>('checking');
  const [permissionState, setPermissionState] = useState<LocationPermissionState>(EMPTY_PERMISSION_STATE);
  const [isLocationRecordingModeSynchronized, setIsLocationRecordingModeSynchronized] = useState(false);
  const [isWhileInUseToastVisible, setIsWhileInUseToastVisible] = useState(false);
  const [message, setMessage] = useState('起動後に自動でGPS記録を開始します。');
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [pointsBounds, setPointsBounds] = useState<LocationPointsBounds | null>(null);
  const [distance, setDistance] = useState(0);
  const [monthlyAreaReport, setMonthlyAreaReport] = useState<MonthlyAreaReport | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  /** DB、記録状態、権限状態をまとめて再読み込みし、画面表示を同期する。 */
  const refreshData = useCallback(
    async (options: { signal?: AbortSignal } = {}): Promise<RefreshDataResult> => {
      const { signal } = options;
      const [logs, pointsBoundsResult, recording, permissions] = await Promise.all([
        getDailyLogs(),
        getLocationPointsBounds(),
        isBackgroundLocationRecording(),
        getLocationPermissionState(),
      ]);
      const totalDistanceMeters = await calculateTotalDistanceMeters(logs);

      if (signal?.aborted) {
        return { logs, pointsBounds: pointsBoundsResult, recording, permissions };
      }

      setDailyLogs(logs);
      setPointsBounds(pointsBoundsResult);
      setDistance(totalDistanceMeters);
      setIsRecording(recording);
      setPermissionState(permissions);
      incrementVisitedGridRefreshVersion();

      getMonthlyAreaReport(getPreviousReportMonth())
        .then((report) => {
          if (!signal?.aborted) setMonthlyAreaReport(report);
        })
        .catch((error: unknown) => {
          console.warn('Failed to refresh monthly area report:', error);
        });

      return { logs, pointsBounds: pointsBoundsResult, recording, permissions };
    },
    [incrementVisitedGridRefreshVersion],
  );

  /** GPSバックグラウンド記録を開始し、結果をユーザー向けメッセージへ反映する。 */
  const startRecording = useCallback(
    async (reason: 'auto' | 'manual' = 'manual', signal?: AbortSignal): Promise<void> => {
      try {
        await startBackgroundLocationRecording();
        if (signal?.aborted) return;
        const result = await refreshData({ signal });
        if (signal?.aborted) return;
        setMessage(reason === 'auto' ? 'GPS記録を自動開始しました。' : 'バックグラウンドGPS記録を開始しました。');
        setAutoStartStatus(hasRequiredLocationPermission(result.permissions) ? 'recording' : 'needsPermission');
      } catch (error: unknown) {
        if (signal?.aborted) return;
        await refreshData({ signal }).catch(() => undefined);
        if (signal?.aborted) return;
        setMessage(error instanceof Error ? error.message : 'GPS記録の開始に失敗しました。');
        setAutoStartStatus('failed');
      }
    },
    [refreshData],
  );

  /** 権限許可後に未記録ならGPS記録の自動開始を試みる。 */
  const maybeStartRecordingAutomatically = useCallback(
    async (state: { permissions: LocationPermissionState; recording: boolean }, signal?: AbortSignal): Promise<void> => {
      if (signal?.aborted) return;
      if (
        !shouldStartRecordingAutomatically({
          permissions: state.permissions,
          isRecording: state.recording,
          isAutoStartInFlight: autoStartInFlightRef.current,
        })
      ) {
        if (!signal?.aborted) setAutoStartStatus(hasRequiredLocationPermission(state.permissions) ? 'recording' : 'needsPermission');
        return;
      }

      autoStartInFlightRef.current = true;

      try {
        await startRecording('auto', signal);
      } finally {
        autoStartInFlightRef.current = false;
      }
    },
    [startRecording],
  );

  /** 権限状態に合わせ、背景タスクと前景限定記録の所有権を同期する。 */
  const synchronizeLocationRecordingMode = useCallback(
    async (state: { permissions: LocationPermissionState; recording: boolean }, signal?: AbortSignal): Promise<void> => {
      if (signal?.aborted) return;
      if (state.permissions.backgroundGranted) {
        await updateBackgroundLocationTaskOptionsIfNeeded().catch((error: unknown) => {
          console.warn('Failed to update background location task options:', error);
        });
        if (signal?.aborted) return;
        await maybeStartRecordingAutomatically(state, signal);
        if (signal?.aborted) return;
        setIsLocationRecordingModeSynchronized(true);
        return;
      }

      try {
        await stopBackgroundLocationRecording();
        if (signal?.aborted) return;
        setIsRecording(false);
        setAutoStartStatus('needsPermission');
        setIsLocationRecordingModeSynchronized(true);
      } catch (error: unknown) {
        if (signal?.aborted) return;
        // 停止確認前に前景保存を開始すると二重保存になり得るため、同期済みにしない。
        setIsLocationRecordingModeSynchronized(false);
        setMessage(error instanceof Error ? error.message : 'バックグラウンドGPS記録の停止に失敗しました。');
      }
    },
    [maybeStartRecordingAutomatically],
  );

  // shouldOpenSettingsForPermission は permissionState から派生する。
  // requestLocationPermission から参照するためにローカルで計算する。
  const shouldOpenSettingsForPermission = !canRequestLocationPermissionInApp(permissionState);

  /** 権限状態に応じてアプリ内要求またはOS設定画面への誘導を行う。 */
  const requestLocationPermission = useCallback(async (): Promise<void> => {
    if (shouldOpenSettingsForPermission) {
      await Linking.openSettings();
      return;
    }

    await startRecording('manual');
  }, [shouldOpenSettingsForPermission, startRecording]);

  /** OSの設定画面を開き、位置情報を「常に許可」へ変更できるよう誘導する。 */
  const openLocationSettings = useCallback(async (): Promise<void> => {
    await Linking.openSettings();
  }, []);

  /**
   * GPSログを再読み込みし、実績解除ダイアログが出ていなければ実績評価まで進める。
   */
  const refreshDataAndEvaluateAchievementsIfDialogIdle = useCallback(async (): Promise<void> => {
    await refreshData();
    const didEvaluate = await evaluateAchievementsIfDialogIdle();

    if (didEvaluate) {
      await refreshAchievementState(true);
    }
  }, [evaluateAchievementsIfDialogIdle, refreshAchievementState, refreshData]);

  /**
   * フォアグラウンド復帰時にDBと権限状態を再同期する。
   * 前回のチェーンが実行中の場合は abort して新しいチェーンを優先する（後勝ち）。
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setAppState(state);
      if (state === 'active') {
        // 進行中のチェーン(前回の同期・定期更新)をすべて中断し、最新の同期チェーンを優先する
        appStateSyncAbortControllerRef.current?.abort();
        intervalRefreshAbortControllerRef.current?.abort();
        const controller = new AbortController();
        appStateSyncAbortControllerRef.current = controller;
        const { signal } = controller;

        setIsLocationRecordingModeSynchronized(false);
        refreshData({ signal })
          .then(async (result) => {
            if (signal.aborted) return;
            await synchronizeLocationRecordingMode(result, signal);
          })
          .then(async () => {
            if (signal.aborted) return false;
            return evaluateAchievementsIfDialogIdle();
          })
          .then(async (didEvaluate) => {
            if (signal.aborted || !didEvaluate) return;
            await refreshAchievementState(true, { signal });
          })
          .catch((error: unknown) => {
            if (signal.aborted) return;
            setMessage(error instanceof Error ? error.message : 'GPSログの再読み込みに失敗しました。');
          })
          .finally(() => {
            // 自分が最新の同期チェーンである場合のみ「実行中」状態を解除する
            // (より新しい同期チェーンに置き換えられている場合はそちらの管理に任せる)
            if (appStateSyncAbortControllerRef.current === controller) {
              appStateSyncAbortControllerRef.current = null;
            }
          });
      }
    });

    return () => subscription.remove();
  }, [evaluateAchievementsIfDialogIdle, refreshAchievementState, refreshData, synchronizeLocationRecordingMode]);

  /**
   * 更新ボタンを不要にするため、フォアグラウンド中は定期的にログを再読み込みする。
   * 前回の定期更新チェーンが実行中の場合は abort して新しいチェーンを優先する（後勝ち）。
   * AppState復帰の同期チェーンが実行中の間は発火をスキップし、同期を中断させない。
   */
  useEffect(() => {
    if (!isReady || appState !== 'active') {
      return;
    }

    const intervalId = setInterval(() => {
      // AppState復帰の記録モード同期チェーンが実行中の間はスキップする。
      // 同期チェーンを abort すると isLocationRecordingModeSynchronized が false のまま
      // 取り残され、前景限定記録の保存が再開しなくなるため。
      if (appStateSyncAbortControllerRef.current !== null) {
        return;
      }

      intervalRefreshAbortControllerRef.current?.abort();
      const controller = new AbortController();
      intervalRefreshAbortControllerRef.current = controller;
      const { signal } = controller;

      refreshData({ signal })
        .then(async () => {
          if (signal.aborted) return false;
          return evaluateAchievementsIfDialogIdle();
        })
        .then(async (didEvaluate) => {
          if (signal.aborted || !didEvaluate) return;
          await refreshAchievementState(true, { signal });
        })
        .catch((error: unknown) => {
          if (signal.aborted) return;
          setMessage(error instanceof Error ? error.message : 'GPSログの自動更新に失敗しました。');
        });
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [appState, evaluateAchievementsIfDialogIdle, isReady, refreshAchievementState, refreshData]);

  return {
    isRecording,
    autoStartStatus,
    permissionState,
    isLocationRecordingModeSynchronized,
    isWhileInUseToastVisible,
    setIsWhileInUseToastVisible,
    message,
    setMessage,
    dailyLogs,
    pointsBounds,
    distance,
    monthlyAreaReport,
    appState,
    refreshData,
    startRecording,
    synchronizeLocationRecordingMode,
    requestLocationPermission,
    openLocationSettings,
    refreshDataAndEvaluateAchievementsIfDialogIdle,
  };
}
