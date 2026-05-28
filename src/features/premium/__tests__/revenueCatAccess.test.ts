import { Platform } from 'react-native';

import { developmentFlags } from '../../../config/developmentFlags';
import { STROLLIA_PLUS_ENTITLEMENT_ID } from '../premiumCatalog';
import { getRevenueCatApiKeyForPlatform, getRevenueCatConfigureOptions } from '../revenueCatConfig';
import { getDefaultPremiumAccessState, resolvePremiumAccessState, RevenueCatClient } from '../revenueCatAccess';

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
  afterEach(() => {
    Platform.OS = originalPlatformOS;
    setEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', originalIosKey);
    setEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', originalAndroidKey);
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
    };

    await expect(resolvePremiumAccessState(client)).resolves.toEqual({
      isPlusActive: true,
      entitlementId: STROLLIA_PLUS_ENTITLEMENT_ID,
    });
    expect(client.hasActiveEntitlement).toHaveBeenCalledWith(STROLLIA_PLUS_ENTITLEMENT_ID);
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
});
