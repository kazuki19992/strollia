import appJson from '../../../app.json';

/**
 * Expo設定から、iOSの言語判定に使うInfo.plist項目だけを型付きで参照する。
 * app.jsonの構成変更時にも安全に検証できるよう、iOSセクションや対象キーは任意として扱う。
 */
const expoConfig = appJson.expo as {
  ios?: {
    infoPlist?: {
      CFBundleDevelopmentRegion?: string;
      CFBundleLocalizations?: string[];
    };
  };
};

describe('App Storeの言語判定用iOS設定', () => {
  test('iOSバンドルの開発言語と対応言語を日本語として明示する', () => {
    expect(expoConfig.ios?.infoPlist?.CFBundleDevelopmentRegion).toBe('ja');
    expect(expoConfig.ios?.infoPlist?.CFBundleLocalizations).toEqual(['ja']);
  });
});
