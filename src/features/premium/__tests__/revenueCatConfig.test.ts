import { Platform } from 'react-native';
import { getRevenueCatApiKeyForPlatform, getRevenueCatConfigureOptions } from '@/features/premium/revenueCatConfig';

describe('revenueCatConfig RevenueCat設定取得', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    // プラットフォーム・環境変数は各テスト後に元に戻す
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
    delete process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'];
    delete process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'];
  });

  describe('getRevenueCatApiKeyForPlatform', () => {
    it('iOS でキーが設定されていればそのキーを返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'] = 'ios-test-key';

      expect(getRevenueCatApiKeyForPlatform()).toBe('ios-test-key');
    });

    it('iOS でキーが未設定の場合は null を返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

      expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    });

    it('Android でキーが設定されていればそのキーを返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'] = 'android-test-key';

      expect(getRevenueCatApiKeyForPlatform()).toBe('android-test-key');
    });

    it('Android でキーが未設定の場合は null を返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

      expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    });

    it('iOS でも Android でもないプラットフォームは null を返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'] = 'ios-test-key';
      process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'] = 'android-test-key';

      expect(getRevenueCatApiKeyForPlatform()).toBeNull();
    });
  });

  describe('getRevenueCatConfigureOptions', () => {
    it('APIキーがある場合は { apiKey } を返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      process.env['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'] = 'ios-test-key';

      expect(getRevenueCatConfigureOptions()).toEqual({ apiKey: 'ios-test-key' });
    });

    it('APIキーがない場合は null を返す', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });

      expect(getRevenueCatConfigureOptions()).toBeNull();
    });
  });
});
