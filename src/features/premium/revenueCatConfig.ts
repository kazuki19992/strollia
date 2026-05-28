import { Platform } from 'react-native';

/** RevenueCat SDKのconfigureへ渡す最小設定。 */
export type RevenueCatConfigureOptions = {
  /** RevenueCatのPublic SDK API key。 */
  apiKey: string;
};

/** 現在のプラットフォームに対応するRevenueCat APIキーを返す。 */
export function getRevenueCatApiKeyForPlatform(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  }

  return null;
}

/** APIキーがある場合だけRevenueCat SDK初期化設定を返す。 */
export function getRevenueCatConfigureOptions(): RevenueCatConfigureOptions | null {
  const apiKey = getRevenueCatApiKeyForPlatform();

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}
