import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { usePremiumAccess, UsePremiumAccessResult } from '@/app/hooks/usePremiumAccess';
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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UsePremiumAccessResult) => void;
};

/** hookを実行するための最小コンポーネント。 */
function HookProbe({ onResult }: HookProbeProps) {
  const result = usePremiumAccess();
  onResult(result);
  return null;
}

describe('課金状態フック usePremiumAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDefaultPremiumAccessState as jest.Mock).mockReturnValue(PLUS_INACTIVE_STATE);
  });

  describe('初期状態', () => {
    it('初期 premiumAccessState は getDefaultPremiumAccessState の戻り値になる', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.premiumAccessState).toEqual(PLUS_INACTIVE_STATE);
    });

    it('初期 isPremiumAccessPendingForIcon は true になる', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isPremiumAccessPendingForIcon).toBe(true);
    });

    it('初期 isPremiumPaywallVisible は false になる', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isPremiumPaywallVisible).toBe(false);
    });

    it('初期 isLoadingPremiumOffering は false になる', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isLoadingPremiumOffering).toBe(false);
    });
  });

  describe('subscribePremiumAccessStateUpdates の購読', () => {
    it('マウント時に subscribePremiumAccessStateUpdates を呼ぶ', () => {
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={() => undefined} />);
      });

      expect(subscribePremiumAccessStateUpdates).toHaveBeenCalledTimes(1);
    });

    it('アンマウント時に解除関数を呼ぶ', () => {
      const unsubscribe = jest.fn();
      (subscribePremiumAccessStateUpdates as jest.Mock).mockReturnValue(unsubscribe);

      let renderer: ReturnType<typeof ReactTestRenderer.create>;
      act(() => {
        renderer = ReactTestRenderer.create(<HookProbe onResult={() => undefined} />);
      });

      act(() => {
        renderer.unmount();
      });

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('購読コールバックが呼ばれると premiumAccessState が更新される', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      expect(result!.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);
    });

    it('購読コールバックが呼ばれると isPremiumAccessPendingForIcon が false になる', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      expect(result!.isPremiumAccessPendingForIcon).toBe(false);
    });

    it('購読コールバックが呼ばれると syncMonthlyReportNotification を呼ぶ', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={() => undefined} />);
      });

      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      expect(syncMonthlyReportNotification).toHaveBeenCalledWith(true);
    });
  });

  describe('openPremiumPaywall / closePremiumPaywall', () => {
    it('openPremiumPaywall を呼ぶと isPremiumPaywallVisible が true になる', () => {
      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.openPremiumPaywall();
      });

      expect(result!.isPremiumPaywallVisible).toBe(true);
    });

    it('closePremiumPaywall を呼ぶと isPremiumPaywallVisible が false になる', () => {
      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.openPremiumPaywall();
      });

      act(() => {
        result!.closePremiumPaywall();
      });

      expect(result!.isPremiumPaywallVisible).toBe(false);
    });

    it('ペイウォールが表示中に openPremiumPaywall を再度呼んでも二重表示にならない', () => {
      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.openPremiumPaywall();
        result!.openPremiumPaywall();
      });

      expect(result!.isPremiumPaywallVisible).toBe(true);
    });
  });

  describe('showPremiumLockedMessage', () => {
    it('showPremiumLockedMessage を呼ぶと Alert.alert を呼ぶ', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.showPremiumLockedMessage('カスタムアイコン');
      });

      expect(alertSpy).toHaveBeenCalledWith('Strollia Plus限定', expect.stringContaining('カスタムアイコン'));

      alertSpy.mockRestore();
    });

    it('showPremiumLockedMessage を呼ぶと Haptics.selectionAsync を呼ぶ', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.showPremiumLockedMessage('カスタムアイコン');
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
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.purchasePremiumPackageFromSettings('monthly');
      });

      expect(result!.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);

      alertSpy.mockRestore();
    });

    it('購入成功で Plus 有効なら ペイウォールが閉じる', async () => {
      (purchasePremiumPackage as jest.Mock).mockResolvedValue({
        status: 'purchased',
        accessState: PLUS_ACTIVE_STATE,
      });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.openPremiumPaywall();
      });

      await act(async () => {
        await result!.purchasePremiumPackageFromSettings('monthly');
      });

      expect(result!.isPremiumPaywallVisible).toBe(false);

      alertSpy.mockRestore();
    });

    it('二重実行防止: 購入中に再度呼ばれても purchasePremiumPackage は1回しか呼ばれない', async () => {
      let resolve: (value: unknown) => void = () => undefined;
      (purchasePremiumPackage as jest.Mock).mockReturnValue(
        new Promise((res) => {
          resolve = res;
        }),
      );
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      let firstCall: Promise<void>;
      act(() => {
        firstCall = result!.purchasePremiumPackageFromSettings('monthly');
      });

      act(() => {
        result!.purchasePremiumPackageFromSettings('monthly').catch(() => undefined);
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
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.restorePurchasesFromSettings();
      });

      expect(result!.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);

      alertSpy.mockRestore();
    });

    it('復元成功で Plus 有効なら ペイウォールが閉じる', async () => {
      (restorePremiumPurchases as jest.Mock).mockResolvedValue(PLUS_ACTIVE_STATE);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.openPremiumPaywall();
      });

      await act(async () => {
        await result!.restorePurchasesFromSettings();
      });

      expect(result!.isPremiumPaywallVisible).toBe(false);

      alertSpy.mockRestore();
    });
  });

  describe('openPremiumCustomerCenter', () => {
    it('presentPremiumCustomerCenter が true を返すとき Alert は呼ばれない', async () => {
      (presentPremiumCustomerCenter as jest.Mock).mockResolvedValue(true);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.openPremiumCustomerCenter();
      });

      expect(alertSpy).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('presentPremiumCustomerCenter が false を返すとき Alert を呼ぶ', async () => {
      (presentPremiumCustomerCenter as jest.Mock).mockResolvedValue(false);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.openPremiumCustomerCenter();
      });

      expect(alertSpy).toHaveBeenCalledWith('Strollia Plus', expect.any(String));

      alertSpy.mockRestore();
    });
  });

  describe('initializePremiumAccess', () => {
    it('confirmed=true のとき isPremiumAccessPendingForIcon が false になる', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const initialVersion = result!.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result!.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_ACTIVE_STATE),
          result: { state: PLUS_ACTIVE_STATE, timedOut: false, confirmed: true },
          signal,
        });
      });

      expect(result!.isPremiumAccessPendingForIcon).toBe(false);
    });

    it('confirmed=false のとき isPremiumAccessPendingForIcon は true のまま', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const initialVersion = result!.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result!.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_INACTIVE_STATE),
          result: { state: PLUS_INACTIVE_STATE, timedOut: false, confirmed: false },
          signal,
        });
      });

      expect(result!.isPremiumAccessPendingForIcon).toBe(true);
    });

    it('state が premiumAccessState に反映される', () => {
      let result: UsePremiumAccessResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const initialVersion = result!.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result!.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_ACTIVE_STATE),
          result: { state: PLUS_ACTIVE_STATE, timedOut: false, confirmed: true },
          signal,
        });
      });

      expect(result!.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);
    });

    it('initialVersion が現在のバージョンと一致しない場合は setState しない', () => {
      let onUpdate: (state: PremiumAccessState) => void = () => undefined;
      (subscribePremiumAccessStateUpdates as jest.Mock).mockImplementation((cb) => {
        onUpdate = cb;
        return jest.fn();
      });

      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const initialVersion = result!.snapshotPremiumAccessUpdateVersion();

      // 購読コールバックでバージョンを進める
      act(() => {
        onUpdate(PLUS_ACTIVE_STATE);
      });

      const signal = new AbortController().signal;

      act(() => {
        result!.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_INACTIVE_STATE),
          result: { state: PLUS_INACTIVE_STATE, timedOut: false, confirmed: false },
          signal,
        });
      });

      // 購読コールバックが後勝ちのため、PLUS_ACTIVE_STATE のまま
      expect(result!.premiumAccessState).toEqual(PLUS_ACTIVE_STATE);
    });

    it('isLoadingPremiumOffering が true になってから getPremiumOfferingSummary 完了後に false になる', async () => {
      let resolveOffering: (value: null) => void = () => undefined;
      (getPremiumOfferingSummary as jest.Mock).mockReturnValue(
        new Promise((res) => {
          resolveOffering = res;
        }),
      );

      let result: UsePremiumAccessResult | undefined;
      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const initialVersion = result!.snapshotPremiumAccessUpdateVersion();
      const signal = new AbortController().signal;

      act(() => {
        result!.initializePremiumAccess({
          initialVersion,
          initialPremiumAccessRequest: Promise.resolve(PLUS_INACTIVE_STATE),
          result: { state: PLUS_INACTIVE_STATE, timedOut: false, confirmed: true },
          signal,
        });
      });

      expect(result!.isLoadingPremiumOffering).toBe(true);

      await act(async () => {
        resolveOffering(null);
        await Promise.resolve();
      });

      expect(result!.isLoadingPremiumOffering).toBe(false);
    });
  });
});
