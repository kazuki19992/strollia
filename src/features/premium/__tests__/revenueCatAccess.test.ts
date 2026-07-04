import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { developmentFlags } from '@/config/developmentFlags';
import { STROLLIA_PLUS_ENTITLEMENT_ID } from '@/features/premium/premiumCatalog';
import { getRevenueCatApiKeyForPlatform, getRevenueCatConfigureOptions } from '@/features/premium/revenueCatConfig';
import {
  createRevenueCatClient,
  getPremiumOfferingSummaryFromRevenueCat,
  resetRevenueCatClientForTesting,
  restorePremiumPurchasesWithRevenueCat,
  presentCustomerCenterWithRevenueCat,
  subscribePremiumAccessStateUpdatesWithRevenueCat,
} from '@/features/premium/revenueCatClient';
import {
  getConfirmedPremiumAccessState,
  getDefaultPremiumAccessState,
  getPremiumAccessState,
  getPremiumOfferingSummary,
  presentPremiumCustomerCenter,
  purchasePremiumPackage,
  resolvePremiumAccessState,
  resolvePremiumOfferingSummary,
  restorePremiumPurchases,
  RevenueCatClient,
} from '@/features/premium/revenueCatAccess';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getAppUserID: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
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
const originalIosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const originalAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

function setEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

