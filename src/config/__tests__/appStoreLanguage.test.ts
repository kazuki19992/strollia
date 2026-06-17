import appJson from '../../../app.json';

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
