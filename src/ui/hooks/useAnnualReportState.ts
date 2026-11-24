import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { reportInvestigatedError } from '@/config/sentry';
import { developmentFlags } from '@/config/developmentFlags';
import { createInitialProgress, runAnnualReportStep } from '@/features/annualReport/annualReportAggregator';
import { scheduleAnnualReportNotification } from '@/features/annualReport/annualReportNotificationService';
import {
  daysUntilPublishEnd,
  isPublishPeriod,
  resolveAggregationWindow,
  resolveNotificationTime,
  type AnnualReportWindow,
} from '@/features/annualReport/annualReportPeriod';
import {
  completeAnnualReport,
  deleteAnnualReport,
  getAnnualReport,
  markAnnualReportNotificationScheduled,
  saveAnnualReportProgress,
} from '@/features/annualReport/annualReportRepository';
import type { AnnualReportPayloadV1, AnnualReportProgress } from '@/features/annualReport/annualReportTypes';
import { resolveAppStateStatus } from '@/ui/appStateStatus';

/** Sentry の `investigation_area` タグに入れる値。 */
const SENTRY_AREA = 'annual_report';

/** 年間レポートの表示状態と、画面の開閉を伝える操作。 */
export type AnnualReportState = {
  /** 公開期間中かつ集計完了のときだけ非null。地図のふりかえりボタンとストーリー画面が使う。 */
  availableReport: AnnualReportPayloadV1 | null;
  /** 公開終了までの残り日数(終了日当日は1)。availableReport が null のときは null。 */
  daysLeft: number | null;
  /**
   * 起動後の最初の評価(保存済みレポートの読み込み)が終わったか。
   * 通知タップのコールドスタート処理を、availableReport が確定するまで待たせるために使う。
   */
  hasEvaluated: boolean;
  /** レポート画面を開いたときに呼ぶ。開発用フラグ時だけ保存データを削除する(表示中のデータは保持)。 */
  onReportOpened: () => void;
  /** レポート画面を閉じたときに呼ぶ。開発用フラグ時だけ保存データを削除し、集計を最初からやり直す。 */
  onReportClosed: () => void;
};

/** `useAnnualReportState` の引数。 */
export type UseAnnualReportStateArgs = {
  /** アプリの起動初期化が終わったか。終わるまで集計を始めない(起動直後の処理と競合させないため)。 */
  isReady: boolean;
  /** 現在時刻を返す関数。テストで日付を差し替えるために注入できる。 */
  now?: () => Date;
  /** 開発用フラグ(期間外でも動作させる)。省略時は `developmentFlags.annualReportAlwaysAvailable`。 */
  alwaysAvailable?: boolean;
};

/** 表示用の状態。レポートと残り日数を常に組で更新するため1つにまとめる。 */
type DisplayState = { report: AnnualReportPayloadV1 | null; daysLeft: number | null };

/** 何も表示しない状態。 */
const EMPTY_DISPLAY: DisplayState = { report: null, daysLeft: null };

/** UI が空いたときに呼ぶコールバックを予約し、取り消し関数を返す。 */
function scheduleWhenIdle(callback: () => void): () => void {
  // RN 0.88 では InteractionManager が削除されたため、推奨される requestIdleCallback を使う
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(() => callback());
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(callback, 0);
  return () => clearTimeout(timer);
}

/**
 * 年間レポートの集計をアプリ前面で少しずつ進め、表示できるレポートを返すフック。
 *
 * - 起動初期化の完了時と前面復帰時に評価し直す。集計期間外なら何もせず、表示も消す(1/16 以降の復帰など)。
 * - 未完了なら、UI が空いたときに1ステップ(1か月分)ずつ集計し、ステップごとに進捗を保存する。
 *   ステップの間で UI へ制御を返し、背面へ回ったら次を予約しない(GPS のバックグラウンド処理には関与しない)。
 * - ステップは常に1つずつしか実行しない。前面復帰が重なっても二重に走らせない。
 * - 例外は Sentry へ記録し、そのセッション中は再試行しない。
 * - 開発用フラグ時は、起動ごとに1回と、画面の開閉時に保存データを削除して作り直す(spec §10.1)。
 *   通知の予約は起動ごとに1回だけにする(閉じるたびに通知が届くのを避けるため)。
 */
