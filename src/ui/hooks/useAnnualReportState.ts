import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { reportInvestigatedError } from '@/config/sentry';
import { developmentFlags } from '@/config/developmentFlags';
import { createInitialProgress, runAnnualReportStep } from '@/features/annualReport/annualReportAggregator';
import { cancelAnnualReportNotification, scheduleAnnualReportNotification } from '@/features/annualReport/annualReportNotificationService';
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
  /**
   * 通知タップで開こうとした年のレポートがまだ表示できないときに呼ぶ。年を覚えておき、表示できるようになったら `onDeferredOpen` を呼ぶ。
   * - 本番: 背面から通知タップで戻ると、前面復帰の評価(非同期)より先にタップが届き、表示状態がまだ古いことがある(spec §8)。
   *   そのため次の評価が終わるまでだけ待ち、その評価で表示できれば開く。表示できなくても年は忘れる(待ち続けない)。
   *   評価が走っていなければ、その場で評価し直す。
   * - 開発用フラグ時: 起動時の削除で作り直し中でも通知タップから開く流れを確認できるよう、作り直しが終わるまで待つ(spec §10.1)。
   */
  deferNotificationOpen: (year: number) => void;
  /**
   * 「すべてのデータを削除」が成功したあとに呼ぶ。表示中のレポートを消し、予約済みの通知を取り消し、
   * 実行中の集計・評価の結果を捨てる(削除したレポートを保存し直したり表示し直したりしないため)。
   */
  resetAfterDataDeletion: () => void;
};

/** `useAnnualReportState` の引数。 */
export type UseAnnualReportStateArgs = {
  /** アプリの起動初期化が終わったか。終わるまで集計を始めない(起動直後の処理と競合させないため)。 */
  isReady: boolean;
  /** 現在時刻を返す関数。テストで日付を差し替えるために注入できる。 */
  now?: () => Date;
  /** 開発用フラグ(期間外でも動作させる)。省略時は `developmentFlags.annualReportAlwaysAvailable`。 */
  alwaysAvailable?: boolean;
  /** `deferNotificationOpen` で待たせた年のレポートが表示できるようになったときに呼ぶ。 */
  onDeferredOpen?: () => void;
};

/** 0時を過ぎてから評価し直すまでの余裕(ミリ秒)。 */
const MIDNIGHT_EVALUATION_DELAY_MS = 1000;

/** 表示用の状態。レポートと残り日数を常に組で更新するため1つにまとめる。 */
type DisplayState = { report: AnnualReportPayloadV1 | null; daysLeft: number | null };

/** 何も表示しない状態。 */
const EMPTY_DISPLAY: DisplayState = { report: null, daysLeft: null };

/** Sentry への記録自体が失敗しても呼び出し元を巻き込まない(未処理の Promise 拒否にしない)。 */
function reportSafely(error: unknown, context: Record<string, unknown>): void {
  try {
    reportInvestigatedError(error, { area: SENTRY_AREA, context });
  } catch (reportError: unknown) {
    console.warn('Failed to report annual report error:', reportError);
  }
}

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
 * - 起動初期化の完了時・前面復帰時・前面のまま0時を過ぎたときに評価し直す。集計期間外なら何もせず、表示も消す(1/16 以降の復帰など)。
 * - 未完了なら、UI が空いたときに1ステップ(半月分)ずつ集計し、ステップごとに進捗を保存する。
 *   ステップの間で UI へ制御を返し、背面へ回ったら次を予約しない(GPS のバックグラウンド処理には関与しない)。
 * - ステップは常に1つずつしか実行しない。前面復帰が重なっても二重に走らせず、
 *   読み込み中にループが進んだ評価の古い記録で、完成済みの行を上書きしない(spec §7.2)。
 * - 例外は Sentry へ記録し、そのセッション中は再試行しない。記録日数不足の年も、そのセッション中は再集計しない。
 * - 開発用フラグ時は、起動ごとに1回と、画面の開閉時に保存データを削除して作り直す(spec §10.1)。
 *   通知の予約は起動ごとに1回だけにする(閉じるたびに通知が届くのを避けるため)。
 */
