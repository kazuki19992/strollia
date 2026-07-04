import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

import {
  configureRevenueCatIfAvailable,
  createRevenueCatClient,
  getRevenueCatAppUserId,
  getPremiumAccessStateFromRevenueCat,
  getPremiumOfferingSummaryFromRevenueCat,
  purchasePremiumPackageWithRevenueCat,
  resetRevenueCatClientForTesting,
  restorePremiumPurchasesWithRevenueCat,
  subscribePremiumAccessStateUpdatesWithRevenueCat,
} from '@/features/premium/revenueCatClient';
import { STROLLIA_PLUS_ENTITLEMENT_ID } from '@/features/premium/premiumCatalog';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    getAppUserID: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: {
    presentCustomerCenter: jest.fn(),
  },
}));

const originalPlatformOS = Platform.OS;

/** テスト用: iOS + APIキー設定済みの状態にする。 */
function setupConfigured(): void {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'] = 'test-ios-api-key';
}

/** テスト用: APIキー未設定の状態にする。 */
function setupUnconfigured(): void {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  delete process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'];
  delete process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'];
}

describe('revenueCatClient RevenueCat SDKラッパー', () => {
  beforeEach(() => {
    resetRevenueCatClientForTesting();
    jest.clearAllMocks();
    delete process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'];
    delete process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'];
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
    delete process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'];
    delete process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'];
  });

  describe('configureRevenueCatIfAvailable', () => {
    it('APIキーがある場合は Purchases.configure を呼んで true を返す', () => {
      setupConfigured();

      const result = configureRevenueCatIfAvailable();

      expect(result).toBe(true);
      expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'test-ios-api-key' });
    });

    it('APIキーがない場合は configure を呼ばず false を返す', () => {
      setupUnconfigured();

      const result = configureRevenueCatIfAvailable();

      expect(result).toBe(false);
      expect(Purchases.configure).not.toHaveBeenCalled();
    });

    it('2回呼ばれても Purchases.configure は1度だけ呼ばれる', () => {
      setupConfigured();

      configureRevenueCatIfAvailable();
      configureRevenueCatIfAvailable();

      expect(Purchases.configure).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRevenueCatAppUserId', () => {
    it('設定済みの場合は Purchases.getAppUserID の戻り値を返す', async () => {
      setupConfigured();
      (Purchases.getAppUserID as jest.Mock).mockResolvedValue('user-abc');

      const result = await getRevenueCatAppUserId();

      expect(result).toBe('user-abc');
    });

    it('未設定の場合は null を返す', async () => {
      setupUnconfigured();

      const result = await getRevenueCatAppUserId();

      expect(result).toBeNull();
      expect(Purchases.getAppUserID).not.toHaveBeenCalled();
    });
  });

  describe('getPremiumAccessStateFromRevenueCat', () => {
    it('entitlement がアクティブな場合は true を返す', async () => {
      setupConfigured();
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
        entitlements: { active: { [STROLLIA_PLUS_ENTITLEMENT_ID]: {} } },
      });

      const result = await getPremiumAccessStateFromRevenueCat(STROLLIA_PLUS_ENTITLEMENT_ID);

      expect(result).toBe(true);
    });

    it('entitlement が非アクティブな場合は false を返す', async () => {
      setupConfigured();
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
        entitlements: { active: {} },
      });

      const result = await getPremiumAccessStateFromRevenueCat(STROLLIA_PLUS_ENTITLEMENT_ID);

      expect(result).toBe(false);
    });

    it('未設定の場合は Error をスローする', async () => {
      setupUnconfigured();

      await expect(getPremiumAccessStateFromRevenueCat(STROLLIA_PLUS_ENTITLEMENT_ID)).rejects.toThrow(
        'RevenueCat API key is not configured for this platform.',
      );
    });
  });

  describe('getPremiumOfferingSummaryFromRevenueCat', () => {
    it('current offering がある場合はサマリーを返す', async () => {
      setupConfigured();
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({
        current: {
          identifier: 'default',
          availablePackages: [
            {
              identifier: '$rc_monthly',
              packageType: 'MONTHLY',
              product: {
                identifier: 'strollia_plus_monthly',
                title: 'Strollia Plus 月額',
                description: '月額プラン',
                priceString: '¥300',
              },
            },
          ],
        },
      });

      const result = await getPremiumOfferingSummaryFromRevenueCat();

      expect(result).not.toBeNull();
      expect(result!.offeringId).toBe('default');
      expect(result!.packages).toHaveLength(1);
      expect(result!.packages[0].packageType).toBe('MONTHLY');
      expect(result!.packages[0].priceText).toBe('¥300');
    });

    it('current offering が null の場合は null を返す', async () => {
      setupConfigured();
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({ current: null });

      const result = await getPremiumOfferingSummaryFromRevenueCat();

      expect(result).toBeNull();
    });

    it('未設定の場合は Error をスローする', async () => {
      setupUnconfigured();

      await expect(getPremiumOfferingSummaryFromRevenueCat()).rejects.toThrow('RevenueCat API key is not configured for this platform.');
    });
  });

  describe('restorePremiumPurchasesWithRevenueCat', () => {
    it('復元後に Plus がアクティブな場合は isPlusActive=true を返す', async () => {
      setupConfigured();
      (Purchases.restorePurchases as jest.Mock).mockResolvedValue({
        entitlements: { active: { [STROLLIA_PLUS_ENTITLEMENT_ID]: {} } },
      });

      const result = await restorePremiumPurchasesWithRevenueCat();

      expect(result.isPlusActive).toBe(true);
      expect(result.entitlementId).toBe(STROLLIA_PLUS_ENTITLEMENT_ID);
    });

    it('復元後に Plus が非アクティブな場合は isPlusActive=false を返す', async () => {
      setupConfigured();
      (Purchases.restorePurchases as jest.Mock).mockResolvedValue({
        entitlements: { active: {} },
      });

      const result = await restorePremiumPurchasesWithRevenueCat();

      expect(result.isPlusActive).toBe(false);
    });

    it('未設定の場合は Error をスローする', async () => {
      setupUnconfigured();

      await expect(restorePremiumPurchasesWithRevenueCat()).rejects.toThrow('RevenueCat API key is not configured for this platform.');
    });
  });

  describe('purchasePremiumPackageWithRevenueCat', () => {
    it('monthly プランのパッケージを購入して isPlusActive=true を返す', async () => {
      setupConfigured();
      const monthlyPackage = { identifier: '$rc_monthly', packageType: 'MONTHLY' };
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({
        current: { availablePackages: [monthlyPackage] },
      });
      (Purchases.purchasePackage as jest.Mock).mockResolvedValue({
        customerInfo: { entitlements: { active: { [STROLLIA_PLUS_ENTITLEMENT_ID]: {} } } },
      });

      const result = await purchasePremiumPackageWithRevenueCat('monthly');

      expect(result.isPlusActive).toBe(true);
      expect(Purchases.purchasePackage).toHaveBeenCalledWith(monthlyPackage);
    });

    it('yearly プランのパッケージを購入して isPlusActive=true を返す', async () => {
      setupConfigured();
      const yearlyPackage = { identifier: '$rc_annual', packageType: 'ANNUAL' };
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({
        current: { availablePackages: [yearlyPackage] },
      });
      (Purchases.purchasePackage as jest.Mock).mockResolvedValue({
        customerInfo: { entitlements: { active: { [STROLLIA_PLUS_ENTITLEMENT_ID]: {} } } },
      });

      const result = await purchasePremiumPackageWithRevenueCat('yearly');

      expect(Purchases.purchasePackage).toHaveBeenCalledWith(yearlyPackage);
      expect(result.isPlusActive).toBe(true);
    });

    it('対応するパッケージが current offering に存在しない場合は Error をスローする', async () => {
      setupConfigured();
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({
        current: { availablePackages: [] },
      });

      await expect(purchasePremiumPackageWithRevenueCat('monthly')).rejects.toThrow('RevenueCat MONTHLY package is not configured.');
    });

    it('未設定の場合は Error をスローする', async () => {
      setupUnconfigured();

      await expect(purchasePremiumPackageWithRevenueCat('monthly')).rejects.toThrow(
        'RevenueCat API key is not configured for this platform.',
      );
    });
  });

  describe('subscribePremiumAccessStateUpdatesWithRevenueCat', () => {
    it('設定済みの場合は addCustomerInfoUpdateListener を呼ぶ', () => {
      setupConfigured();

      subscribePremiumAccessStateUpdatesWithRevenueCat(jest.fn());

      expect(Purchases.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    });

    it('リスナー更新があると onUpdate がアクセス状態と共に呼ばれる', () => {
      setupConfigured();
      const onUpdate = jest.fn();
      let capturedListener: ((info: unknown) => void) | null = null;
      (Purchases.addCustomerInfoUpdateListener as jest.Mock).mockImplementation((listener: (info: unknown) => void) => {
        capturedListener = listener;
      });

      subscribePremiumAccessStateUpdatesWithRevenueCat(onUpdate);
      capturedListener!({ entitlements: { active: { [STROLLIA_PLUS_ENTITLEMENT_ID]: {} } } });

      expect(onUpdate).toHaveBeenCalledWith({ isPlusActive: true, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID });
    });

    it('返却されたアンサブスクライブ関数を呼ぶと removeCustomerInfoUpdateListener が呼ばれる', () => {
      setupConfigured();

      const unsubscribe = subscribePremiumAccessStateUpdatesWithRevenueCat(jest.fn());
      unsubscribe();

      expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    });

    it('未設定の場合は何も登録せず no-op 関数を返す', () => {
      setupUnconfigured();

      const unsubscribe = subscribePremiumAccessStateUpdatesWithRevenueCat(jest.fn());

      expect(Purchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('createRevenueCatClient', () => {
    it('必要なメソッドをすべて持つクライアントオブジェクトを返す', () => {
      const client = createRevenueCatClient();

      expect(typeof client.hasActiveEntitlement).toBe('function');
      expect(typeof client.getCurrentOffering).toBe('function');
      expect(typeof client.purchasePackage).toBe('function');
      expect(typeof client.presentCustomerCenter).toBe('function');
      expect(typeof client.restorePurchases).toBe('function');
      expect(typeof client.subscribeToCustomerInfoUpdates).toBe('function');
      expect(typeof client.getAppUserId).toBe('function');
    });
  });
});
