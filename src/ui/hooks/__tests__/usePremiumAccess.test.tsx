import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { usePremiumAccess, UsePremiumAccessResult } from '@/ui/hooks/usePremiumAccess';
import {
  getDefaultPremiumAccessState,
  PremiumAccessState,
  subscribePremiumAccessStateUpdates,
  purchasePremiumPackage,
  restorePremiumPurchases,
  presentPremiumCustomerCenter,
  getPremiumOfferingSummary,
} from '@/features/premium/revenueCatAccess';
import { syncMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
  subscribePremiumAccessStateUpdates: jest.fn(() => jest.fn()),
  purchasePremiumPackage: jest.fn(),
  restorePremiumPurchases: jest.fn(),
  presentPremiumCustomerCenter: jest.fn(),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  getRevenueCatAppUserId: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/reports/monthlyReportNotificationService', () => ({
  syncMonthlyReportNotification: jest.fn().mockResolvedValue(undefined),
}));

/** テスト用の Plus 有効な状態。 */
const PLUS_ACTIVE_STATE: PremiumAccessState = { isPlusActive: true, entitlementId: 'strollia_plus' };
/** テスト用の Plus 無効な状態。 */
const PLUS_INACTIVE_STATE: PremiumAccessState = { isPlusActive: false, entitlementId: 'strollia_plus' };

