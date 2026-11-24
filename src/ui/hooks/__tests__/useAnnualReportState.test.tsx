import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { reportInvestigatedError } from '@/config/sentry';
import { runAnnualReportStep } from '@/features/annualReport/annualReportAggregator';
import { cancelAnnualReportNotification, scheduleAnnualReportNotification } from '@/features/annualReport/annualReportNotificationService';
import {
  completeAnnualReport,
  deleteAnnualReport,
  getAnnualReport,
  markAnnualReportNotificationScheduled,
  saveAnnualReportProgress,
} from '@/features/annualReport/annualReportRepository';
import type { AnnualReportPayloadV1, AnnualReportProgress, AnnualReportRecord } from '@/features/annualReport/annualReportTypes';
import { useAnnualReportState } from '@/ui/hooks/useAnnualReportState';

// 共通セットアップ(jest/setupAnnualReportPeriodMock.js)の期間判定モックを外し、実装を使う
jest.unmock('@/features/annualReport/annualReportPeriod');

jest.mock('@/config/sentry', () => ({
  reportInvestigatedError: jest.fn(),
}));

// アグリゲーターの実モジュール(createInitialProgress)を読むと SQLite 接続が開かれるため、DB はモックする
jest.mock('@/db/database', () => ({ db: {} }));

jest.mock('@/features/annualReport/annualReportRepository', () => ({
  getAnnualReport: jest.fn(),
  saveAnnualReportProgress: jest.fn().mockResolvedValue(undefined),
  completeAnnualReport: jest.fn().mockResolvedValue(undefined),
  markAnnualReportNotificationScheduled: jest.fn().mockResolvedValue(undefined),
  deleteAnnualReport: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/annualReport/annualReportAggregator', () => ({
  ...jest.requireActual('@/features/annualReport/annualReportAggregator'),
  runAnnualReportStep: jest.fn(),
}));

jest.mock('@/features/annualReport/annualReportNotificationService', () => ({
  scheduleAnnualReportNotification: jest.fn().mockResolvedValue(true),
  cancelAnnualReportNotification: jest.fn().mockResolvedValue(undefined),
}));

/** 次に実行を待っているアイドルコールバック。ステップ間でUIへ制御を返す挙動を手動で進めるために溜める。 */
let idleQueue: { id: number; callback: () => void }[] = [];
/** アイドルコールバックの採番。 */
let nextIdleId = 1;
/** AppState の変化リスナー。前面・背面の切り替えをテストから発火する。 */
let appStateListener: ((state: AppStateStatus) => void) | null = null;

/** 指定した月の進捗を作る。 */
function makeProgress(nextMonth: number): AnnualReportProgress {
  return {
    nextMonth,
    activeDates: [],
    monthlyDistanceMeters: Array.from({ length: 12 }, () => 0),
    yearRouteSegments: [],
    farthestCandidate: null,
  };
}

/** テスト用の完成レポートを作る。区別できるよう距離だけ変える。 */
function makePayload(year: number, totalDistanceMeters = 1000): AnnualReportPayloadV1 {
  return { version: 1, year, totalDistanceMeters } as AnnualReportPayloadV1;
}

/** 完成済みレコードを作る。 */
function completedRecord(payload: AnnualReportPayloadV1): AnnualReportRecord {
  return { year: payload.year, status: 'completed', payload, notificationScheduledAt: null };
}

/** マイクロタスクを流し切って非同期の state 更新を反映する。 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
  });
}

/** 溜まっているアイドルコールバックを1つ実行し、続く非同期処理を流し切る。 */
async function runNextIdle(): Promise<void> {
  const callback = idleQueue.shift()?.callback;
  if (!callback) {
    throw new Error('予約済みのステップがありません');
  }
  await act(async () => {
    callback();
  });
  await flushPromises();
}

/** AppState の変化を発火する。 */
async function emitAppState(state: AppStateStatus): Promise<void> {
  await act(async () => {
    appStateListener?.(state);
  });
  await flushPromises();
}

