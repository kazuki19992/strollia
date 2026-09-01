import appJson from '../../../app.json'; // eslint-disable-line no-restricted-imports -- src/ 外の Expo 設定ファイルを参照するため @/ エイリアス不使用

type ExpoPlugin = string | [string, Record<string, unknown>];

/**
 * Expoプラグイン配列から、指定したプラグインの設定値を取得する。
 * 権限を追加するプラグインが既定値へ戻る回帰を検出するために使う。
 */
function getPluginOptions(pluginName: string): Record<string, unknown> | undefined {
  const plugins = appJson.expo.plugins as ExpoPlugin[];
  const plugin = plugins.find((entry) => Array.isArray(entry) && entry[0] === pluginName);
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

describe('ネイティブ権限のExpo設定', () => {
  test('画像選択では写真の読み取りだけを許可する', () => {
    expect(getPluginOptions('expo-image-picker')).toEqual(
      expect.objectContaining({
        photosPermission:
          'すとろりあは、ジオタグ付き写真を地図上に表示したり、現在地アイコンに使用する画像を選択したりするために写真ライブラリを読み取ります。',
        cameraPermission: false,
        microphonePermission: false,
      }),
    );
  });

  test('位置情報では未使用のモーションアクティビティ権限を追加しない', () => {
    expect(getPluginOptions('expo-location')).toEqual(expect.objectContaining({ motionUsagePermission: false }));
  });

  test('写真ライブラリでは未使用の保存権限を追加しない', () => {
    expect(getPluginOptions('expo-media-library')).toEqual(expect.objectContaining({ savePhotosPermission: false }));
  });

  test('Android権限は重複させず未使用の外部ストレージ書き込みをブロックする', () => {
    const androidConfig = appJson.expo.android as { permissions?: string[]; blockedPermissions?: string[] };
    const permissions = androidConfig.permissions ?? [];
    expect(new Set(permissions).size).toBe(permissions.length);
    expect(permissions).toEqual(['android.permission.POST_NOTIFICATIONS']);
    expect(permissions).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
    expect(androidConfig.blockedPermissions).toContain('android.permission.WRITE_EXTERNAL_STORAGE');
  });
});