export function useAnnualReportState({
  isReady,
  now = () => new Date(),
  alwaysAvailable = developmentFlags.annualReportAlwaysAvailable,
  onDeferredOpen,
}: UseAnnualReportStateArgs): AnnualReportState {
  const [display, setDisplay] = useState<DisplayState>(EMPTY_DISPLAY);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  /** 最新の引数をコールバックから参照するための ref。 */
  const nowRef = useRef(now);
  const alwaysAvailableRef = useRef(alwaysAvailable);
  const onDeferredOpenRef = useRef(onDeferredOpen);
  /** 現在の AppState。背面中は次のステップを予約しない判定に使う。 */
  const appStateRef = useRef<AppStateStatus>(resolveAppStateStatus(AppState.currentState));
  /** 集計ループ(予約〜実行〜保存)が進行中か。二重起動を防ぐ。 */
  const loopActiveRef = useRef(false);
  /**
   * ループの開始・終了ごとに増える世代番号。
   * 評価の読み込み中にループが動いていた・世代が変わった場合、その評価が読んだ記録は古い可能性があるため、
   * そこからループを始めない(古い進捗の保存で完成済みの行を消さないため)。
   */
  const loopGenerationRef = useRef(0);
  /** 予約中のステップの取り消し関数。 */
  const cancelScheduledRef = useRef<(() => void) | null>(null);
  /** ステップで例外が出たか。出たらこのセッション中は再試行しない。 */
  const failedRef = useRef(false);
  /** 記録日数不足と判定された対象年。前面復帰のたびに最終ステップを繰り返さないよう覚えておく。 */
  const insufficientYearRef = useRef<number | null>(null);
  /** 開発用フラグ時の、起動ごと1回の作り直し削除を済ませたか。 */
  const launchResetDoneRef = useRef(false);
  /** この起動中に通知の予約を試みたか(起動ごとに1回だけ予約するため)。 */
  const notificationAttemptedRef = useRef(false);
  /** 進行中のループに、最初からのやり直しを求めているか(開発用フラグ時の閉じる操作)。 */
  const restartRequestedRef = useRef(false);
  /**
   * 通知タップで開くのを待っている年と、待ち始めた時点で終わっていた評価の回数。
   * 本番では、この回数より後に終わった評価で判定して必ず忘れる(待ちを1回の評価に限るため)。
   */
  const pendingOpenRef = useRef<{ year: number; settledCountAtDefer: number } | null>(null);
  /** 実行中の評価の数。通知タップを待たせるとき、評価が走っていなければ評価し直すために使う。 */
  const evaluationsInFlightRef = useRef(0);
  /** 終わった評価の回数(state)。本番で待たせた通知タップを、次の評価の完了時に判定するために使う。 */
  const [settledEvaluationCount, setSettledEvaluationCount] = useState(0);
  /** `settledEvaluationCount` の最新値。待ち始めの時点の回数を、レンダーを待たずに記録するために使う。 */
  const settledEvaluationCountRef = useRef(0);
  /**
   * データ削除の世代番号。`resetAfterDataDeletion` で増える。
   * ステップ・評価は開始時の値を覚え、途中で変わっていたら結果を保存・表示せずに終わる。
   */
  const dataEpochRef = useRef(0);
  /** アンマウント後に state を更新しないためのフラグ。 */
  const mountedRef = useRef(true);
  /** 最新の runStep。予約したステップから、宣言順に依存せず呼び出すために ref で持つ。 */
  const runStepRef = useRef<(window: AnnualReportWindow, progress: AnnualReportProgress) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    nowRef.current = now;
    alwaysAvailableRef.current = alwaysAvailable;
    onDeferredOpenRef.current = onDeferredOpen;
  });

  /** 集計ループを閉じる。世代番号を進め、読み込み中だった評価が古い進捗で再開しないようにする。 */
  const endLoop = useCallback(() => {
    loopActiveRef.current = false;
    loopGenerationRef.current += 1;
  }, []);

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

  /**
   * 完了時の通知を、起動ごとに1回だけ予約する。
   * 本番では、行に予約日時が記録済みなら予約し直さない(同じ年の通知を二度届けないため。spec §7.2)。
   * 開発用フラグ時は起動ごとに行を削除して作り直すため、この記録は見ない。
   */
  const scheduleNotificationOnce = useCallback(async (window: AnnualReportWindow) => {
    if (notificationAttemptedRef.current) return;
    const at = resolveNotificationTime(nowRef.current(), window.year, alwaysAvailableRef.current);
    if (!at) return;
    notificationAttemptedRef.current = true;
    if (!alwaysAvailableRef.current) {
      const record = await getAnnualReport(window.year);
      if (record?.notificationScheduledAt) return;
    }
    const scheduled = await scheduleAnnualReportNotification(window.year, at);
    if (scheduled) {
      await markAnnualReportNotificationScheduled(window.year, at.toISOString());
    }
  }, []);

  /**
   * 集計ループの次のステップを予約する。背面中や失敗後は予約せずループを終える。
   * 予約したステップは、実行時点で背面に回っていれば何もせず終わる(前面復帰時の評価で再開する)。
   */
  const scheduleStep = useCallback(
    (window: AnnualReportWindow, progress: AnnualReportProgress) => {
      if (!mountedRef.current || failedRef.current || appStateRef.current !== 'active') {
        endLoop();
        return;
      }

      cancelScheduledRef.current = scheduleWhenIdle(() => {
        cancelScheduledRef.current = null;
        if (!mountedRef.current || appStateRef.current !== 'active') {
          endLoop();
          return;
        }
        runStepRef.current(window, progress).catch(() => undefined);
      });
    },
    [endLoop],
  );

  /** 1ステップを実行して結果を保存し、必要なら次を予約する。 */
  async function runStep(window: AnnualReportWindow, progress: AnnualReportProgress): Promise<void> {
    const epoch = dataEpochRef.current;
    /** 実行中にデータ削除があったか。あればループは削除時に閉じているため、状態に触れずに終わる。 */
    const isStale = () => epoch !== dataEpochRef.current;
    try {
      const result = await runAnnualReportStep(window, progress, alwaysAvailableRef.current);
      if (isStale()) return;

      if (restartRequestedRef.current) {
        // 開発用フラグ時に閉じる操作でやり直しを求められた。実行中だった結果は捨てて最初から進める
        restartRequestedRef.current = false;
        scheduleStep(window, createInitialProgress());
        return;
      }

      if (result.kind === 'progressed') {
        await saveAnnualReportProgress(window.year, result.progress);
        if (isStale()) return;
        scheduleStep(window, result.progress);
        return;
      }

      if (result.kind === 'completed') {
        await completeAnnualReport(window.year, result.payload);
        if (isStale()) return;
        applyCompletedReport(window, result.payload);
        await scheduleNotificationOnce(window);
        if (isStale()) return;
      } else {
        // 記録が少ない年はレポートを作らないため何も保存しない。前面復帰のたびに判定し直さないよう覚えておく
        insufficientYearRef.current = window.year;
      }

      if (restartRequestedRef.current) {
        // 完了処理の途中で閉じる操作があった場合も、取りこぼさずに最初からやり直す
        restartRequestedRef.current = false;
        scheduleStep(window, createInitialProgress());
        return;
      }
      // 保存まで終えてからループを閉じる。途中で前面復帰の評価が走っても二重に集計させないため
      endLoop();
    } catch (error: unknown) {
      if (isStale()) return;
      failedRef.current = true;
      endLoop();
      reportSafely(error, { year: window.year, nextMonth: progress.nextMonth, nextHalf: progress.nextHalf ?? 1 });
    }
  }

  useEffect(() => {
    runStepRef.current = runStep;
  });

  /** 集計ループが止まっていれば、指定の進捗から開始する。 */
  const startLoop = useCallback(
    (window: AnnualReportWindow, progress: AnnualReportProgress) => {
      if (loopActiveRef.current || failedRef.current || insufficientYearRef.current === window.year) return;
      loopActiveRef.current = true;
      loopGenerationRef.current += 1;
      scheduleStep(window, progress);
    },
    [scheduleStep],
  );

  /** 現在時刻で対象年を決め直し、保存済みレポートの表示か集計の開始を行う。 */
  const evaluate = useCallback(async () => {
    const epoch = dataEpochRef.current;
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

    // 読み込み開始時点のループの状態。読み込み中にループが動いていれば、読んだ記録は古い可能性がある
    const loopWasActive = loopActiveRef.current;
    const generationAtRead = loopGenerationRef.current;
    const record = await getAnnualReport(window.year);
    // 読み込み中にデータが削除された場合、読んだ記録は削除前のものなので使わない
    if (epoch !== dataEpochRef.current) return;
    if (record?.status === 'completed') {
      applyCompletedReport(window, record.payload);
      return;
    }

    // 未完了のときは、開発用フラグ時の作り直し中に限り、同じ年のメモリ上のレポートを公開期間中なら表示し続ける。
    // 本番で行が無い・未完了なら表示しない(削除済みのレポートを見せ続けないため)
    if (mountedRef.current) {
      const current = nowRef.current();
      const keepPrevious = alwaysAvailableRef.current;
      setDisplay((previous) =>
        keepPrevious && previous.report && previous.report.year === window.year && isPublishPeriod(current, window.year, true)
          ? { report: previous.report, daysLeft: daysUntilPublishEnd(current, window.publishEnd) }
          : EMPTY_DISPLAY,
      );
    }

    if (loopWasActive || generationAtRead !== loopGenerationRef.current) {
      // 進行中・直前に終わったループが最新の状態を持っている。古い進捗から始めて完成済みの行を上書きしない
      return;
    }
    startLoop(window, record?.progress ?? createInitialProgress());
  }, [applyCompletedReport, startLoop]);

  /** 評価を実行し、例外は Sentry へ記録する(読み込み失敗でアプリを止めない)。 */
  const runEvaluate = useCallback(() => {
    evaluationsInFlightRef.current += 1;
    evaluate()
      .catch((error: unknown) => {
        reportSafely(error, { stage: 'evaluate' });
      })
      .finally(() => {
        evaluationsInFlightRef.current -= 1;
        settledEvaluationCountRef.current += 1;
        if (!mountedRef.current) return;
        setHasEvaluated(true);
        setSettledEvaluationCount(settledEvaluationCountRef.current);
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

  /**
   * 前面復帰で評価し直し、前面にいる間は次の0時(端末ローカル)にも評価し直す。
   * 前面のまま日付をまたぐと、公開開始(12/20)・終了(1/16)や残り日数が変わるため(前面復帰だけでは拾えない)。
   * 背面中とアンマウント後は予約しない。
   */
  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;
    const clearMidnightTimer = () => {
      if (midnightTimer !== null) clearTimeout(midnightTimer);
      midnightTimer = null;
    };
    const scheduleMidnightEvaluation = () => {
      clearMidnightTimer();
      if (!isReady || appStateRef.current !== 'active') return;
      const current = nowRef.current();
      const nextMidnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
      // タイマーが少し早く発火しても前日のまま評価しないよう、0時から少し遅らせる
      const delay = Math.max(nextMidnight.getTime() - current.getTime(), 0) + MIDNIGHT_EVALUATION_DELAY_MS;
      midnightTimer = setTimeout(() => {
        midnightTimer = null;
        runEvaluate();
        scheduleMidnightEvaluation();
      }, delay);
    };

    scheduleMidnightEvaluation();
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      appStateRef.current = state;
      if (state === 'active' && isReady) {
        runEvaluate();
      }
      scheduleMidnightEvaluation();
    });
    return () => {
      clearMidnightTimer();
      subscription.remove();
    };
  }, [isReady, runEvaluate]);

  /**
   * 待たせていた通知タップの年を判定する。
   * 開発用フラグ時は表示できるようになった時点で開く。本番では待ち始めより後の評価が終わった時点でだけ判定し、
   * 表示できれば開き、できなければ忘れる(評価の途中の表示更新では判定しない)。
   */
  useEffect(() => {
    const pending = pendingOpenRef.current;
    if (pending === null) return;
    const isAvailable = display.report?.year === pending.year;
    if (!alwaysAvailableRef.current && settledEvaluationCount <= pending.settledCountAtDefer) return;
    if (alwaysAvailableRef.current && !isAvailable) return;
    pendingOpenRef.current = null;
    if (isAvailable) onDeferredOpenRef.current?.();
  }, [display.report, settledEvaluationCount]);

  const onReportOpened = useCallback(() => {
    if (!alwaysAvailableRef.current) return;
    const window = resolveAggregationWindow(nowRef.current(), true);
    if (!window) return;
    // 表示中のストーリーはメモリ上のデータで再生するため、availableReport は変えない
    deleteAnnualReport(window.year).catch((error: unknown) => {
      reportSafely(error, { stage: 'debugDeleteOnOpen' });
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
        reportSafely(error, { stage: 'debugDeleteOnClose' });
      });
  }, [startLoop]);

  const deferNotificationOpen = useCallback(
    (year: number) => {
      pendingOpenRef.current = { year, settledCountAtDefer: settledEvaluationCountRef.current };
      // 本番で評価が走っていなければ、待ちが次の評価で必ず終わるようにその場で評価し直す
      if (!alwaysAvailableRef.current && evaluationsInFlightRef.current === 0 && isReady) {
        runEvaluate();
      }
    },
    [isReady, runEvaluate],
  );

  const resetAfterDataDeletion = useCallback(() => {
    // 実行中のステップ・評価の結果を捨てる。ループは閉じ、予約済みのステップも取り消す
    dataEpochRef.current += 1;
    cancelScheduledRef.current?.();
    cancelScheduledRef.current = null;
    endLoop();
    restartRequestedRef.current = false;
    // 記録が消えたため、記録日数不足・失敗の判定もやり直せるようにする
    insufficientYearRef.current = null;
    failedRef.current = false;
    pendingOpenRef.current = null;
    if (mountedRef.current) setDisplay(EMPTY_DISPLAY);

    const window = resolveAggregationWindow(nowRef.current(), alwaysAvailableRef.current);
    if (window) {
      cancelAnnualReportNotification(window.year).catch(() => undefined);
    }
  }, [endLoop]);

  return {
    availableReport: display.report,
    daysLeft: display.daysLeft,
    hasEvaluated,
    onReportOpened,
    onReportClosed,
    deferNotificationOpen,
    resetAfterDataDeletion,
  };
}