describe('課金状態フック usePremiumAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDefaultPremiumAccessState as jest.Mock).mockReturnValue(PLUS_INACTIVE_STATE);
  });

  describe('初期状態', () => {
    it('初期 premiumAccessState は getDefaultPremiumAccessState の戻り値になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      expect(result.current.premiumAccessState).toEqual(PLUS_INACTIVE_STATE);
    });

    it('初期 isPremiumAccessPendingForIcon は true になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      expect(result.current.isPremiumAccessPendingForIcon).toBe(true);
    });

    it('初期 isPremiumPaywallVisible は false になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      expect(result.current.isPremiumPaywallVisible).toBe(false);
    });

    it('初期 isLoadingPremiumOffering は false になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      expect(result.current.isLoadingPremiumOffering).toBe(false);
    });
  });

  describe('subscribePremiumAccessStateUpdates の購読', () => {
    it('マウント時に subscribePremiumAccessStateUpdates を呼ぶ', () => {
      renderHook(() => usePremiumAccess());

      expect(subscribePremiumAccessStateUpdates).toHaveBeenCalledTimes(1);
    });

    it('アンマウント時に解除関数を呼ぶ', () => {
      const unsubscribe = jest.fn();
      (subscribePremiumAccessStateUpdates as jest.Mock).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => usePremiumAccess());

      act(() => {
        unmount();
      });

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('購読コールバックが呼ばれると premiumAccessState が更新される', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      expect(result.current.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);
    });

    it('購読コールバックが呼ばれると isPremiumAccessPendingForIcon が false になる', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      expect(result.current.isPremiumAccessPendingForIcon).toBe(false);
    });

    it('購読コールバックが呼ばれると syncMonthlyReportNotification を呼ぶ', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      renderHook(() => usePremiumAccess());

      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      expect(syncMonthlyReportNotification).toHaveBeenCalledWith(true);
    });
  });

  describe('openPremiumPaywall / closePremiumPaywall', () => {
    it('openPremiumPaywall を呼ぶと isPremiumPaywallVisible が true になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.openPremiumPaywall();
      });

      expect(result.current.isPremiumPaywallVisible).toBe(true);
    });

    it('closePremiumPaywall を呼ぶと isPremiumPaywallVisible が false になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.openPremiumPaywall();
      });

      act(() => {
        result.current.closePremiumPaywall();
      });

      expect(result.current.isPremiumPaywallVisible).toBe(false);
    });

    it('ペイウォールが表示中に openPremiumPaywall を再度呼んでも二重表示にならない', () => {
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.openPremiumPaywall();
        result.current.openPremiumPaywall();
      });

      expect(result.current.isPremiumPaywallVisible).toBe(true);
    });
  });

  describe('showPremiumLockedMessage', () => {
    it('showPremiumLockedMessage を呼ぶと Alert.alert を呼ぶ', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.showPremiumLockedMessage('カスタムアイコン');
      });

      expect(alertSpy).toHaveBeenCalledWith('Strollia Plus限定', expect.stringContaining('カスタムアイコン'));

      alertSpy.mockRestore();
    });

    it('showPremiumLockedMessage を呼ぶと Haptics.selectionAsync を呼ぶ', () => {
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.showPremiumLockedMessage('カスタムアイコン');
      });

      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  describe('purchasePremiumPackageFromSettings', () => {
    it('購入成功で Plus 有効なら premiumAccessState が更新される', async () => {
      (purchasePremiumPackage as jest.Mock).mockResolvedValue({
        status: 'purchased',
        accessState: PLUS_ACTIVE_STATE,
      });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      await act(async () => {
        await result.current.purchasePremiumPackageFromSettings('monthly');
      });

      expect(result.current.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);

      alertSpy.mockRestore();
    });

    it('購入成功で Plus 有効なら ペイウォールが閉じる', async () => {
      (purchasePremiumPackage as jest.Mock).mockResolvedValue({
        status: 'purchased',
        accessState: PLUS_ACTIVE_STATE,
      });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.openPremiumPaywall();
      });

      await act(async () => {
        await result.current.purchasePremiumPackageFromSettings('monthly');
      });

      expect(result.current.isPremiumPaywallVisible).toBe(false);

      alertSpy.mockRestore();
    });

    it('二重実行防止: 購入中に再度呼ばれても purchasePremiumPackage は1回しか呼ばれない', async () => {
      let resolve: (value: unknown) => void = () => undefined;
      (purchasePremiumPackage as jest.Mock).mockReturnValue(
        new Promise((res) => {
          resolve = res;
        }),
      );
      const { result } = renderHook(() => usePremiumAccess());

      let firstCall: Promise<void>;
      act(() => {
        firstCall = result.current.purchasePremiumPackageFromSettings('monthly');
      });

      act(() => {
        result.current.purchasePremiumPackageFromSettings('monthly').catch(() => undefined);
      });

      resolve({ status: 'cancelled', accessState: PLUS_INACTIVE_STATE });

      await act(async () => {
        await firstCall!;
      });

      expect(purchasePremiumPackage).toHaveBeenCalledTimes(1);
    });
  });

  describe('restorePurchasesFromSettings', () => {
    it('復元成功で Plus 有効なら premiumAccessState が更新される', async () => {
      (restorePremiumPurchases as jest.Mock).mockResolvedValue(PLUS_ACTIVE_STATE);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      await act(async () => {
        await result.current.restorePurchasesFromSettings();
      });

      expect(result.current.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);

      alertSpy.mockRestore();
    });

    it('復元成功で Plus 有効なら ペイウォールが閉じる', async () => {
      (restorePremiumPurchases as jest.Mock).mockResolvedValue(PLUS_ACTIVE_STATE);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      act(() => {
        result.current.openPremiumPaywall();
      });

      await act(async () => {
        await result.current.restorePurchasesFromSettings();
      });

      expect(result.current.isPremiumPaywallVisible).toBe(false);

      alertSpy.mockRestore();
    });

    it('連打防止: 復元中(promise未解決)に再度呼んでも restorePremiumPurchases は1回しか呼ばれない', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      let resolveRestore: (value: typeof PLUS_INACTIVE_STATE) => void = () => undefined;
      (restorePremiumPurchases as jest.Mock).mockReturnValue(
        new Promise<typeof PLUS_INACTIVE_STATE>((res) => {
          resolveRestore = res;
        }),
      );
      const { result } = renderHook(() => usePremiumAccess());

      // 1回目呼び出し（promise 未解決のまま）
      let firstCall: Promise<void>;
      act(() => {
        firstCall = result.current.restorePurchasesFromSettings();
      });

      // 2回目呼び出し（1回目が pending 中）
      act(() => {
        result.current.restorePurchasesFromSettings().catch(() => undefined);
      });

      // 1回目を解決する
      resolveRestore(PLUS_INACTIVE_STATE);

      await act(async () => {
        await firstCall!;
      });

      // ref guard により restorePremiumPurchases は1回しか呼ばれない
      expect(restorePremiumPurchases).toHaveBeenCalledTimes(1);

      alertSpy.mockRestore();
    });
  });

  describe('openPremiumCustomerCenter', () => {
    it('presentPremiumCustomerCenter が true を返すとき Alert は呼ばれない', async () => {
      (presentPremiumCustomerCenter as jest.Mock).mockResolvedValue(true);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      await act(async () => {
        await result.current.openPremiumCustomerCenter();
      });

      expect(alertSpy).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('presentPremiumCustomerCenter が false を返すとき Alert を呼ぶ', async () => {
      (presentPremiumCustomerCenter as jest.Mock).mockResolvedValue(false);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() => usePremiumAccess());

      await act(async () => {
        await result.current.openPremiumCustomerCenter();
      });

      expect(alertSpy).toHaveBeenCalledWith('Strollia Plus', expect.any(String));

      alertSpy.mockRestore();
    });
  });

  describe('initializePremiumAccess', () => {
    it('confirmed=true のとき isPremiumAccessPendingForIcon が false になる', () => {
      const { result } = renderHook(() => usePremiumAccess());

      const initialVersion = result.current.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result.current.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_ACTIVE_STATE),
          result: { state: PLUS_ACTIVE_STATE, timedOut: false, confirmed: true },
          signal,
        });
      });

      expect(result.current.isPremiumAccessPendingForIcon).toBe(false);
    });

    it('confirmed=false のとき isPremiumAccessPendingForIcon は true のまま', () => {
      const { result } = renderHook(() => usePremiumAccess());

      const initialVersion = result.current.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result.current.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_INACTIVE_STATE),
          result: { state: PLUS_INACTIVE_STATE, timedOut: false, confirmed: false },
          signal,
        });
      });

      expect(result.current.isPremiumAccessPendingForIcon).toBe(true);
    });

    it('state が premiumAccessState に反映される', () => {
      const { result } = renderHook(() => usePremiumAccess());

      const initialVersion = result.current.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result.current.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_ACTIVE_STATE),
          result: { state: PLUS_ACTIVE_STATE, timedOut: false, confirmed: true },
          signal,
        });
      });

      expect(result.current.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);
    });

    it('initialVersion が現在のバージョンと一致しない場合は setState しない', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      const { result } = renderHook(() => usePremiumAccess());

      const initialVersion = result.current.snapshotPremiumAccessUpdateVersion();

      // 購読コールバックでバージョンを進める
      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      const signal = new AbortController().signal;

      act(() => {
        result.current.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_INACTIVE_STATE),
          result: { state: PLUS_INACTIVE_STATE, timedOut: false, confirmed: false },
          signal,
        });
      });

      // 購読コールバックが後勝ちのため、PLUS_ACTIVE_STATE のまま
      expect(result.current.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);
    });

    it('isLoadingPremiumOffering が true になってから getPremiumOfferingSummary 完了後に false になる', async () => {
      let resolveOffering: (value: null) => void = () => undefined;
      (getPremiumOfferingSummary as jest.Mock).mockReturnValue(
        new Promise((res) => {
          resolveOffering = res;
        }),
      );

      const { result } = renderHook(() => usePremiumAccess());

      const initialVersion = result.current.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result.current.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_INACTIVE_STATE),
          result: { state: PLUS_INACTIVE_STATE, timedOut: false, confirmed: true },
          signal,
        });
      });

      expect(result.current.isLoadingPremiumOffering).toBe(true);

      await act(async () => {
        resolveOffering(null);
        await Promise.resolve();
      });

      expect(result.current.isLoadingPremiumOffering).toBe(false);
    });
  });
});