export function useAnnualReportState({
  isReady,
  now = () => new Date(),
  alwaysAvailable = developmentFlags.annualReportAlwaysAvailable,
}: UseAnnualReportStateArgs): AnnualReportState {
  const [display, setDisplay] = useState<DisplayState>(EMPTY_DISPLAY);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  /** 最新の引数をコールバックから参照するための ref。 */
  const nowRef = useRef(now);
  const alwaysAvailableRef = useRef(alwaysAvailable);
  /** 現在の AppState。背面中は次のステップを予約しない判定に使う。 */
  const appStateRef = useRef<AppStateStatus>(resolveAppStateStatus(AppState.currentState));
  /** 集計ループ(予約〜実行〜保存)が進行中か。二重起動を防ぐ。 */
  const loopActiveRef = useRef(false);
  /** 予約中のステップの取り消し関数。 */
  const cancelScheduledRef = useRef<(() => void) | null>(null);
  /** ステップで例外が出たか。出たらこのセッション中は再試行しない。 */
  const failedRef = useRef(false);
  /** 開発用フラグ時の、起動ごと1回の作り直し削除を済ませたか。 */
  const launchResetDoneRef = useRef(false);
  /** この起動中に通知の予約を試みたか(起動ごとに1回だけ予約するため)。 */
  const notificationAttemptedRef = useRef(false);
  /** 進行中のループに、最初からのやり直しを求めているか(開発用フラグ時の閉じる操作)。 */
  const restartRequestedRef = useRef(false);
  /** アンマウント後に state を更新しないためのフラグ。 */
  const mountedRef = useRef(true);
  /** 最新の runStep。予約したステップから、宣言順に依存せず呼び出すために ref で持つ。 */
  const runStepRef = useRef<(window: AnnualReportWindow, progress: AnnualReportProgress) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    nowRef.current = now;
    alwaysAvailableRef.current = alwaysAvailable;
  });

  /** 完成レポートを、公開期間中なら表示状態へ反映する。 */
  const applyCompletedReport = useCallback((window: AnnualReportWindow, payload: AnnualReportPayloadV1) => {
    if (!mountedRef.current) return;
    const current = nowRef.current();
    if (isPublishPeriod(current, window.year, alwaysAvailableRef.current)) {
      setDisplay({ report: payload, daysLeft: daysUntilPublishEnd(current, window.publishEnd) });
    } else {
      setDisplay(EMPTY_DISPLAY);
    }
  }, []);

  /** 完了時の通知を、起動ごとに1回だけ予約する。 */
  const scheduleNotificationOnce = useCallback(async (window: AnnualReportWindow) => {
    if (notificationAttemptedRef.current) return;
    const at = resolveNotificationTime(nowRef.current(), window.year, alwaysAvailableRef.current);
    if (!at) return;
    notificationAttemptedRef.current = true;
    const scheduled = await scheduleAnnualReportNotification(window.year, at);
    if (scheduled) {
      await markAnnualReportNotificationScheduled(window.year, at.toISOString());
    }
  }, []);

  /**
   * 集計ループの次のステップを予約する。背面中や失敗後は予約せずループを終える。
   * 予約したステップは、実行時点で背面に回っていれば何もせず終わる(前面復帰時の評価で再開する)。
   */
  const scheduleStep = useCallback((window: AnnualReportWindow, progress: AnnualReportProgress) => {
    if (!mountedRef.current || failedRef.current || appStateRef.current !== 'active') {
      loopActiveRef.current = false;
      return;
    }

    cancelScheduledRef.current = scheduleWhenIdle(() => {
      cancelScheduledRef.current = null;
      if (!mountedRef.current || appStateRef.current !== 'active') {
        loopActiveRef.current = false;
        return;
      }
      runStepRef.current(window, progress).catch(() => undefined);
    });
  }, []);

  /** 1ステップを実行して結果を保存し、必要なら次を予約する。 */
  async function runStep(window: AnnualReportWindow, progress: AnnualReportProgress): Promise<void> {
    try {
      const result = await runAnnualReportStep(window, progress, alwaysAvailableRef.current);

      if (restartRequestedRef.current) {
        // 開発用フラグ時に閉じる操作でやり直しを求められた。実行中だった結果は捨てて最初から進める
        restartRequestedRef.current = false;
        scheduleStep(window, createInitialProgress());
        return;
      }

      if (result.kind === 'progressed') {
        await saveAnnualReportProgress(window.year, result.progress);
        scheduleStep(window, result.progress);
        return;
      }

      if (result.kind === 'completed') {
        await completeAnnualReport(window.year, result.payload);
        applyCompletedReport(window, result.payload);
        await scheduleNotificationOnce(window);
      }
      // insufficient: 記録が少ない年はレポートを作らないため何も保存しない

      if (restartRequestedRef.current) {
        // 完了処理の途中で閉じる操作があった場合も、取りこぼさずに最初からやり直す
        restartRequestedRef.current = false;
        scheduleStep(window, createInitialProgress());
        return;
      }
      // 保存まで終えてからループを閉じる。途中で前面復帰の評価が走っても二重に集計させないため
      loopActiveRef.current = false;
    } catch (error: unknown) {
      loopActiveRef.current = false;
      failedRef.current = true;
      reportInvestigatedError(error, { area: SENTRY_AREA, context: { year: window.year, nextMonth: progress.nextMonth } });
    }
  }

  useEffect(() => {
    runStepRef.current = runStep;
  });

  /** 集計ループが止まっていれば、指定の進捗から開始する。 */
  const startLoop = useCallback(
    (window: AnnualReportWindow, progress: AnnualReportProgress) => {
      if (loopActiveRef.current || failedRef.current) return;
      loopActiveRef.current = true;
      scheduleStep(window, progress);
    },
    [scheduleStep],
  );

  /** 現在時刻で対象年を決め直し、保存済みレポートの表示か集計の開始を行う。 */
  const evaluate = useCallback(async () => {
    const window = resolveAggregationWindow(nowRef.current(), alwaysAvailableRef.current);
    if (!window) {
      if (mountedRef.current) setDisplay(EMPTY_DISPLAY);
      return;
    }

    if (alwaysAvailableRef.current && !launchResetDoneRef.current) {
      // 起動ごとに保存データなしから集計し直す流れを通すため、最初の評価で1回だけ削除する
      launchResetDoneRef.current = true;
      await deleteAnnualReport(window.year);
    }

    const record = await getAnnualReport(window.year);
    if (record?.status === 'completed') {
      applyCompletedReport(window, record.payload);
      return;
    }

    // 未完了のときは、同じ年のメモリ上のレポート(開発用フラグ時の作り直し中)だけ公開期間中なら表示し続ける
    if (mountedRef.current) {
      const current = nowRef.current();
      setDisplay((previous) =>
        previous.report && previous.report.year === window.year && isPublishPeriod(current, window.year, alwaysAvailableRef.current)
          ? { report: previous.report, daysLeft: daysUntilPublishEnd(current, window.publishEnd) }
          : EMPTY_DISPLAY,
      );
    }
    startLoop(window, record?.progress ?? createInitialProgress());
  }, [applyCompletedReport, startLoop]);

  /** 評価を実行し、例外は Sentry へ記録する(読み込み失敗でアプリを止めない)。 */
  const runEvaluate = useCallback(() => {
    evaluate()
      .catch((error: unknown) => {
        reportInvestigatedError(error, { area: SENTRY_AREA, context: { stage: 'evaluate' } });
      })
      .finally(() => {
        if (mountedRef.current) setHasEvaluated(true);
      });
  }, [evaluate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelScheduledRef.current?.();
      cancelScheduledRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    runEvaluate();
  }, [isReady, runEvaluate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      appStateRef.current = state;
      if (state === 'active' && isReady) {
        runEvaluate();
      }
    });
    return () => subscription.remove();
  }, [isReady, runEvaluate]);

  const onReportOpened = useCallback(() => {
    if (!alwaysAvailableRef.current) return;
    const window = resolveAggregationWindow(nowRef.current(), true);
    if (!window) return;
    // 表示中のストーリーはメモリ上のデータで再生するため、availableReport は変えない
    deleteAnnualReport(window.year).catch((error: unknown) => {
      reportInvestigatedError(error, { area: SENTRY_AREA, context: { stage: 'debugDeleteOnOpen' } });
    });
  }, []);

  const onReportClosed = useCallback(() => {
    if (!alwaysAvailableRef.current) return;
    const window = resolveAggregationWindow(nowRef.current(), true);
    if (!window) return;
    deleteAnnualReport(window.year)
      .then(() => {
        if (loopActiveRef.current) {
          // 実行中のステップを待ってから最初に戻す(ステップを同時に走らせないため)
          restartRequestedRef.current = true;
          return;
        }
        // 作り直しが終わるまでは直前の availableReport を表示し続ける
        startLoop(window, createInitialProgress());
      })
      .catch((error: unknown) => {
        reportInvestigatedError(error, { area: SENTRY_AREA, context: { stage: 'debugDeleteOnClose' } });
      });
  }, [startLoop]);

  return { availableReport: display.report, daysLeft: display.daysLeft, hasEvaluated, onReportOpened, onReportClosed };
}