describe('年間レポート状態hook useAnnualReportState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    idleQueue = [];
    nextIdleId = 1;
    appStateListener = null;
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = jest.fn((callback: () => void) => {
      const id = nextIdleId;
      nextIdleId += 1;
      idleQueue.push({ id, callback });
      return id;
    });
    // 取り消された予約はキューから外し、実際の cancelIdleCallback と同じく実行されないようにする
    (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback = jest.fn((id: number) => {
      idleQueue = idleQueue.filter((entry) => entry.id !== id);
    });
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    (getAnnualReport as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('期間外では集計しない', async () => {
    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 10, 24, 10), alwaysAvailable: false }),
    );
    await flushPromises();

    expect(getAnnualReport).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(0);
    expect(result.current.availableReport).toBeNull();
    expect(result.current.daysLeft).toBeNull();
  });

  it('未完了なら1ステップずつ進めて進捗を保存し、完了で completeAnnualReport を呼ぶ', async () => {
    const payload = makePayload(2026);
    (runAnnualReportStep as jest.Mock)
      .mockResolvedValueOnce({ kind: 'progressed', progress: makeProgress(2) })
      .mockResolvedValueOnce({ kind: 'progressed', progress: makeProgress(3) })
      .mockResolvedValueOnce({ kind: 'completed', payload });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }),
    );
    await flushPromises();

    // 起動直後はステップを予約するだけで、まだ実行しない
    expect(getAnnualReport).toHaveBeenCalledWith(2026);
    expect(runAnnualReportStep).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(1);

    await runNextIdle();
    expect(runAnnualReportStep).toHaveBeenCalledTimes(1);
    expect(runAnnualReportStep).toHaveBeenLastCalledWith(
      expect.objectContaining({ year: 2026, periodEnd: '2026-12-15' }),
      makeProgress(1),
      false,
    );
    expect(saveAnnualReportProgress).toHaveBeenLastCalledWith(2026, makeProgress(2));
    expect(idleQueue).toHaveLength(1);

    await runNextIdle();
    expect(runAnnualReportStep).toHaveBeenCalledTimes(2);
    expect(runAnnualReportStep).toHaveBeenLastCalledWith(expect.anything(), makeProgress(2), false);
    expect(saveAnnualReportProgress).toHaveBeenLastCalledWith(2026, makeProgress(3));

    await runNextIdle();
    expect(completeAnnualReport).toHaveBeenCalledWith(2026, payload);
    expect(idleQueue).toHaveLength(0);
    // 12/17は公開前なのでまだ表示しない
    expect(result.current.availableReport).toBeNull();
  });

  it('途中まで保存済みなら保存済みの進捗から再開する', async () => {
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(5),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'progressed', progress: makeProgress(6) });

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }));
    await flushPromises();
    await runNextIdle();

    expect(runAnnualReportStep).toHaveBeenCalledWith(expect.anything(), makeProgress(5), false);
  });

  it('isReady が false の間は集計しない', async () => {
    await renderHook(() => useAnnualReportState({ isReady: false, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }));
    await flushPromises();

    expect(getAnnualReport).not.toHaveBeenCalled();
  });

  it('12/19に完了したら12/20 9:00で通知を予約し、予約済みを記録する', async () => {
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload: makePayload(2026) });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 19, 15), alwaysAvailable: false }),
    );
    await flushPromises();
    await runNextIdle();

    const expectedAt = new Date(2026, 11, 20, 9, 0, 0, 0);
    expect(scheduleAnnualReportNotification).toHaveBeenCalledWith(2026, expectedAt);
    expect(markAnnualReportNotificationScheduled).toHaveBeenCalledWith(2026, expectedAt.toISOString());
    // 公開(12/20 0:00)前なので、地図のボタンはまだ出さない
    expect(result.current.availableReport).toBeNull();
    expect(result.current.daysLeft).toBeNull();
  });

  it('保存済みの行に通知予約日時が記録されていれば、完了しても通知を予約し直さない', async () => {
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: '2026-12-20T00:00:00.000Z',
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload: makePayload(2026) });

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 19, 15), alwaysAvailable: false }));
    await flushPromises();
    await runNextIdle();

    expect(completeAnnualReport).toHaveBeenCalled();
    expect(scheduleAnnualReportNotification).not.toHaveBeenCalled();
    expect(markAnnualReportNotificationScheduled).not.toHaveBeenCalled();
  });

  it('12/19に完了したあと12/20に前面へ戻るとレポートが表示できるようになる', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });
    let current = new Date(2026, 11, 19, 23, 50);

    const { result } = await renderHook(() => useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false }));
    await flushPromises();
    await runNextIdle();
    expect(result.current.availableReport).toBeNull();

    (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));
    current = new Date(2026, 11, 20, 8, 0);
    await emitAppState('active');

    expect(result.current.availableReport).toBe(payload);
    // 12/20〜1/15(当日を1と数える)
    expect(result.current.daysLeft).toBe(27);
  });

  it('通知を予約できなかった場合は予約済みを記録しない', async () => {
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload: makePayload(2026) });
    (scheduleAnnualReportNotification as jest.Mock).mockResolvedValueOnce(false);

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 19, 15), alwaysAvailable: false }));
    await flushPromises();
    await runNextIdle();

    expect(scheduleAnnualReportNotification).toHaveBeenCalledTimes(1);
    expect(markAnnualReportNotificationScheduled).not.toHaveBeenCalled();
  });

  it('公開期間中に完了したら通知せず、すぐに availableReport と残り日数を返す', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 15), alwaysAvailable: false }),
    );
    await flushPromises();
    await runNextIdle();

    expect(scheduleAnnualReportNotification).not.toHaveBeenCalled();
    expect(result.current.availableReport).toBe(payload);
    // 12/21〜1/15(当日を1と数える)
    expect(result.current.daysLeft).toBe(26);
  });

  it('insufficient なら保存も通知もしない', async () => {
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'insufficient' });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 19, 15), alwaysAvailable: false }),
    );
    await flushPromises();
    await runNextIdle();

    expect(saveAnnualReportProgress).not.toHaveBeenCalled();
    expect(completeAnnualReport).not.toHaveBeenCalled();
    expect(scheduleAnnualReportNotification).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(0);
    expect(result.current.availableReport).toBeNull();

    // 同じセッション中は、前面復帰のたびに最終ステップを繰り返さない
    await emitAppState('active');
    expect(idleQueue).toHaveLength(0);
    expect(runAnnualReportStep).toHaveBeenCalledTimes(1);
  });

  it('背面へ回ったら次のステップを予約しない', async () => {
    let resolveStep: (value: unknown) => void = () => undefined;
    (runAnnualReportStep as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStep = resolve;
        }),
    );

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }));
    await flushPromises();
    await runNextIdle();

    // ステップ実行中に背面へ回る
    await emitAppState('background');
    await act(async () => {
      resolveStep({ kind: 'progressed', progress: makeProgress(2) });
    });
    await flushPromises();

    // 実行中のステップは完了させて保存するが、次は予約しない
    expect(saveAnnualReportProgress).toHaveBeenCalledWith(2026, makeProgress(2));
    expect(idleQueue).toHaveLength(0);
  });

  it('背面から前面へ戻ると保存済みの進捗から再開する', async () => {
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'progressed', progress: makeProgress(2) });

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }));
    await flushPromises();
    await emitAppState('background');
    // 背面へ回る前に予約されていたステップは、実行時に背面なら何もしない
    await runNextIdle();
    expect(runAnnualReportStep).not.toHaveBeenCalled();

    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(4),
      notificationScheduledAt: null,
    });
    await emitAppState('active');
    expect(idleQueue).toHaveLength(1);
    await runNextIdle();

    expect(runAnnualReportStep).toHaveBeenCalledTimes(1);
    expect(runAnnualReportStep).toHaveBeenCalledWith(expect.anything(), makeProgress(4), false);
  });

  it('前面復帰が重なってもステップを同時に実行しない', async () => {
    (runAnnualReportStep as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }));
    await flushPromises();
    await emitAppState('active');
    await emitAppState('active');

    expect(idleQueue).toHaveLength(1);
    await runNextIdle();
    await emitAppState('active');

    expect(idleQueue).toHaveLength(0);
    expect(runAnnualReportStep).toHaveBeenCalledTimes(1);
  });

  it('前面復帰時に日付が1/16になっていれば availableReport が null になる', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));
    let current = new Date(2027, 0, 15, 22);

    const { result } = await renderHook(() => useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false }));
    await flushPromises();

    expect(result.current.availableReport).toBe(payload);
    expect(result.current.daysLeft).toBe(1);

    current = new Date(2027, 0, 16, 8);
    await emitAppState('active');

    expect(result.current.availableReport).toBeNull();
    expect(result.current.daysLeft).toBeNull();
  });

  it('保存済みが completed なら集計せずにそれを使う', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 20, 0, 0), alwaysAvailable: false }),
    );
    await flushPromises();

    expect(idleQueue).toHaveLength(0);
    expect(saveAnnualReportProgress).not.toHaveBeenCalled();
    expect(result.current.availableReport).toBe(payload);
  });

  it('ステップで例外が出たら Sentry へ記録し、そのセッション中は再試行しない', async () => {
    const error = new Error('boom');
    (runAnnualReportStep as jest.Mock).mockRejectedValueOnce(error);

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }));
    await flushPromises();
    await runNextIdle();

    expect(reportInvestigatedError).toHaveBeenCalledWith(error, expect.objectContaining({ area: 'annual_report' }));
    expect(saveAnnualReportProgress).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(0);

    await emitAppState('active');
    expect(idleQueue).toHaveLength(0);
  });

  it('開発用フラグ時は起動ごとに作り直す', async () => {
    (getAnnualReport as jest.Mock).mockResolvedValue(null);

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 5, 10, 10), alwaysAvailable: true }));
    await flushPromises();

    expect(deleteAnnualReport).toHaveBeenCalledWith(2026);
    expect((deleteAnnualReport as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (getAnnualReport as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(idleQueue).toHaveLength(1);

    // 前面復帰では削除し直さない(起動ごとに1回だけ)
    await emitAppState('active');
    expect(deleteAnnualReport).toHaveBeenCalledTimes(1);
  });

  it('開発用フラグ時は10秒後に通知を予約し、availableReport を返す', async () => {
    const payload = makePayload(2026);
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });
    const now = new Date(2026, 5, 10, 10);

    const { result } = await renderHook(() => useAnnualReportState({ isReady: true, now: () => now, alwaysAvailable: true }));
    await flushPromises();
    await runNextIdle();

    expect(runAnnualReportStep).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026, periodEnd: '2026-06-10' }),
      makeProgress(1),
      true,
    );
    expect(scheduleAnnualReportNotification).toHaveBeenCalledWith(2026, new Date(now.getTime() + 10_000));
    expect(result.current.availableReport).toBe(payload);
  });

  it('開発用フラグ時は画面を開いたときに保存データを削除し、availableReport は保持する', async () => {
    const payload = makePayload(2026);
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 5, 10, 10), alwaysAvailable: true }),
    );
    await flushPromises();
    await runNextIdle();
    expect(deleteAnnualReport).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.onReportOpened();
    });
    await flushPromises();

    expect(deleteAnnualReport).toHaveBeenCalledTimes(2);
    expect(deleteAnnualReport).toHaveBeenLastCalledWith(2026);
    expect(result.current.availableReport).toBe(payload);
    expect(idleQueue).toHaveLength(0);
  });

  it('開発用フラグ時は画面を閉じたときに保存データを削除して集計をやり直し、通知は再予約しない', async () => {
    const firstPayload = makePayload(2026, 1000);
    const secondPayload = makePayload(2026, 2000);
    (runAnnualReportStep as jest.Mock)
      .mockResolvedValueOnce({ kind: 'completed', payload: firstPayload })
      .mockResolvedValueOnce({ kind: 'progressed', progress: makeProgress(2) })
      .mockResolvedValueOnce({ kind: 'completed', payload: secondPayload });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 5, 10, 10), alwaysAvailable: true }),
    );
    await flushPromises();
    await runNextIdle();
    expect(scheduleAnnualReportNotification).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.onReportClosed();
    });
    await flushPromises();

    expect(deleteAnnualReport).toHaveBeenCalledTimes(2);
    expect(idleQueue).toHaveLength(1);

    await runNextIdle();
    // 最初からやり直し、作り直しが終わるまでは直前のデータを表示し続ける
    expect(runAnnualReportStep).toHaveBeenLastCalledWith(expect.anything(), makeProgress(1), true);
    expect(result.current.availableReport).toBe(firstPayload);

    await runNextIdle();
    expect(completeAnnualReport).toHaveBeenLastCalledWith(2026, secondPayload);
    expect(result.current.availableReport).toBe(secondPayload);
    expect(scheduleAnnualReportNotification).toHaveBeenCalledTimes(1);
  });

  it('開発用フラグ時に集計中に閉じたら、実行中のステップを待ってから最初に戻す', async () => {
    let resolveStep: (value: unknown) => void = () => undefined;
    (runAnnualReportStep as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStep = resolve;
        }),
    );

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 5, 10, 10), alwaysAvailable: true }),
    );
    await flushPromises();
    await runNextIdle();

    await act(async () => {
      result.current.onReportClosed();
    });
    await flushPromises();
    // ステップ実行中は新しいステップを同時に予約しない
    expect(idleQueue).toHaveLength(0);

    await act(async () => {
      resolveStep({ kind: 'progressed', progress: makeProgress(2) });
    });
    await flushPromises();

    // 実行中だった結果は保存せず捨て、最初の月から予約し直す
    expect(saveAnnualReportProgress).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(1);
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'progressed', progress: makeProgress(2) });
    await runNextIdle();
    expect(runAnnualReportStep).toHaveBeenLastCalledWith(expect.anything(), makeProgress(1), true);
  });

  it('評価の読み込み中にループが完了しても、古い進捗で完成済みの行を上書きしない', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValueOnce({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });

    await renderHook(() => useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 10), alwaysAvailable: false }));
    await flushPromises();
    expect(idleQueue).toHaveLength(1);

    // ループ実行中に前面復帰の評価が始まり、完了前の古い記録(11月まで)を読む
    let resolveRead: (value: unknown) => void = () => undefined;
    (getAnnualReport as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    await emitAppState('active');

    await runNextIdle();
    expect(completeAnnualReport).toHaveBeenCalledWith(2026, payload);

    await act(async () => {
      resolveRead({ year: 2026, status: 'in_progress', progress: makeProgress(12), notificationScheduledAt: null });
    });
    await flushPromises();

    expect(idleQueue).toHaveLength(0);
    expect(saveAnnualReportProgress).not.toHaveBeenCalled();
    expect(runAnnualReportStep).toHaveBeenCalledTimes(1);
  });

  it('ループが止まっている間に始まった評価でも、読み込み中に別のループが動いたら古い記録から始めない', async () => {
    const firstPayload = makePayload(2026, 1000);
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload: firstPayload });

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 5, 10, 10), alwaysAvailable: true }),
    );
    await flushPromises();
    await runNextIdle();

    // 前面復帰の評価の読み込みを止めておき、その間に閉じる操作で作り直しを始める
    let resolveRead: (value: unknown) => void = () => undefined;
    (getAnnualReport as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    await emitAppState('active');
    await act(async () => {
      result.current.onReportClosed();
    });
    await flushPromises();
    expect(idleQueue).toHaveLength(1);

    await act(async () => {
      resolveRead({ year: 2026, status: 'in_progress', progress: makeProgress(7), notificationScheduledAt: null });
    });
    await flushPromises();

    // 作り直しのループ1本だけが予約されている
    expect(idleQueue).toHaveLength(1);
  });

  it('開発用フラグ時は、作り直し中の通知タップを覚えておき、完成したら開く', async () => {
    const payload = makePayload(2026);
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });
    const onDeferredOpen = jest.fn();

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 5, 10, 10), alwaysAvailable: true, onDeferredOpen }),
    );
    await flushPromises();
    // 起動時の削除で作り直し中のため、まだ表示できない
    expect(result.current.hasEvaluated).toBe(true);
    expect(result.current.availableReport).toBeNull();

    await act(async () => {
      result.current.deferNotificationOpen(2026);
    });
    expect(onDeferredOpen).not.toHaveBeenCalled();

    await runNextIdle();

    expect(result.current.availableReport).toBe(payload);
    expect(onDeferredOpen).toHaveBeenCalledTimes(1);
  });

  it('開発用フラグなしでは、表示できない通知タップを覚えずに地図のままにする', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue({
      year: 2026,
      status: 'in_progress',
      progress: makeProgress(13),
      notificationScheduledAt: null,
    });
    (runAnnualReportStep as jest.Mock).mockResolvedValueOnce({ kind: 'completed', payload });
    const onDeferredOpen = jest.fn();

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 10), alwaysAvailable: false, onDeferredOpen }),
    );
    await flushPromises();
    await act(async () => {
      result.current.deferNotificationOpen(2026);
    });
    await runNextIdle();

    expect(result.current.availableReport).toBe(payload);
    expect(onDeferredOpen).not.toHaveBeenCalled();
  });

  it('Sentry への記録が失敗しても未処理の Promise 拒否にしない', async () => {
    (reportInvestigatedError as jest.Mock).mockImplementationOnce(() => {
      throw new Error('sentry down');
    });
    (getAnnualReport as jest.Mock).mockRejectedValueOnce(new Error('db locked'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }),
    );
    await flushPromises();

    expect(reportInvestigatedError).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Failed to report annual report error:', expect.any(Error));
    expect(result.current.hasEvaluated).toBe(true);
  });

  it('開発用フラグなしでは開閉で保存データを削除しない', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 10), alwaysAvailable: false }),
    );
    await flushPromises();

    await act(async () => {
      result.current.onReportOpened();
      result.current.onReportClosed();
    });
    await flushPromises();

    expect(deleteAnnualReport).not.toHaveBeenCalled();
    expect(idleQueue).toHaveLength(0);
    expect(result.current.availableReport).toBe(payload);
  });

  it('初回の評価が終わると hasEvaluated が true になる', async () => {
    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 10, 24, 10), alwaysAvailable: false }),
    );
    await flushPromises();

    expect(result.current.hasEvaluated).toBe(true);
  });
  it('前面復帰と通知タップが同時に届き、評価があとから終わって表示できるようになったら一度だけ開く', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));
    const onDeferredOpen = jest.fn();
    let current = new Date(2026, 11, 19, 22);

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false, onDeferredOpen }),
    );
    await flushPromises();
    // 12/19 はまだ公開期間前のため表示できない
    expect(result.current.availableReport).toBeNull();

    // 12/20 9:00 に背面から通知タップで戻る。前面復帰の評価は読み込み待ちのまま、タップの処理が先に届く
    current = new Date(2026, 11, 20, 9);
    let resolveRead: (value: unknown) => void = () => undefined;
    (getAnnualReport as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    await emitAppState('active');
    await act(async () => {
      result.current.deferNotificationOpen(2026);
    });
    expect(onDeferredOpen).not.toHaveBeenCalled();

    await act(async () => {
      resolveRead(completedRecord(payload));
    });
    await flushPromises();

    expect(result.current.availableReport).toBe(payload);
    expect(onDeferredOpen).toHaveBeenCalledTimes(1);

    // 以降の評価で再び開くことはない
    await emitAppState('active');
    expect(onDeferredOpen).toHaveBeenCalledTimes(1);
  });

  it('開発用フラグなしで、次の評価でも表示できなければ待っていた通知タップを忘れる', async () => {
    const payload = makePayload(2026);
    const onDeferredOpen = jest.fn();
    let current = new Date(2026, 11, 19, 22);
    (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false, onDeferredOpen }),
    );
    await flushPromises();

    // 評価が走っていない状態でタップされたら、すぐ評価し直す。まだ公開期間前なので開かない
    const callsBefore = (getAnnualReport as jest.Mock).mock.calls.length;
    await act(async () => {
      result.current.deferNotificationOpen(2026);
    });
    await flushPromises();
    expect((getAnnualReport as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
    expect(onDeferredOpen).not.toHaveBeenCalled();

    // 後で公開期間に入って表示できるようになっても、忘れた通知タップでは開かない
    current = new Date(2026, 11, 20, 9);
    await emitAppState('active');
    expect(result.current.availableReport).toBe(payload);
    expect(onDeferredOpen).not.toHaveBeenCalled();
  });
  describe('すべてのデータを削除したあと resetAfterDataDeletion', () => {
    it('表示中のレポートを消し、対象年の予約済み通知を取り消す', async () => {
      const payload = makePayload(2026);
      (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));

      const { result } = await renderHook(() =>
        useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 10), alwaysAvailable: false }),
      );
      await flushPromises();
      expect(result.current.availableReport).toBe(payload);

      await act(async () => {
        result.current.resetAfterDataDeletion();
      });
      await flushPromises();

      expect(result.current.availableReport).toBeNull();
      expect(result.current.daysLeft).toBeNull();
      expect(cancelAnnualReportNotification).toHaveBeenCalledWith(2026);
    });

    it('実行中のステップの結果を捨て、進捗を保存せず次のステップも予約しない', async () => {
      let resolveStep: (value: unknown) => void = () => undefined;
      (runAnnualReportStep as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStep = resolve;
          }),
      );

      const { result } = await renderHook(() =>
        useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }),
      );
      await flushPromises();
      await runNextIdle();

      await act(async () => {
        result.current.resetAfterDataDeletion();
      });
      await act(async () => {
        resolveStep({ kind: 'progressed', progress: makeProgress(2) });
      });
      await flushPromises();

      expect(saveAnnualReportProgress).not.toHaveBeenCalled();
      expect(idleQueue).toHaveLength(0);
    });

    it('実行中のステップが完了しても、削除済みのレポートを保存し直さない', async () => {
      let resolveStep: (value: unknown) => void = () => undefined;
      (runAnnualReportStep as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStep = resolve;
          }),
      );

      const { result } = await renderHook(() =>
        useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 10), alwaysAvailable: false }),
      );
      await flushPromises();
      await runNextIdle();

      await act(async () => {
        result.current.resetAfterDataDeletion();
      });
      await act(async () => {
        resolveStep({ kind: 'completed', payload: makePayload(2026) });
      });
      await flushPromises();

      expect(completeAnnualReport).not.toHaveBeenCalled();
      expect(scheduleAnnualReportNotification).not.toHaveBeenCalled();
      expect(result.current.availableReport).toBeNull();
    });

    it('削除後の前面復帰では、保存済みの最初から集計をやり直せる', async () => {
      const { result } = await renderHook(() =>
        useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 17, 10), alwaysAvailable: false }),
      );
      await flushPromises();
      expect(idleQueue).toHaveLength(1);

      await act(async () => {
        result.current.resetAfterDataDeletion();
      });
      // 予約済みのステップは取り消される
      expect(idleQueue).toHaveLength(0);

      await emitAppState('active');
      expect(idleQueue).toHaveLength(1);
    });
  });

  it('開発用フラグなしでは、保存済みの行が無くなった年のメモリ上のレポートを表示し続けない', async () => {
    const payload = makePayload(2026);
    (getAnnualReport as jest.Mock).mockResolvedValueOnce(completedRecord(payload));

    const { result } = await renderHook(() =>
      useAnnualReportState({ isReady: true, now: () => new Date(2026, 11, 21, 10), alwaysAvailable: false }),
    );
    await flushPromises();
    expect(result.current.availableReport).toBe(payload);

    (getAnnualReport as jest.Mock).mockResolvedValue(null);
    await emitAppState('active');

    expect(result.current.availableReport).toBeNull();
  });
  describe('前面のまま日付をまたいだとき', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('次の0時を過ぎたら評価し直し、公開開始日ならレポートを表示する', async () => {
      jest.useFakeTimers();
      const payload = makePayload(2026);
      (getAnnualReport as jest.Mock).mockResolvedValue(completedRecord(payload));
      let current = new Date(2026, 11, 19, 23, 59, 0);

      const { result } = await renderHook(() => useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false }));
      await flushPromises();
      expect(result.current.availableReport).toBeNull();
      const callsBefore = (getAnnualReport as jest.Mock).mock.calls.length;

      // 0時の直前ではまだ評価し直さない
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect((getAnnualReport as jest.Mock).mock.calls.length).toBe(callsBefore);

      current = new Date(2026, 11, 20, 0, 0, 5);
      await act(async () => {
        jest.advanceTimersByTime(35_000);
      });
      await flushPromises();

      expect((getAnnualReport as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
      expect(result.current.availableReport).toBe(payload);
      expect(result.current.daysLeft).not.toBeNull();
    });

    it('背面に回ったら0時の評価を予約しない', async () => {
      jest.useFakeTimers();
      (getAnnualReport as jest.Mock).mockResolvedValue(null);
      const current = new Date(2026, 11, 19, 23, 59, 0);

      await renderHook(() => useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false }));
      await flushPromises();
      await emitAppState('background');
      const callsBefore = (getAnnualReport as jest.Mock).mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(2 * 60_000);
      });
      await flushPromises();

      expect((getAnnualReport as jest.Mock).mock.calls.length).toBe(callsBefore);
    });

    it('アンマウントしたら0時の評価を取り消す', async () => {
      jest.useFakeTimers();
      (getAnnualReport as jest.Mock).mockResolvedValue(null);
      const current = new Date(2026, 11, 19, 23, 59, 0);

      const { unmount } = await renderHook(() => useAnnualReportState({ isReady: true, now: () => current, alwaysAvailable: false }));
      await flushPromises();
      const callsBefore = (getAnnualReport as jest.Mock).mock.calls.length;
      await unmount();

      await act(async () => {
        jest.advanceTimersByTime(2 * 60_000);
      });

      expect((getAnnualReport as jest.Mock).mock.calls.length).toBe(callsBefore);
    });
  });
});