describe('RevenueCat課金状態 revenueCatAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRevenueCatClientForTesting();
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', originalIosKey);
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', originalAndroidKey);
    jest.restoreAllMocks();
  });

  it('未接続時は開発用フラグに応じた既定状態を返す', () => {
    expect(getDefaultPremiumAccessState()).toEqual({
      isPlusActive: developmentFlags.enablePremiumAccessWithoutRevenueCat,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
  });

  it('RevenueCatクライアントからPlus有効状態を解決する', async () => {
    const client: RevenueCatClient = {
      hasActiveEntitlement: jest.fn().mockResolvedValue(true),
      getCurrentOffering: jest.fn().mockResolvedValue(null),
      purchasePackage: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
      presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
      restorePurchases: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
      subscribeToCustomerInfoUpdates: jest.fn(() => jest.fn()),
      getAppUserId: jest.fn().mockResolvedValue(null),
    };

    await expect(resolvePremiumAccessState(client)).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
    expect(client.hasActiveEntitlement).toHaveBeenCalledWith(STROLLIA_PLUS_ENTITLEMENT_ID);
  });

  it('RevenueCat Offeringを設定画面向けの商品概要へ変換する', async () => {
    const client: RevenueCatClient = {
      hasActiveEntitlement: jest.fn().mockResolvedValue(false),
      getCurrentOffering: jest.fn().mockResolvedValue({
        offeringId: 'default',
        packages: [
          {
            identifier: '$rc_monthly',
            packageType: 'MONTHLY',
            productIdentifier: 'strollia_plus_monthly',
            title: 'Strollia Plus Monthly',
            description: 'Monthly plan',
            priceText: '¥300',
          },
        ],
      }),
      purchasePackage: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
      presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
      restorePurchases: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
      subscribeToCustomerInfoUpdates: jest.fn(() => jest.fn()),
      getAppUserId: jest.fn().mockResolvedValue(null),
    };

    await expect(resolvePremiumOfferingSummary(client)).resolves.toEqual({
      offeringId: 'default',
      packages: [
        {
          identifier: '$rc_monthly',
          packageType: 'MONTHLY',
          productIdentifier: 'strollia_plus_monthly',
          title: 'Strollia Plus Monthly',
          description: 'Monthly plan',
          priceText: '¥300',
        },
      ],
    });
  });

  it('RevenueCat Offering未設定時は商品概要をnullにする', async () => {
    const client: RevenueCatClient = {
      hasActiveEntitlement: jest.fn().mockResolvedValue(false),
      getCurrentOffering: jest.fn().mockResolvedValue(null),
      purchasePackage: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
      presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
      restorePurchases: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID }),
      subscribeToCustomerInfoUpdates: jest.fn(() => jest.fn()),
      getAppUserId: jest.fn().mockResolvedValue(null),
    };

    await expect(resolvePremiumOfferingSummary(client)).resolves.toBeNull();
  });

  it('iOSではRevenueCatのiOS APIキーを設定に使う', () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_android_key');

    expect(getRevenueCatApiKeyForPlatform()).toBe('appl_ios_key');
    expect(getRevenueCatConfigureOptions()).toEqual({ apiKey: 'appl_ios_key' });
  });

  it('AndroidではRevenueCatのAndroid APIキーを設定に使う', () => {
    Platform.OS = 'android';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_android_key');

    expect(getRevenueCatApiKeyForPlatform()).toBe('goog_android_key');
    expect(getRevenueCatConfigureOptions()).toEqual({ apiKey: 'goog_android_key' });
  });

  it('APIキー未設定または未対応プラットフォームではRevenueCat設定を作らない', () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', undefined);
    expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    expect(getRevenueCatConfigureOptions()).toBeNull();

    Platform.OS = 'web';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_android_key');
    expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    expect(getRevenueCatConfigureOptions()).toBeNull();
  });

  it('RevenueCat CustomerInfoにstrollia_plus entitlementがあればPlus有効にする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
      entitlements: {
        active: {
          [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
        },
      },
    });

    const client = createRevenueCatClient();

    await expect(client.hasActiveEntitlement(STROLLIA_PLUS_ENTITLEMENT_ID)).resolves.toBe(true);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_ios_key' });
    expect(Purchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it('API key設定時はApp User IDを返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getAppUserID as jest.Mock).mockReturnValue('$RCAnonymousID:abc123');

    const client = createRevenueCatClient();

    await expect(client.getAppUserId()).resolves.toBe('$RCAnonymousID:abc123');
  });

  it('API key未設定時はApp User IDをnullにする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', undefined);
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', undefined);

    const client = createRevenueCatClient();

    await expect(client.getAppUserId()).resolves.toBeNull();
  });

  it('RevenueCat CustomerInfoにentitlementがなければPlus無効にする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
      entitlements: { active: {} },
    });

    const client = createRevenueCatClient();

    await expect(client.hasActiveEntitlement(STROLLIA_PLUS_ENTITLEMENT_ID)).resolves.toBe(false);
  });

  it('RevenueCatのcurrent Offeringから商品概要を取得する', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({
      current: {
        identifier: 'default',
        availablePackages: [
          {
            identifier: '$rc_annual',
            packageType: 'ANNUAL',
            product: {
              identifier: 'strollia_plus_yearly',
              title: 'Strollia Plus Annual',
              description: 'Annual plan',
              priceString: '¥2,900',
            },
          },
        ],
      },
    });

    await expect(getPremiumOfferingSummaryFromRevenueCat()).resolves.toEqual({
      offeringId: 'default',
      packages: [
        {
          identifier: '$rc_annual',
          packageType: 'ANNUAL',
          productIdentifier: 'strollia_plus_yearly',
          title: 'Strollia Plus Annual',
          description: 'Annual plan',
          priceText: '¥2,900',
        },
      ],
    });
  });

  it('RevenueCat current Offeringがない場合はnullを返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({
      current: null,
    });

    await expect(getPremiumOfferingSummaryFromRevenueCat()).resolves.toBeNull();
  });

  it('RevenueCat復元後にentitlementがあればPlus有効状態を返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.restorePurchases as jest.Mock).mockResolvedValue({
      entitlements: {
        active: {
          [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
        },
      },
    });

    await expect(restorePremiumPurchasesWithRevenueCat()).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
  });

  it('RevenueCat未設定時は既定の課金状態へフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(getPremiumAccessState()).resolves.toEqual(getDefaultPremiumAccessState());
    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('Failed to load RevenueCat premium state:', expect.any(Error));
  });

  it('RevenueCat取得失敗時は既定の課金状態へフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.getCustomerInfo as jest.Mock).mockRejectedValue(new Error('network failed'));

    await expect(getPremiumAccessState()).resolves.toEqual(getDefaultPremiumAccessState());
    expect(console.warn).toHaveBeenCalledWith('Failed to load RevenueCat premium state:', expect.any(Error));
  });

  it('確認済みPlus状態の取得はRevenueCat失敗を未加入へ変換せずエラーにする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (Purchases.getCustomerInfo as jest.Mock).mockRejectedValue(new Error('network failed'));

    await expect(getConfirmedPremiumAccessState()).rejects.toThrow('network failed');
  });

  it('RevenueCat Offering取得失敗時はnullへフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.getOfferings as jest.Mock).mockRejectedValue(new Error('network failed'));

    await expect(getPremiumOfferingSummary()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith('Failed to load RevenueCat offerings:', expect.any(Error));
  });

  it('RevenueCat復元失敗時は既定の課金状態へフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.restorePurchases as jest.Mock).mockRejectedValue(new Error('restore failed'));

    await expect(restorePremiumPurchases()).resolves.toEqual(getDefaultPremiumAccessState());
    expect(console.warn).toHaveBeenCalledWith('Failed to restore RevenueCat purchases:', expect.any(Error));
  });

  it('月払いPackageを直接購入しPlus有効状態を返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    const monthlyPackage = {
      identifier: '$rc_monthly',
      packageType: 'MONTHLY',
      product: {
        identifier: 'strollia_plus_monthly',
        title: 'Strollia Plus Monthly',
        description: 'Monthly plan',
        priceString: '¥300',
      },
    };
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({
      current: {
        identifier: 'default',
        availablePackages: [monthlyPackage],
      },
    });
    (Purchases.purchasePackage as jest.Mock).mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
          },
        },
      },
    });

    const client = createRevenueCatClient();

    await expect(client.purchasePackage('monthly')).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
    expect(Purchases.purchasePackage).toHaveBeenCalledWith(monthlyPackage);
  });

  it('年払いPackageを直接購入しPlus有効状態を返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    const annualPackage = {
      identifier: '$rc_annual',
      packageType: 'ANNUAL',
      product: {
        identifier: 'strollia_plus_yearly',
        title: 'Strollia Plus Annual',
        description: 'Annual plan',
        priceString: '¥3,300',
      },
    };
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({
      current: {
        identifier: 'default',
        availablePackages: [annualPackage],
      },
    });
    (Purchases.purchasePackage as jest.Mock).mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
          },
        },
      },
    });

    const client = createRevenueCatClient();

    await expect(client.purchasePackage('yearly')).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
    expect(Purchases.purchasePackage).toHaveBeenCalledWith(annualPackage);
  });

  it('購入キャンセル時はcancelledとして返す', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cancellationError = new Error('cancelled') as Error & { userCancelled: boolean };
    cancellationError.userCancelled = true;
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({ entitlements: { active: {} } });
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({
      current: {
        identifier: 'default',
        availablePackages: [
          {
            identifier: '$rc_monthly',
            packageType: 'MONTHLY',
            product: {
              identifier: 'strollia_plus_monthly',
              title: 'Strollia Plus Monthly',
              description: 'Monthly plan',
              priceString: '¥300',
            },
          },
        ],
      },
    });
    (Purchases.purchasePackage as jest.Mock).mockRejectedValue(cancellationError);

    await expect(purchasePremiumPackage('monthly')).resolves.toEqual({
      status: 'cancelled',
      accessState: getDefaultPremiumAccessState(),
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('購入失敗時はerrorへフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({ entitlements: { active: {} } });
    (Purchases.getOfferings as jest.Mock).mockRejectedValue(new Error('offering failed'));

    await expect(purchasePremiumPackage('monthly')).resolves.toEqual({
      status: 'error',
      accessState: getDefaultPremiumAccessState(),
    });
    expect(console.warn).toHaveBeenCalledWith('Failed to purchase RevenueCat package:', expect.any(Error));
  });

  it('CustomerInfo更新をStrollia Plus状態へ変換して購読する', () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    const onUpdate = jest.fn();

    const unsubscribe = subscribePremiumAccessStateUpdatesWithRevenueCat(onUpdate);
    const registeredListener = (Purchases.addCustomerInfoUpdateListener as jest.Mock).mock.calls[0][0];

    registeredListener({
      entitlements: {
        active: {
          [STROLLIA_PLUS_ENTITLEMENT_ID]: { identifier: STROLLIA_PLUS_ENTITLEMENT_ID },
        },
      },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });

    unsubscribe();
    expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(registeredListener);
  });

  it('RevenueCat未設定時はCustomerInfo更新購読を登録しない', () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', undefined);

    const unsubscribe = createRevenueCatClient().subscribeToCustomerInfoUpdates(jest.fn());

    unsubscribe();
    expect(Purchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
    expect(Purchases.removeCustomerInfoUpdateListener).not.toHaveBeenCalled();
  });

  it('Customer CenterをRevenueCat UIで表示する', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    (RevenueCatUI.presentCustomerCenter as jest.Mock).mockResolvedValue(undefined);

    await expect(presentCustomerCenterWithRevenueCat()).resolves.toBeUndefined();
    expect(RevenueCatUI.presentCustomerCenter).toHaveBeenCalledTimes(1);
  });

  it('Customer Center表示失敗時はfalseへフォールバックする', async () => {
    Platform.OS = 'ios';
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_ios_key');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (RevenueCatUI.presentCustomerCenter as jest.Mock).mockRejectedValue(new Error('customer center failed'));

    await expect(presentPremiumCustomerCenter()).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledWith('Failed to present RevenueCat Customer Center:', expect.any(Error));
  });
});
