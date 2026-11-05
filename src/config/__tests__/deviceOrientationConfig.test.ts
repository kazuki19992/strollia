import appJson from '../../../app.json'; // eslint-disable-line no-restricted-imports -- src/ 外の Expo 設定ファイルを参照するため @/ エイリアス不使用

/**
 * Expo設定から、端末種別と画面向きに関わるiOS項目だけを型付きで参照する。
 * app.jsonの構成変更時にも安全に検証できるよう、各キーは任意として扱う。
 */
const expoConfig = appJson.expo as {
  orientation?: string;
  ios?: {
    supportsTablet?: boolean;
    infoPlist?: {
      UISupportedInterfaceOrientations?: string[];
      'UISupportedInterfaceOrientations~ipad'?: string[];
    };
  };
};

describe('iPad・iPhone Duo対応の端末種別と画面向き設定', () => {
  test('iPadでもインストールできるようタブレット対応を有効にする', () => {
    expect(expoConfig.ios?.supportsTablet).toBe(true);
  });

  test('iPhone(iPhone Duoの外側画面を含む)は縦画面のみに固定する', () => {
    // iPhone Duoの内側画面はOSがこの指定を無視して全向きで表示するため、展開時の横画面はこの設定のまま利用できる
    expect(expoConfig.orientation).toBe('portrait');
    expect(expoConfig.ios?.infoPlist?.UISupportedInterfaceOrientations).toEqual(['UIInterfaceOrientationPortrait']);
  });

  test('iPadは縦横すべての向きを許可する', () => {
    expect(expoConfig.ios?.infoPlist?.['UISupportedInterfaceOrientations~ipad']).toEqual([
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
    ]);
  });
});
