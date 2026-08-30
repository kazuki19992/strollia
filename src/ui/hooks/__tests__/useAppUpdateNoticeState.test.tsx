import { act, renderHook } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import type { AppUpdateNotice } from '@/features/app-update/updateNotices';
import { LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY } from '@/features/app-update/updateNotices';
import { getStrolliaStoreUrl } from '@/config/storeUrls';
import { setSetting } from '@/features/settings/settingsRepository';
import { MODAL_EXIT_SETTLE_BUFFER_MS, MODAL_EXIT_TRANSITION_DURATION_MS } from '@/ui/constants/modalTransitions';
import { appendFirstLaunchUpdateNoticeAcknowledgement, useAppUpdateNoticeState } from '@/ui/hooks/useAppUpdateNoticeState';
import type { UseAppUpdateNoticeStateOptions } from '@/ui/hooks/useAppUpdateNoticeState';

jest.mock('@/features/settings/settingsRepository', () => ({
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/config/storeUrls', () => ({
  getStrolliaStoreUrl: jest.fn(() => 'https://example.com/store'),
}));

/** 現在版と一致するテスト用の更新通知。 */
const UPDATE_NOTICE: AppUpdateNotice = {
  version: '1.3.0',
  kind: 'feature',
  items: ['地図を改善'],
};

/** 更新通知状態フックの標準入力を作る。 */
function makeOptions(overrides: Partial<Parameters<typeof useAppUpdateNoticeState>[0]> = {}) {
  return {
    nativeApplicationVersion: '1.3.0',
    latestUpdateNotice: UPDATE_NOTICE,
    isFirstLaunchTutorialVisible: false,
    hasActiveAchievementNotification: false,
    hasSelectedAchievement: false,
    isPremiumPaywallVisible: false,
    hasSelectedPhoto: false,
    hasSelectedPhotoCluster: false,
    isProcessingGpxImport: false,
    isPhotoDeletedDialogVisible: false,
    isPhotoLibrarySyncDialogVisible: false,
    ...overrides,
  };
}

/** ネイティブ版を差し替えるフックテスト用props。 */
type NativeVersionProps = { nativeApplicationVersion: string | null };
/** モーダル待機を切り替えるフックテスト用props。 */
type NoticeStateProps = { options: UseAppUpdateNoticeStateOptions };

describe('更新通知状態フック useAppUpdateNoticeState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (setSetting as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('現在のネイティブ版と通知版が完全一致するときだけ現在通知を解決する', () => {
    const { result, rerender } = renderHook(
      ({ nativeApplicationVersion }: NativeVersionProps) => useAppUpdateNoticeState(makeOptions({ nativeApplicationVersion })),
      {
        initialProps: { nativeApplicationVersion: '1.3.0' as string | null },
      },
    );

    expect(result.current.currentAppUpdateNotice).toEqual(UPDATE_NOTICE);

    rerender({ nativeApplicationVersion: '1.3.0.1' });
    expect(result.current.currentAppUpdateNotice).toBeNull();
  });

  test('新規インストールはチュートリアル完了と現在版の既読を同じ保存配列へ入れる', () => {
    expect(appendFirstLaunchUpdateNoticeAcknowledgement([{ key: 'firstLaunchTutorialCompleted', value: true }], UPDATE_NOTICE)).toEqual([
      { key: 'firstLaunchTutorialCompleted', value: true },
      { key: LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, value: '1.3.0' },
    ]);
  });

  test('自動表示を要求するとautomatic起点でダイアログを表示する', () => {
    const { result } = renderHook(() => useAppUpdateNoticeState(makeOptions()));

    act(() => {
      result.current.openAutomaticAppUpdateNotice();
    });

    expect(result.current.appUpdateNoticeDialogSource).toBe('automatic');
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(true);
  });

  test.each([
    ['初回チュートリアル', { isFirstLaunchTutorialVisible: true }],
    ['実績通知', { hasActiveAchievementNotification: true }],
    ['実績詳細', { hasSelectedAchievement: true }],
    ['Paywall', { isPremiumPaywallVisible: true }],
    ['写真プレビュー', { hasSelectedPhoto: true }],
    ['写真クラスタプレビュー', { hasSelectedPhotoCluster: true }],
    ['GPX処理', { isProcessingGpxImport: true }],
    ['削除済み写真の案内', { isPhotoDeletedDialogVisible: true }],
    ['写真ライブラリの再読み込み', { isPhotoLibrarySyncDialogVisible: true }],
  ])('%s の表示中は更新通知を待機し、退場時間の経過後に表示する', (_label, blockingState) => {
    const { result, rerender } = renderHook(({ options }: NoticeStateProps) => useAppUpdateNoticeState(options), {
      initialProps: { options: makeOptions(blockingState) },
    });

    act(() => {
      result.current.openAutomaticAppUpdateNotice();
    });
    expect(result.current.appUpdateNoticeDialogSource).toBe('automatic');
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(false);

    rerender({ options: makeOptions() });
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(false);
    act(() => {
      jest.advanceTimersByTime(MODAL_EXIT_TRANSITION_DURATION_MS + MODAL_EXIT_SETTLE_BUFFER_MS - 1);
    });
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(true);
  });

  test('先行モーダルの退場待機中に別のブロッカーが現れたら待機をリセットする', () => {
    const { result, rerender } = renderHook(({ options }: NoticeStateProps) => useAppUpdateNoticeState(options), {
      initialProps: { options: makeOptions({ isFirstLaunchTutorialVisible: true }) },
    });

    act(() => {
      result.current.openAutomaticAppUpdateNotice();
    });
    rerender({ options: makeOptions() });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    rerender({ options: makeOptions({ isPremiumPaywallVisible: true }) });
    act(() => {
      jest.advanceTimersByTime(MODAL_EXIT_TRANSITION_DURATION_MS + MODAL_EXIT_SETTLE_BUFFER_MS);
    });
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(false);

    rerender({ options: makeOptions() });
    act(() => {
      jest.advanceTimersByTime(MODAL_EXIT_TRANSITION_DURATION_MS + MODAL_EXIT_SETTLE_BUFFER_MS - 1);
    });
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(true);
  });

  test('設定から開いて閉じても既読版を保存しない', () => {
    const { result } = renderHook(() => useAppUpdateNoticeState(makeOptions()));

    act(() => {
      result.current.openLatestAppUpdateNotice();
    });
    expect(result.current.appUpdateNoticeDialogSource).toBe('settings');
    act(() => {
      result.current.closeAppUpdateNotice();
    });

    expect(result.current.appUpdateNoticeDialogSource).toBeNull();
    expect(setSetting).not.toHaveBeenCalled();
  });

  test('自動表示を閉じると現在の通知版を既読として保存する', () => {
    const { result } = renderHook(() => useAppUpdateNoticeState(makeOptions()));

    act(() => {
      result.current.openAutomaticAppUpdateNotice();
    });
    act(() => {
      result.current.closeAppUpdateNotice();
    });

    expect(result.current.appUpdateNoticeDialogSource).toBeNull();
    expect(setSetting).toHaveBeenCalledWith(LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, '1.3.0');
  });

  test('既読保存に失敗してもダイアログを閉じ、警告を残す', async () => {
    const error = new Error('DB失敗');
    (setSetting as jest.Mock).mockRejectedValue(error);
    const { result } = renderHook(() => useAppUpdateNoticeState(makeOptions()));

    act(() => {
      result.current.openAutomaticAppUpdateNotice();
    });
    act(() => {
      result.current.closeAppUpdateNotice();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.appUpdateNoticeDialogSource).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('Failed to persist app update notice acknowledgement:', error);
  });

  test('現在版通知がないときは設定から開かない', () => {
    const { result } = renderHook(() => useAppUpdateNoticeState(makeOptions({ nativeApplicationVersion: '1.3.1' })));

    act(() => {
      result.current.openLatestAppUpdateNotice();
    });

    expect(result.current.appUpdateNoticeDialogSource).toBeNull();
    expect(result.current.isAppUpdateNoticeDialogVisible).toBe(false);
  });

  test('ストア表示に失敗してもダイアログ状態を閉じず、警告を残す', async () => {
    const error = new Error('URL失敗');
    jest.spyOn(Linking, 'openURL').mockRejectedValue(error);
    const { result } = renderHook(() => useAppUpdateNoticeState(makeOptions()));

    act(() => {
      result.current.openLatestAppUpdateNotice();
    });
    await act(async () => {
      await result.current.openAppStorePage();
    });

    expect(getStrolliaStoreUrl).toHaveBeenCalledWith(Platform.OS);
    expect(result.current.appUpdateNoticeDialogSource).toBe('settings');
    expect(console.warn).toHaveBeenCalledWith('Failed to open app store page:', error);
  });
});
